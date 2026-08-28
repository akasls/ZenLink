import { FastifyRequest, FastifyReply } from 'fastify';

export interface JwtPayload {
  userId: number;
  username: string;
}

/**
 * 认证中间件：验证 JWT Token
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: '未授权，请先登录' });
  }
}

/**
 * 可选认证：不强制要求登录，但如果有 token 则解析用户信息
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    // 未登录也允许继续，user 为 undefined
  }
}
