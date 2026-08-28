import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import dbHelper, { saveDatabase } from '../db/index.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

export default async function categoryRoutes(fastify: FastifyInstance): Promise<void> {
  // ==================== 获取分类列表 ====================

  fastify.get('/api/categories', { preHandler: [optionalAuth] }, async (request) => {
    const user = (request as any).user;

    let sql = 'SELECT * FROM categories';
    if (!user) {
      sql += ' WHERE is_private = 0';
    }
    sql += ' ORDER BY sort_order ASC, created_at ASC';

    const categories = dbHelper.all(sql);
    return { categories };
  });

  // ==================== 创建分类 ====================

  const createCategorySchema = z.object({
    name: z.string().min(1, '分类名称不能为空').max(50),
    icon: z.string().optional().default('pi pi-folder'),
    isPrivate: z.boolean().optional().default(false),
    parentId: z.number().int().positive().optional().nullable(),
  });

  fastify.post('/api/categories', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const body = createCategorySchema.parse(request.body);

      const maxSort = dbHelper.get('SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM categories');
      const sortOrder = (maxSort?.max_sort || 0) + 1;

      const result = dbHelper.run(
        'INSERT INTO categories (name, icon, is_private, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)',
        [body.name, body.icon, body.isPrivate ? 1 : 0, body.parentId || null, sortOrder]
      );

      saveDatabase();

      const category = dbHelper.get('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
      return reply.status(201).send({ category });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: '参数验证失败', details: error.errors });
      }
      throw error;
    }
  });

  // ==================== 更新分类 ====================

  const updateCategorySchema = z.object({
    name: z.string().min(1).max(50).optional(),
    icon: z.string().optional(),
    isPrivate: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    parentId: z.number().int().positive().optional().nullable(),
  });

  fastify.put('/api/categories/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateCategorySchema.parse(request.body);

    const fields: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.icon !== undefined) { fields.push('icon = ?'); values.push(body.icon); }
    if (body.isPrivate !== undefined) { fields.push('is_private = ?'); values.push(body.isPrivate ? 1 : 0); }
    if (body.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(body.sortOrder); }
    if (body.parentId !== undefined) { fields.push('parent_id = ?'); values.push(body.parentId); }

    if (fields.length === 0) {
      return reply.status(400).send({ error: '没有需要更新的字段' });
    }

    fields.push("updated_at = datetime('now')");
    values.push(Number(id));

    dbHelper.run(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase();

    const category = dbHelper.get('SELECT * FROM categories WHERE id = ?', [Number(id)]);
    return { category };
  });

  // ==================== 删除分类 ====================

  fastify.delete('/api/categories/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // 将该分类下的书签移到"未分类"
    dbHelper.run('UPDATE bookmarks SET category_id = NULL WHERE category_id = ?', [Number(id)]);

    const result = dbHelper.run('DELETE FROM categories WHERE id = ?', [Number(id)]);
    if (result.changes === 0) {
      return reply.status(404).send({ error: '分类不存在' });
    }
    saveDatabase();

    return { success: true };
  });
}
