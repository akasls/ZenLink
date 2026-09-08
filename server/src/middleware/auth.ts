import { FastifyRequest, FastifyReply } from 'fastify';
import dbHelper from '../db/index.js';

export interface JwtPayload {
  userId: number;
  username: string;
  tokenVersion?: number;
}

/**
 * 认证中间件：验证 JWT Token 并比对令牌版本（支持修改密码后吊销旧会话）
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const decoded = await request.jwtVerify<JwtPayload>();
    const user = dbHelper.get('SELECT id, token_version FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      reply.status(401).send({ error: '用户不存在或已被移除' });
      return;
    }
    // 若 Token 携带了 tokenVersion，必须与数据库当前活跃版本一致
    if (decoded.tokenVersion !== undefined && user.token_version !== undefined && decoded.tokenVersion !== user.token_version) {
      reply.status(401).send({ error: '登录凭证已失效，请重新登录' });
      return;
    }
  } catch (err) {
    reply.status(401).send({ error: '未授权，请先登录' });
  }
}

/**
 * 可选认证：不强制要求登录，但如果有 token 则解析用户信息并验证有效性
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const decoded = await request.jwtVerify<JwtPayload>();
    const user = dbHelper.get('SELECT id, token_version FROM users WHERE id = ?', [decoded.userId]);
    if (user) {
      if (decoded.tokenVersion === undefined || user.token_version === undefined || decoded.tokenVersion === user.token_version) {
        return;
      }
    }
    // 若用户失效或版本不符，清除挂载的 request.user
    (request as any).user = undefined;
  } catch {
    // 未登录也允许继续，user 为 undefined
  }
}
