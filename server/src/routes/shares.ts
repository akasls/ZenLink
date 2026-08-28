import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import dbHelper, { saveDatabase } from '../db/index.js';

export default async function shareRoutes(fastify: FastifyInstance) {
  // 1. 获取公开笔记分享内容元数据及公开正文
  fastify.get('/api/shares/:code', async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
    const { code } = request.params;
    if (!code) {
      return reply.status(400).send({ error: '分享代码无效' });
    }

    const now = new Date().toISOString();

    // 检查笔记分享 (note_shares)
    const noteShare = dbHelper.get('SELECT * FROM note_shares WHERE id = ?', [code]);
    if (!noteShare) {
      return reply.status(404).send({ error: '分享链接不存在或已被销毁' });
    }

    if (noteShare.expires_at && noteShare.expires_at < now) {
      return reply.status(410).send({ error: '该分享链接已过期失效' });
    }

    const note = dbHelper.get('SELECT * FROM notes WHERE id = ?', [noteShare.note_id]);
    if (!note) {
      return reply.status(404).send({ error: '原笔记已被删除' });
    }

    // 如果有访问密码，返回需要密码保护
    if (noteShare.password && noteShare.password.trim()) {
      return reply.send({
        need_password: true,
        type: 'note',
        title: note.title,
        file_name: null,
        file_size: null,
      });
    }

    // 无密码直接访问：增加访问次数并处理阅后即焚
    const isBurned = !!noteShare.burn_after_reading;
    if (isBurned) {
      dbHelper.run('DELETE FROM note_shares WHERE id = ?', [code]);
    } else {
      dbHelper.run('UPDATE note_shares SET views_count = views_count + 1 WHERE id = ?', [code]);
    }
    saveDatabase();

    let parsedTags: string[] = [];
    try {
      parsedTags = typeof note.tags === 'string' ? JSON.parse(note.tags) : (note.tags || []);
    } catch {
      parsedTags = [];
    }

    return reply.send({
      need_password: false,
      is_burned: isBurned,
      transfer: {
        id: note.id,
        type: 'note',
        title: note.title,
        content: note.content,
        tags: parsedTags,
        file_name: null,
        file_size: null,
        mime_type: null,
        file_url: null,
        created_at: note.created_at,
      },
    });
  });

  // 2. 验证密码并提取分享内容
  fastify.post('/api/shares/:code/verify', async (request: FastifyRequest<{ Params: { code: string }; Body: { password?: string } }>, reply: FastifyReply) => {
    const { code } = request.params;
    const { password = '' } = (request.body as any) || {};

    if (!code) {
      return reply.status(400).send({ error: '分享代码无效' });
    }

    const now = new Date().toISOString();

    // 检查笔记分享
    const noteShare = dbHelper.get('SELECT * FROM note_shares WHERE id = ?', [code]);
    if (!noteShare) {
      return reply.status(404).send({ error: '分享链接不存在或已被销毁' });
    }

    if (noteShare.expires_at && noteShare.expires_at < now) {
      return reply.status(410).send({ error: '该分享链接已过期失效' });
    }

    if (noteShare.password && noteShare.password.trim() !== String(password).trim()) {
      return reply.status(401).send({ error: '提取密码错误' });
    }

    const note = dbHelper.get('SELECT * FROM notes WHERE id = ?', [noteShare.note_id]);
    if (!note) {
      return reply.status(404).send({ error: '原笔记已被删除' });
    }

    const isBurned = !!noteShare.burn_after_reading;
    if (isBurned) {
      dbHelper.run('DELETE FROM note_shares WHERE id = ?', [code]);
    } else {
      dbHelper.run('UPDATE note_shares SET views_count = views_count + 1 WHERE id = ?', [code]);
    }
    saveDatabase();

    let parsedTags: string[] = [];
    try {
      parsedTags = typeof note.tags === 'string' ? JSON.parse(note.tags) : (note.tags || []);
    } catch {
      parsedTags = [];
    }

    return reply.send({
      need_password: false,
      is_burned: isBurned,
      transfer: {
        id: note.id,
        type: 'note',
        title: note.title,
        content: note.content,
        tags: parsedTags,
        file_name: null,
        file_size: null,
        mime_type: null,
        file_url: null,
        created_at: note.created_at,
      },
    });
  });
}
