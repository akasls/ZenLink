import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { z } from 'zod';
import dbHelper, { saveDatabase } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

// WebAuthn 配置
const RP_NAME = 'ZenLink';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173';

// 临时存储 WebAuthn challenge（带 TTL 过期保护与并发防冲突）
interface StoredChallenge {
  challenge: string;
  expiresAt: number;
}
const regChallengeStore = new Map<number, StoredChallenge>();
const loginChallengeStore = new Map<string, number>();

// 定期清理过期 challenge
setInterval(() => {
  const now = Date.now();
  for (const [uid, item] of regChallengeStore.entries()) {
    if (item.expiresAt < now) regChallengeStore.delete(uid);
  }
  for (const [challenge, exp] of loginChallengeStore.entries()) {
    if (exp < now) loginChallengeStore.delete(challenge);
  }
}, 60000);

// 登录防爆破滑动限制器 (同一 IP 连续 5 次失败锁定 15 分钟)
interface AttemptRecord {
  count: number;
  lockedUntil: number;
}
const loginAttempts = new Map<string, AttemptRecord>();

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // ==================== 密码登录 ====================

  const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    totpCode: z.string().optional(),
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const clientIp = request.ip || 'unknown';
    const now = Date.now();
    const attempt = loginAttempts.get(clientIp);

    if (attempt && attempt.lockedUntil > now) {
      const waitMin = Math.ceil((attempt.lockedUntil - now) / 60000);
      return reply.status(429).send({ error: `尝试次数过多，请 ${waitMin} 分钟后再试` });
    }

    const body = loginSchema.parse(request.body);

    const user = dbHelper.get('SELECT * FROM users WHERE username = ?', [body.username]);
    if (!user) {
      const rec = loginAttempts.get(clientIp) || { count: 0, lockedUntil: 0 };
      rec.count += 1;
      if (rec.count >= 5) rec.lockedUntil = now + 15 * 60 * 1000;
      loginAttempts.set(clientIp, rec);
      return reply.status(401).send({ error: '用户名或密码错误' });
    }

    const validPassword = bcrypt.compareSync(body.password, user.password_hash);
    if (!validPassword) {
      const rec = loginAttempts.get(clientIp) || { count: 0, lockedUntil: 0 };
      rec.count += 1;
      if (rec.count >= 5) rec.lockedUntil = now + 15 * 60 * 1000;
      loginAttempts.set(clientIp, rec);
      return reply.status(401).send({ error: '用户名或密码错误' });
    }

    // 检查是否启用了 2FA
    if (user.totp_enabled) {
      if (!body.totpCode) {
        return reply.status(200).send({ requireTotp: true, message: '请输入动态验证码' });
      }
      const isValid = authenticator.verify({ token: body.totpCode, secret: user.totp_secret });
      if (!isValid) {
        return reply.status(401).send({ error: '动态验证码错误' });
      }
    }

    // 登录成功，清除失败计数
    loginAttempts.delete(clientIp);

    // 签发 JWT
    const token = fastify.jwt.sign(
      { userId: user.id, username: user.username },
      { expiresIn: '7d' }
    );

    return { token, user: { id: user.id, username: user.username } };
  });

  // ==================== TOTP 2FA ====================

  fastify.post('/api/auth/totp/setup', { preHandler: [requireAuth] }, async (request) => {
    const { userId } = request.user as any;
    const user = dbHelper.get('SELECT * FROM users WHERE id = ?', [userId]);

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.username, RP_NAME, secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    dbHelper.run('UPDATE users SET totp_secret = ? WHERE id = ?', [secret, userId]);
    saveDatabase();

    return { secret, qrCodeUrl };
  });

  fastify.post('/api/auth/totp/verify', { preHandler: [requireAuth] }, async (request, reply) => {
    const { userId } = request.user as any;
    const { code } = request.body as { code: string };

    const user = dbHelper.get('SELECT totp_secret FROM users WHERE id = ?', [userId]);
    if (!user?.totp_secret) {
      return reply.status(400).send({ error: '请先设置 TOTP' });
    }

    const isValid = authenticator.verify({ token: code, secret: user.totp_secret });
    if (!isValid) {
      return reply.status(400).send({ error: '验证码错误，请重试' });
    }

    dbHelper.run('UPDATE users SET totp_enabled = 1 WHERE id = ?', [userId]);
    saveDatabase();
    return { success: true, message: '2FA 已启用' };
  });

  // ==================== WebAuthn (Passkey) ====================

  fastify.post('/api/auth/webauthn/register-options', { preHandler: [requireAuth] }, async (request) => {
    const { userId, username } = request.user as any;

    const existingCredentials = dbHelper.all(
      'SELECT id, transports FROM webauthn_credentials WHERE user_id = ?',
      [userId]
    );

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: String(userId),
      userName: username,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((cred: any) => ({
        id: Buffer.from(cred.id, 'base64url'),
        type: 'public-key' as const,
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    regChallengeStore.set(userId, { challenge: options.challenge, expiresAt: Date.now() + 5 * 60 * 1000 });
    return options;
  });

  fastify.post('/api/auth/webauthn/register-verify', { preHandler: [requireAuth] }, async (request, reply) => {
    const { userId } = request.user as any;
    const body = request.body as RegistrationResponseJSON;

    const stored = regChallengeStore.get(userId);
    if (!stored || stored.expiresAt < Date.now()) {
      regChallengeStore.delete(userId);
      return reply.status(400).send({ error: 'Challenge 已过期，请重试' });
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: stored.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      });

      if (verification.verified && verification.registrationInfo) {
        const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

        dbHelper.run(
          'INSERT INTO webauthn_credentials (id, user_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)',
          [
            Buffer.from(credentialID).toString('base64url'),
            userId,
            Buffer.from(credentialPublicKey).toString('base64url'),
            counter,
            JSON.stringify((body.response as any).transports || []),
          ]
        );

        dbHelper.run('UPDATE users SET webauthn_enabled = 1 WHERE id = ?', [userId]);
        saveDatabase();
        regChallengeStore.delete(userId);

        return { success: true, message: 'Passkey 注册成功' };
      }

      return reply.status(400).send({ error: '验证失败' });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  fastify.post('/api/auth/webauthn/login-options', async () => {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
    });

    loginChallengeStore.set(options.challenge, Date.now() + 5 * 60 * 1000);
    return options;
  });

  fastify.post('/api/auth/webauthn/login-verify', async (request, reply) => {
    const body = request.body as AuthenticationResponseJSON;

    // 解析 clientDataJSON 获取 challenge
    let clientChallenge = '';
    try {
      const rawClientData = Buffer.from((body.response as any).clientDataJSON, 'base64url').toString('utf8');
      const parsedData = JSON.parse(rawClientData);
      clientChallenge = parsedData.challenge;
    } catch {}

    const expiresAt = loginChallengeStore.get(clientChallenge);
    if (!expiresAt || expiresAt < Date.now()) {
      loginChallengeStore.delete(clientChallenge);
      return reply.status(400).send({ error: 'Challenge 已过期或无效，请重新尝试登录' });
    }

    const credentialId = body.id;
    const credential = dbHelper.get(
      'SELECT * FROM webauthn_credentials WHERE id = ?',
      [credentialId]
    );

    if (!credential) {
      return reply.status(400).send({ error: '未找到对应的 Passkey 凭据' });
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: clientChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        authenticator: {
          credentialID: Buffer.from(credential.id, 'base64url'),
          credentialPublicKey: Buffer.from(credential.public_key, 'base64url'),
          counter: credential.counter,
        },
      });

      if (verification.verified) {
        dbHelper.run(
          'UPDATE webauthn_credentials SET counter = ? WHERE id = ?',
          [verification.authenticationInfo.newCounter, credential.id]
        );
        saveDatabase();

        const user = dbHelper.get('SELECT id, username FROM users WHERE id = ?', [credential.user_id]);

        const token = fastify.jwt.sign(
          { userId: user.id, username: user.username },
          { expiresIn: '7d' }
        );

        loginChallengeStore.delete(clientChallenge);
        return { token, user: { id: user.id, username: user.username } };
      }

      return reply.status(400).send({ error: '验证失败' });
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  // ==================== 用户信息 ====================

  fastify.get('/api/auth/me', { preHandler: [requireAuth] }, async (request) => {
    const { userId } = request.user as any;
    const user = dbHelper.get(
      'SELECT id, username, totp_enabled, webauthn_enabled, created_at FROM users WHERE id = ?',
      [userId]
    );
    return { user };
  });

  // ==================== 修改密码 ====================

  fastify.post('/api/auth/change-password', { preHandler: [requireAuth] }, async (request, reply) => {
    const { userId } = request.user as any;
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return reply.status(400).send({ error: '新密码至少6位' });
    }

    const user = dbHelper.get('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return reply.status(400).send({ error: '当前密码错误' });
    }

    const newHash = bcrypt.hashSync(newPassword, 12);
    dbHelper.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
    saveDatabase();

    return { success: true, message: '密码已修改' };
  });

  // ==================== 修改用户名 ====================

  fastify.post('/api/auth/change-username', { preHandler: [requireAuth] }, async (request, reply) => {
    const { userId } = request.user as any;
    const { newUsername } = request.body as { newUsername: string };

    if (!newUsername || newUsername.length < 2) {
      return reply.status(400).send({ error: '用户名至少2个字符' });
    }

    // 检查是否已存在
    const existing = dbHelper.get('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, userId]);
    if (existing) {
      return reply.status(400).send({ error: '用户名已被使用' });
    }

    dbHelper.run('UPDATE users SET username = ? WHERE id = ?', [newUsername, userId]);
    saveDatabase();

    return { success: true, message: '用户名已修改' };
  });
}
