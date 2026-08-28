import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

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

// 创建 Fastify 实例
const fastify = Fastify({
  logger: {
    level: 'info',
  },
  trustProxy: true,
});

// 全局安全标头
fastify.addHook('onSend', async (request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'SAMEORIGIN');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// 注册插件
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'zenlink-dev-secret-change-in-production',
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
      } else if (path.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
  saveDatabase();
  process.exit(0);
};
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// 启动服务器
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`\n🚀 ZenLink Server 运行在 http://localhost:${PORT}`);
  console.log(`📁 数据库位置: server/data/zenlink.db\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
