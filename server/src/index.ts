import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import crypto from 'crypto';

import { initDatabase, saveDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import authRoutes from './routes/auth.js';
import bookmarkRoutes from './routes/bookmarks.js';
import categoryRoutes from './routes/categories.js';
import noteRoutes from './routes/notes.js';
import aiRoutes from './routes/ai.js';
import settingsRoutes from './routes/settings.js';
import shareRoutes from './routes/shares.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 初始化数据库（异步，需要加载 WASM）
await initDatabase();
seedDatabase();

// 创建 Fastify 实例（收敛可信内网反代 IP，防止伪造 X-Forwarded-For 穿透防爆破限流）
const fastify = Fastify({
  logger: {
    level: 'info',
  },
  trustProxy: ['127.0.0.1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '::1', 'fc00::/7'],
});

import { ZodError } from 'zod';

// 全局现代安全标头
fastify.addHook('onSend', async (request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'SAMEORIGIN');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

// 全局异常处理：自动转换 Zod 参数验证错误为 400 状态码
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: '参数验证失败',
      details: error.errors,
    });
  }
  reply.send(error);
});

// 动态响应 Payload 极限压缩（Brotli / Gzip，节省 70%+ 网络传输带宽）
await fastify.register(compress, {
  global: true,
  threshold: 1024,
});

// 严格收敛 CORS：杜绝 origin: true 导致的跨域凭证与敏感数据泄露
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
if (process.env.ORIGIN) {
  allowedOrigins.add(process.env.ORIGIN);
}
if (process.env.APP_URL) {
  try {
    allowedOrigins.add(new URL(process.env.APP_URL).origin);
  } catch {}
}

await fastify.register(cors, {
  origin: (origin, cb) => {
    // 允许非跨域直连、移动端或测试客户端
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) {
      return cb(null, true);
    }
    // 开发/本地调试网段放行
    if (process.env.NODE_ENV !== 'production' && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return cb(null, true);
    }
    cb(new Error(`Blocked by CORS policy: Origin ${origin} not allowed`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
});

// JWT 密钥自动安全管理：优先读取环境变量；若未提供则在数据卷中自动生成并持久化存储，无需用户手动繁琐配置
let jwtSecret = process.env.JWT_SECRET?.trim();
if (!jwtSecret || jwtSecret === 'zenlink-dev-secret-change-in-production') {
  const dataDir = join(__dirname, '../../data');
  const secretFile = join(dataDir, '.jwt_secret');
  try {
    if (existsSync(secretFile)) {
      jwtSecret = readFileSync(secretFile, 'utf-8').trim();
    } else {
      jwtSecret = crypto.randomBytes(32).toString('hex');
      try {
        writeFileSync(secretFile, jwtSecret, { mode: 0o600 });
        console.log('🔐 [安全配置] 已自动生成并在持久化数据卷中安全保存强随机 JWT_SECRET (用户无需手动配置)');
      } catch {}
    }
  } catch {
    jwtSecret = crypto.randomBytes(32).toString('hex');
  }
}

await fastify.register(jwt, {
  secret: jwtSecret,
});

await fastify.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// 注册路由
await fastify.register(authRoutes);
await fastify.register(bookmarkRoutes);
await fastify.register(categoryRoutes);
await fastify.register(noteRoutes);
await fastify.register(aiRoutes);
await fastify.register(settingsRoutes);
await fastify.register(shareRoutes);

// 生产环境：提供前端静态文件与高性能缓存
const clientDist = join(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  await fastify.register(fastifyStatic, {
    root: clientDist,
    prefix: '/',
    setHeaders: (res, path) => {
      if (path.includes('assets') || path.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (path.endsWith('sw.js') || path.includes('workbox') || path.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (path.endsWith('.webmanifest') || path.endsWith('manifest.json')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      }
    },
  });

  // SPA fallback
  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    reply.status(404).send({ error: 'Not Found' });
  });
}

// 优雅停机保证数据完整落盘
const handleShutdown = () => {
  console.log('\n🛑 正在安全持久化数据库并关闭服务...');
  saveDatabase(true);
  process.exit(0);
};
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

process.on('uncaughtException', (err) => {
  console.error('🚨 [uncaughtException]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 [unhandledRejection]', reason);
});

// 启动服务器
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

if (process.env.NODE_ENV !== 'test') {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 ZenLink Server 运行在 http://localhost:${PORT}`);
    console.log(`📁 数据库位置: server/data/zenlink.db\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

export { fastify };
