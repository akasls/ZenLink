import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import dbHelper, { saveDatabase } from '../db/index.js';
import { requireAuth as authenticate } from '../middleware/auth.js';
import { uploadFileBuffer, getStorageSettings, getR2Client } from '../utils/s3.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, createReadStream } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = existsSync(resolve(__dirname, '../../data/uploads'))
  ? resolve(__dirname, '../../data/uploads')
  : (existsSync(resolve(__dirname, '../../../data/uploads'))
    ? resolve(__dirname, '../../../data/uploads')
    : resolve(__dirname, '../../data/uploads'));

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}
export default async function noteRoutes(fastify: FastifyInstance) {
  // 确保 notes 表存在 sort_order 列与 tags 列
  try {
    dbHelper.run('ALTER TABLE notes ADD COLUMN sort_order INTEGER DEFAULT 0');
  } catch {}
  try {
    dbHelper.run('ALTER TABLE notes ADD COLUMN tags TEXT DEFAULT "[]"');
  } catch {}

  // ==================== 笔记分类 (兼容旧数据) ====================

  // 获取所有笔记分类
  fastify.get('/api/note-categories', { preHandler: [authenticate] }, async () => {
    const categories = dbHelper.all('SELECT * FROM note_categories ORDER BY sort_order ASC, id ASC');
    return { categories };
  });

  // 批量更新笔记分类排序
  fastify.put('/api/note-categories/reorder', { preHandler: [authenticate] }, async (request) => {
    const { ids } = request.body as { ids: number[] };
    if (Array.isArray(ids)) {
      ids.forEach((id, index) => {
        dbHelper.run('UPDATE note_categories SET sort_order = ? WHERE id = ?', [index, Number(id)]);
      });
      saveDatabase();
    }
    return { success: true };
  });

  // 创建笔记分类
  fastify.post('/api/note-categories', { preHandler: [authenticate] }, async (request, reply) => {
    const { name, icon } = request.body as { name: string; icon?: string };
    if (!name || !name.trim()) {
      return reply.status(400).send({ error: '分类名称不能为空' });
    }

    const result = dbHelper.run(
      'INSERT INTO note_categories (name, icon) VALUES (?, ?)',
      [name.trim(), icon || 'pi pi-folder']
    );
    saveDatabase();

    const category = dbHelper.get('SELECT * FROM note_categories WHERE id = ?', [result.lastInsertRowid]);
    return { category };
  });

  // 更新笔记分类
  fastify.put('/api/note-categories/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, icon, sortOrder } = request.body as { name?: string; icon?: string; sortOrder?: number };

    const existing = dbHelper.get('SELECT * FROM note_categories WHERE id = ?', [Number(id)]);
    if (!existing) return reply.status(404).send({ error: '分类不存在' });

    dbHelper.run(
      'UPDATE note_categories SET name = ?, icon = ?, sort_order = ? WHERE id = ?',
      [name || existing.name, icon || existing.icon, sortOrder ?? existing.sort_order, Number(id)]
    );
    saveDatabase();

    const category = dbHelper.get('SELECT * FROM note_categories WHERE id = ?', [Number(id)]);
    return { category };
  });

  // 删除笔记分类
  fastify.delete('/api/note-categories/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    dbHelper.run('UPDATE notes SET category_id = NULL WHERE category_id = ?', [Number(id)]);
    dbHelper.run('DELETE FROM note_categories WHERE id = ?', [Number(id)]);
    saveDatabase();
    return { success: true };
  });

  // ==================== 笔记标签与笔记 ====================

  // 获取所有使用中的笔记标签及其文章数量
  fastify.get('/api/notes/tags', { preHandler: [authenticate] }, async () => {
    const rows = dbHelper.all('SELECT tags FROM notes WHERE tags IS NOT NULL AND tags != "" AND tags != "[]"');
    const tagCountMap = new Map<string, number>();
    for (const row of rows) {
      let list: string[] = [];
      try {
        list = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
      } catch {
        list = String(row.tags).split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (Array.isArray(list)) {
        for (const t of list) {
          const clean = String(t).trim();
          if (clean) {
            tagCountMap.set(clean, (tagCountMap.get(clean) || 0) + 1);
          }
        }
      }
    }
    const tags = Array.from(tagCountMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    return { tags };
  });

  // 获取所有笔记 (支持根据 tag 筛选与 search 检索)
  fastify.get('/api/notes', { preHandler: [authenticate] }, async (request) => {
    const { categoryId, tag, search } = request.query as { categoryId?: string; tag?: string; search?: string };

    let sql = 'SELECT * FROM notes';
    const params: any[] = [];
    const conditions: string[] = [];

    if (categoryId) {
      conditions.push('category_id = ?');
      params.push(Number(categoryId));
    }
    if (tag && tag.trim()) {
      conditions.push('(tags LIKE ? OR tags LIKE ?)');
      params.push(`%"${tag.trim()}"%`, `%${tag.trim()}%`);
    }
    if (search && search.trim()) {
      conditions.push('(title LIKE ? OR content LIKE ? OR tags LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY is_pinned DESC, sort_order ASC, updated_at DESC';

    const rawNotes = dbHelper.all(sql, params);
    const notes = rawNotes.map((n: any) => {
      let parsedTags: string[] = [];
      try {
        parsedTags = typeof n.tags === 'string' ? JSON.parse(n.tags) : (n.tags || []);
      } catch {
        parsedTags = n.tags ? String(n.tags).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      }
      return {
        ...n,
        tags: parsedTags,
      };
    });

    return { notes };
  });

  // 批量更新笔记排序
  fastify.put('/api/notes/reorder', { preHandler: [authenticate] }, async (request) => {
    const { ids } = request.body as { ids: number[] };
    if (Array.isArray(ids)) {
      ids.forEach((id, index) => {
        dbHelper.run('UPDATE notes SET sort_order = ? WHERE id = ?', [index, Number(id)]);
      });
      saveDatabase();
    }
    return { success: true };
  });

  // 获取单个笔记
  fastify.get('/api/notes/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const note = dbHelper.get('SELECT * FROM notes WHERE id = ?', [Number(id)]);
    if (!note) return reply.status(404).send({ error: '笔记不存在' });
    let parsedTags: string[] = [];
    try {
      parsedTags = typeof note.tags === 'string' ? JSON.parse(note.tags) : (note.tags || []);
    } catch {
      parsedTags = note.tags ? String(note.tags).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    }
    return { note: { ...note, tags: parsedTags } };
  });

  // 创建笔记
  fastify.post('/api/notes', { preHandler: [authenticate] }, async (request, reply) => {
    const { title, content, categoryId, tags } = request.body as {
      title?: string; content?: string; categoryId?: number; tags?: string[] | string;
    };

    let tagsStr = '[]';
    if (Array.isArray(tags)) {
      tagsStr = JSON.stringify(tags.map(t => String(t).trim()).filter(Boolean));
    } else if (typeof tags === 'string' && tags.trim()) {
      tagsStr = JSON.stringify(tags.split(',').map(s => s.trim()).filter(Boolean));
    }

    const result = dbHelper.run(
      'INSERT INTO notes (title, content, category_id, tags) VALUES (?, ?, ?, ?)',
      [title || '未命名笔记', content || '', categoryId || null, tagsStr]
    );
    saveDatabase();

    const note = dbHelper.get('SELECT * FROM notes WHERE id = ?', [result.lastInsertRowid]);
    let parsedTags: string[] = [];
    try {
      parsedTags = JSON.parse(note.tags || '[]');
    } catch {
      parsedTags = [];
    }
    return { note: { ...note, tags: parsedTags } };
  });

  // 更新笔记
  fastify.put('/api/notes/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title, content, categoryId, isPinned, tags } = request.body as {
      title?: string; content?: string; categoryId?: number | null; isPinned?: number; tags?: string[] | string;
    };

    const existing = dbHelper.get('SELECT * FROM notes WHERE id = ?', [Number(id)]);
    if (!existing) return reply.status(404).send({ error: '笔记不存在' });

    let finalTagsStr = existing.tags || '[]';
    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        finalTagsStr = JSON.stringify(tags.map(t => String(t).trim()).filter(Boolean));
      } else if (typeof tags === 'string') {
        finalTagsStr = JSON.stringify(tags.split(',').map(s => s.trim()).filter(Boolean));
      }
    }

    dbHelper.run(
      `UPDATE notes SET title = ?, content = ?, category_id = ?, is_pinned = ?, tags = ?, updated_at = datetime('now') WHERE id = ?`,
      [
        title ?? existing.title,
        content ?? existing.content,
        categoryId !== undefined ? categoryId : existing.category_id,
        isPinned !== undefined ? isPinned : existing.is_pinned,
        finalTagsStr,
        Number(id),
      ]
    );
    saveDatabase();

    const note = dbHelper.get('SELECT * FROM notes WHERE id = ?', [Number(id)]);
    let parsedTags: string[] = [];
    try {
      parsedTags = JSON.parse(note.tags || '[]');
    } catch {
      parsedTags = [];
    }
    return { note: { ...note, tags: parsedTags } };
  });

  // 删除笔记
  fastify.delete('/api/notes/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    dbHelper.run('DELETE FROM notes WHERE id = ?', [Number(id)]);
    saveDatabase();
    return { success: true };
  });

  // ==================== 笔记加密与限时分享 ====================
  dbHelper.exec(`
    CREATE TABLE IF NOT EXISTS note_shares (
      id TEXT PRIMARY KEY,
      note_id INTEGER NOT NULL,
      password TEXT,
      expires_at TEXT,
      burn_after_reading INTEGER NOT NULL DEFAULT 0,
      views_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
  `);

  // 创建笔记分享
  fastify.post('/api/notes/:id/share', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const note = dbHelper.get('SELECT * FROM notes WHERE id = ?', [Number(id)]);

    if (!note) {
      return reply.status(404).send({ error: '笔记不存在' });
    }

    const { password, expire_hours, burn_after_reading } = request.body as {
      password?: string;
      expire_hours?: number;
      burn_after_reading?: boolean;
    };

    const chars = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let shareCode = '';
    for (let i = 0; i < 8; i++) {
      shareCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    let expiresAt: string | null = null;
    if (expire_hours && expire_hours > 0) {
      const d = new Date(Date.now() + expire_hours * 3600 * 1000);
      expiresAt = d.toISOString();
    }

    dbHelper.run(
      'INSERT INTO note_shares (id, note_id, password, expires_at, burn_after_reading) VALUES (?, ?, ?, ?, ?)',
      [shareCode, Number(id), password ? password.trim() : null, expiresAt, burn_after_reading ? 1 : 0]
    );
    saveDatabase();

    return {
      share: {
        id: shareCode,
        has_password: !!password,
        password: password || undefined,
        expires_at: expiresAt,
        burn_after_reading: !!burn_after_reading,
      },
    };
  });

  // 获取笔记的分享列表
  fastify.get('/api/notes/:id/shares', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const shares = dbHelper.all(
      'SELECT id, note_id, password, expires_at, burn_after_reading, views_count, created_at FROM note_shares WHERE note_id = ? ORDER BY created_at DESC',
      [Number(id)]
    );
    return { shares };
  });

  // 撤销笔记分享
  fastify.delete('/api/notes/shares/:code', { preHandler: [authenticate] }, async (request) => {
    const { code } = request.params as { code: string };
    dbHelper.run('DELETE FROM note_shares WHERE id = ?', [code]);
    saveDatabase();
    return { success: true };
  });

  // ==================== 笔记附件上传与文件处理 (复用统一存储配置：本地 / Cloudflare R2) ====================
  // 上传附件/图片
  fastify.post('/api/notes/upload', { preHandler: [authenticate] }, async (request, reply) => {
    const data = await (request as any).file();
    if (!data) {
      return reply.status(400).send({ error: '没有上传文件' });
    }

    const buffer = await data.toBuffer();
    const fileName = data.filename || 'note_attachment.bin';
    const mimeType = data.mimetype || 'application/octet-stream';

    const uploaded = await uploadFileBuffer(buffer, fileName, mimeType);
    return {
      success: true,
      file: {
        ...uploaded,
        url: uploaded.storage === 'r2' && uploaded.url.startsWith('http')
          ? uploaded.url
          : `/api/notes/raw/${uploaded.path}`,
        downloadUrl: `/api/notes/download/${uploaded.path}?name=${encodeURIComponent(fileName)}`,
      },
    };
  });

  // 获取文件原始内容 (用于图片预览/直接内嵌)
  fastify.get('/api/notes/raw/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const safeFile = basename(filename);

    const config = getStorageSettings();
    if (config.storage_type === 'r2' && config.r2_bucket_name) {
      if (config.r2_public_domain) {
        const domain = config.r2_public_domain.trim().replace(/\/+$/, '');
        return reply.redirect(`${domain}/${safeFile}`);
      }

      const client = getR2Client(config);
      if (client) {
        try {
          const cmd = new GetObjectCommand({
            Bucket: config.r2_bucket_name.trim(),
            Key: safeFile,
          });
          const res = await client.send(cmd);
          if (res.ContentType) reply.header('Content-Type', res.ContentType);
          reply.header('Cache-Control', 'public, max-age=86400');
          return reply.send(res.Body);
        } catch {}
      }
    }

    const filePath = resolve(UPLOAD_DIR, safeFile);
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: '文件不存在' });
    }

    const ext = safeFile.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      txt: 'text/plain; charset=utf-8',
      md: 'text/markdown; charset=utf-8',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    if (ext === 'svg' || ext === 'html' || ext === 'htm') {
      reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    }
    const stream = createReadStream(filePath);
    return reply.header('Content-Type', contentType).header('Cache-Control', 'public, max-age=86400').send(stream);
  });

  // 下载附件文件
  fastify.get('/api/notes/download/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const { name } = request.query as { name?: string };
    const safeFile = basename(filename);
    const downloadName = name || safeFile;

    const config = getStorageSettings();
    if (config.storage_type === 'r2' && config.r2_bucket_name) {
      if (config.r2_public_domain) {
        const domain = config.r2_public_domain.trim().replace(/\/+$/, '');
        return reply.redirect(`${domain}/${safeFile}`);
      }

      const client = getR2Client(config);
      if (client) {
        try {
          const cmd = new GetObjectCommand({
            Bucket: config.r2_bucket_name.trim(),
            Key: safeFile,
          });
          const res = await client.send(cmd);
          reply
            .header('Content-Type', res.ContentType || 'application/octet-stream')
            .header('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
          return reply.send(res.Body);
        } catch {
          return reply.status(404).send({ error: '无法从 R2 读取文件' });
        }
      }
    }

    const localFile = resolve(UPLOAD_DIR, safeFile);
    if (!existsSync(localFile)) {
      return reply.status(404).send({ error: '本地文件已被删除' });
    }

    const stream = createReadStream(localFile);
    reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`)
      .send(stream);
  });

}
