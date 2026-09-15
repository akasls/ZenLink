import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { isIP } from 'net';
import crypto from 'crypto';

import dbHelper, { initDatabase, saveDatabase } from './db/index.js';
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
    level: process.env.NODE_ENV === 'test' ? 'error' : 'info',
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

// CORS 配置：兼顾自建多网段即开即用与跨域数据安全防护
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

// CORS 配置：放行自建部署同源/自定义反代域名访问并阻断恶意跨域
await fastify.register(cors, {
  delegator: (req, cb) => {
    const origin = req.headers.origin;
    if (!origin) {
      return cb(null, { origin: true, credentials: true });
    }

    if (allowedOrigins.has(origin)) {
      return cb(null, { origin: true, credentials: true });
    }

    try {
      const parsed = new URL(origin);
      const hostname = parsed.hostname;

      // 同 Host 访问放行（自建反代与用户自定义域名即开即用，无须繁琐配置环境变量）
      const reqHost = req.headers.host;
      if (reqHost && (parsed.host === reqHost || hostname === reqHost.split(':')[0])) {
        return cb(null, { origin: true, credentials: true });
      }

      // 本地环回地址放行
      if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1') {
        return cb(null, { origin: true, credentials: true });
      }

      // 自建服务器 IP 访问放行 (包含 VPS IP 与局域网私网 IP)
      if (isIP(hostname) !== 0) {
        return cb(null, { origin: true, credentials: true });
      }

      // 局域网私有服务域名放行
      if (
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.lan') ||
        hostname.endsWith('.home') ||
        hostname.endsWith('.arpa')
      ) {
        return cb(null, { origin: true, credentials: true });
      }
    } catch {}

    // 拦截未授权第三方外部跨域请求
    cb(null, { origin: false });
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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

// 生产环境：提供前端静态文件与高性能缓存，并动态注入自定义网站标题、描述与 Favicon
const clientDist = join(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  function getRenderedIndexHtml(): string {
    const indexPath = join(clientDist, 'index.html');
    if (!existsSync(indexPath)) return '';
    let html = readFileSync(indexPath, 'utf-8');

    try {
      const rows = dbHelper.all('SELECT key, value FROM system_settings');
      const settings: Record<string, string> = {};
      for (const r of rows) settings[r.key] = r.value;

      const siteName = settings.site_name || 'ZenLink';
      const siteDesc = settings.site_desc || '简洁高效的个人网址导航与知识工作台';
      const siteLogo = settings.site_logo || '';

      // 动态注入标题与描述
      html = html.replace(/<title>.*?<\/title>/i, `<title>${siteName} · ${siteDesc}</title>`);
      html = html.replace(/(<meta\s+name=["']description["']\s+content=["']).*?(["'])/i, `$1${siteName} - ${siteDesc}$2`);
      html = html.replace(/(<meta\s+name=["']application-name["']\s+content=["']).*?(["'])/i, `$1${siteName}$2`);
      html = html.replace(/(<meta\s+name=["']apple-mobile-web-app-title["']\s+content=["']).*?(["'])/i, `$1${siteName}$2`);

      if (siteLogo) {
        html = html.replace(/(<link\s+[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']).*?(["'])/gi, `$1${siteLogo}$2`);
        html = html.replace(/(<link\s+[^>]*rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']).*?(["'])/gi, `$1${siteLogo}$2`);
        if (!siteLogo.endsWith('.svg') && !siteLogo.includes('image/svg')) {
          html = html.replace(/type=["']image\/svg\+xml["']/gi, '');
        }
      }
    } catch {}

    return html;
  }

  // 动态返回 PWA manifest 保证名称与简介一致
  fastify.get('/manifest.webmanifest', async (request, reply) => {
    const manifestPath = join(clientDist, 'manifest.webmanifest');
    let manifest: any = {};
    if (existsSync(manifestPath)) {
      try { manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')); } catch {}
    }
    try {
      const rows = dbHelper.all('SELECT key, value FROM system_settings');
      const settings: Record<string, string> = {};
      for (const r of rows) settings[r.key] = r.value;
      if (settings.site_name) {
        manifest.name = settings.site_name;
        manifest.short_name = settings.site_name;
      }
      if (settings.site_desc) {
        manifest.description = settings.site_desc;
      }
    } catch {}
    return reply.type('application/manifest+json; charset=utf-8').header('Cache-Control', 'public, max-age=60').send(manifest);
  });

  // 根路径动态注入返回
  fastify.get('/', async (request, reply) => {
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send(getRenderedIndexHtml());
  });

  await fastify.register(fastifyStatic, {
    root: clientDist,
    prefix: '/',
    wildcard: true,
    setHeaders: (res, path) => {
      if (path.includes('assets') || path.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (path.endsWith('sw.js') || path.includes('workbox') || path.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (path.endsWith('.webmanifest') || path.endsWith('manifest.json')) {
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      }
    },
  });

  // SPA fallback
  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api/')) {
      return reply
        .type('text/html; charset=utf-8')
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .send(getRenderedIndexHtml());
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
