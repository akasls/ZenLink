import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { dbHelper, saveDatabase } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getStorageSettings, saveStorageSettings, testR2Connection } from '../utils/s3.js';

export default async function settingsRoutes(fastify: FastifyInstance) {
  // 确保 system_settings 表存在
  dbHelper.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // 1. 获取公开站点设置
  fastify.get('/api/settings', async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = dbHelper.all('SELECT key, value FROM system_settings');
    const settings: Record<string, string> = {
      site_name: 'ZenLink',
      site_desc: '简洁高效的个人网址导航与知识工作台',
      site_logo: '',
      default_engine: 'google',
      search_bg_mode: 'custom_image',
      search_bg_image: '',
      theme_primary_color: '#f1404b',
      enable_ai: 'true',
      enable_notes: 'true',
    };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return reply.send({ settings });
  });

  // 2. 保存站点设置（需要管理员登录）
  fastify.post('/api/settings', { preHandler: requireAuth }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const { site_name, site_logo, site_desc, default_engine, search_bg_mode, search_bg_image, theme_primary_color, enable_ai, enable_notes } = body;

    if (site_name !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', ['site_name', String(site_name)]);
    }
    if (site_logo !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', ['site_logo', String(site_logo)]);
    }
    if (site_desc !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', ['site_desc', String(site_desc)]);
    }
    if (default_engine !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', ['default_engine', String(default_engine)]);
    }
    if (search_bg_mode !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', ['search_bg_mode', String(search_bg_mode)]);
    }
    if (search_bg_image !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', ['search_bg_image', String(search_bg_image)]);
    }
    if (theme_primary_color !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', ['theme_primary_color', String(theme_primary_color)]);
    }
    if (enable_ai !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', ['enable_ai', String(enable_ai)]);
    }
    if (enable_notes !== undefined) {
      dbHelper.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', ['enable_notes', String(enable_notes)]);
    }

    saveDatabase();
    return reply.send({ success: true });
  });

  // 3. 获取存储设置 (需要管理员鉴权)
  fastify.get('/api/storage/settings', { preHandler: requireAuth }, async () => {
    const config = getStorageSettings();
    return {
      ...config,
      r2_secret_access_key: config.r2_secret_access_key ? '••••••••••••••••' : '',
    };
  });

  // 4. 保存存储设置 (需要管理员鉴权)
  fastify.post('/api/storage/settings', { preHandler: requireAuth }, async (request) => {
    const body = (request.body as any) || {};
    saveStorageSettings(body);
    return { success: true };
  });

  // 5. 测试 Cloudflare R2 存储桶连通性 (需要管理员鉴权)
  fastify.post('/api/storage/test', { preHandler: requireAuth }, async (request) => {
    const body = (request.body as any) || {};
    const result = await testR2Connection(body);
    return result;
  });
}
