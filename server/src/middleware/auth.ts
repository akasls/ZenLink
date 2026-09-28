import { FastifyRequest, FastifyReply } from 'fastify';
import dbHelper from '../db/index.js';

export interface JwtPayload {
  userId: number;
  username: string;
  tokenVersion?: number;
}

/**
 * 从请求中提取 Token（优先 Authorization 标头，其次 Cookie，最后 URL query 参数）
 */
export function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const raw = authHeader.slice(7).trim();
    if (raw) return raw;
  }
  const cookies = (request as any).cookies;
  if (cookies && cookies.token) {
    return cookies.token;
  }
  const query = request.query as any;
  if (query && query.token && typeof query.token === 'string') {
    return query.token.trim();
  }
  return null;
}

/**
 * 校验 Token 有效性并验证与数据库活跃版本一致性
 */
export async function verifyToken(request: FastifyRequest): Promise<JwtPayload | null> {
  const token = extractToken(request);
  if (!token) return null;
  try {
    const decoded = request.server.jwt.verify<JwtPayload>(token);
    if (!decoded || !decoded.userId) return null;

    const user = dbHelper.get('SELECT id, token_version FROM users WHERE id = ?', [decoded.userId]);
    if (!user) return null;

    // 若 Token 携带了 tokenVersion，必须与数据库当前活跃版本一致
    if (decoded.tokenVersion !== undefined && user.token_version !== undefined && decoded.tokenVersion !== user.token_version) {
      return null;
    }

    (request as any).user = decoded;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * 严格认证中间件：验证 JWT Token，支持修改密码后吊销旧会话
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const payload = await verifyToken(request);
  if (!payload) {
    return reply.status(401).send({ error: '未授权，请先登录' });
  }
}

/**
 * 可选认证：不强制要求登录，但如果有 token 则解析用户信息并验证有效性
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await verifyToken(request);
}
