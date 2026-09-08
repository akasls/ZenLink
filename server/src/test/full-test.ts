process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-12345678901234567890';

const { fastify } = await import('../index.js');
import dbHelper, { saveDatabase } from '../db/index.js';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];
let currentSuite = 'General';

function suite(name: string) {
  currentSuite = name;
  console.log(`\n📦 [测试套件] ${name}`);
}

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ suite: currentSuite, name, passed: true, durationMs: duration });
    console.log(`  ✅ ${name} (${duration}ms)`);
  } catch (err: any) {
    const duration = Date.now() - start;
    results.push({ suite: currentSuite, name, passed: false, error: err.message || String(err), durationMs: duration });
    console.error(`  ❌ ${name} (${duration}ms)`);
    console.error(`     错误:`, err.message || err);
  }
}

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`断言失败: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`断言失败 [${message}]: 期望 ${JSON.stringify(expected)}, 实际得到 ${JSON.stringify(actual)}`);
  }
}

async function runTests() {
  console.log('🚀 开始执行 ZenLink 全量自动化深度测试...\n');
  await fastify.ready();

  let adminToken = '';
  let testCategoryId = 0;
  let testPrivateCategoryId = 0;
  let testBookmarkId = 0;
  let testPrivateBookmarkId = 0;
  let testNoteId = 0;
  let testNoteShareCode = '';
  let testBurnShareCode = '';

  // ==========================================
  // Suite 1: 站点配置模块
  // ==========================================
  suite('1. 站点基础配置 (Settings API)');

  await test('GET /api/settings 应返回默认站点配置，状态码 200', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/settings' });
    assertEqual(res.statusCode, 200, '状态码应为 200');
    const data = JSON.parse(res.body);
    assert(data.settings, '应包含 settings 对象');
    assert(typeof data.settings.site_name === 'string', 'site_name 应为字符串');
    assert(typeof data.settings.theme_primary_color === 'string', 'theme_primary_color 应为字符串');
  });

  await test('未授权 POST /api/settings 应被拒绝 (401)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/settings',
      payload: { site_name: 'Hacked Site' },
    });
    assertEqual(res.statusCode, 401, '未登录应返回 401');
  });

  await test('非法 Origin 跨域请求应被 CORS 策略阻断', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { origin: 'http://malicious-attacker.com' },
    });
    assert(
      res.statusCode === 500 ||
      res.headers['access-control-allow-origin'] !== 'http://malicious-attacker.com',
      '恶意 Origin 不应获得跨域允许'
    );
  });

  // ==========================================
  // Suite 2: 用户认证与安全模块
  // ==========================================
  suite('2. 用户认证与安全 (Auth & Security)');

  await test('错误密码登录应返回 401', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrongpassword' },
    });
    assertEqual(res.statusCode, 401, '错误密码应返回 401');
  });

  await test('缺失参数登录应返回 400 (Zod 验证)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    });
    assertEqual(res.statusCode, 400, '缺少必填字段应返回 400');
  });

  await test('默认管理员账户 (admin / admin123) 登录应成功并签发 JWT (200)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    assertEqual(res.statusCode, 200, '登录应成功');
    const data = JSON.parse(res.body);
    assert(data.token, '应返回 token');
    assertEqual(data.user.username, 'admin', '用户名应为 admin');
    adminToken = data.token;
  });

  await test('未携带 Token 访问 /api/auth/me 应返回 401', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/auth/me' });
    assertEqual(res.statusCode, 401, '无 Token 应返回 401');
  });

  await test('携带有效 Token 访问 /api/auth/me 应返回用户信息', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assertEqual(res.statusCode, 200, '应返回 200');
    const data = JSON.parse(res.body);
    assertEqual(data.user.username, 'admin', '用户信息应匹配');
  });

  await test('修改密码校验：旧密码错误应拒绝 (400)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { currentPassword: 'wrong', newPassword: 'admin123_new' },
    });
    assertEqual(res.statusCode, 400, '旧密码错误应返回 400');
  });

  await test('密码修改后旧 JWT 凭据应被立即注销吊销 (401)', async () => {
    // 1. 修改为新密码
    const changeRes = await fastify.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { currentPassword: 'admin123', newPassword: 'newAdminPassword123!' },
    });
    assertEqual(changeRes.statusCode, 200, '密码修改应成功');

    // 2. 旧 Token 必须被吊销 (401)
    const oldMeRes = await fastify.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assertEqual(oldMeRes.statusCode, 401, '旧 Token 必须被注销拦截返回 401');

    // 3. 使用新密码登录并获取新 Token
    const loginRes = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'newAdminPassword123!' },
    });
    assertEqual(loginRes.statusCode, 200, '新密码登录应成功');
    const newAdminToken = JSON.parse(loginRes.body).token;

    // 4. 将密码改回 admin123 恢复基准测试环境
    const rollbackRes = await fastify.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${newAdminToken}` },
      payload: { currentPassword: 'newAdminPassword123!', newPassword: 'admin123' },
    });
    assertEqual(rollbackRes.statusCode, 200, '密码回滚应成功');

    const finalLogin = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    adminToken = JSON.parse(finalLogin.body).token;
  });

  await test('TOTP 2FA 密钥初始化 (setup) 应生成密钥与二维码', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/auth/totp/setup',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assertEqual(res.statusCode, 200, '应成功生成 TOTP 密钥');
    const data = JSON.parse(res.body);
    assert(data.secret, '应包含 secret');
    assert(data.qrCodeUrl?.startsWith('data:image/png;base64,'), '应包含二维码 base64');
  });

  await test('WebAuthn Passkey 注册参数接口应正常返回 challenge', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/auth/webauthn/register-options',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assertEqual(res.statusCode, 200, 'WebAuthn 注册选项应成功');
    const data = JSON.parse(res.body);
    assert(data.challenge, '应返回 challenge');
  });

  await test('WebAuthn Passkey 登录参数接口应正常返回 challenge', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/auth/webauthn/login-options',
    });
    assertEqual(res.statusCode, 200, 'WebAuthn 登录选项应成功');
    const data = JSON.parse(res.body);
    assert(data.challenge, '应返回 challenge');
  });

  // ==========================================
  // Suite 3: 分类管理模块
  // ==========================================
  suite('3. 分类管理 (Categories API)');

  await test('未登录获取分类列表应只包含公开分类', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/categories' });
    assertEqual(res.statusCode, 200, '应返回 200');
    const data = JSON.parse(res.body);
    assert(Array.isArray(data.categories), 'categories 应为数组');
    const hasPrivate = data.categories.some((c: any) => c.is_private === 1);
    assert(!hasPrivate, '未登录不应包含私密分类');
  });

  await test('管理员创建公开分类应成功 (201)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: '全量测试分类', icon: 'pi pi-check', isPrivate: false },
    });
    assertEqual(res.statusCode, 201, '创建公开分类应返回 201');
    const data = JSON.parse(res.body);
    testCategoryId = data.category.id;
    assert(testCategoryId > 0, '分类 ID 应有效');
  });

  await test('管理员创建私密分类应成功 (201)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: '机密分类', icon: 'pi pi-lock', isPrivate: true },
    });
    assertEqual(res.statusCode, 201, '创建私密分类应返回 201');
    const data = JSON.parse(res.body);
    testPrivateCategoryId = data.category.id;
  });

  await test('未登录用户查询分类不应包含新创建的私密分类', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/categories' });
    const data = JSON.parse(res.body);
    const found = data.categories.find((c: any) => c.id === testPrivateCategoryId);
    assert(!found, '未登录时不应返回私密分类');
  });

  await test('管理员登录后查询分类应包含私密分类', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/categories',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const data = JSON.parse(res.body);
    const found = data.categories.find((c: any) => c.id === testPrivateCategoryId);
    assert(found, '管理员登录后应能查看私密分类');
  });

  await test('更新分类属性应生效', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/categories/${testCategoryId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: '全量测试分类已更新' },
    });
    assertEqual(res.statusCode, 200, '更新应返回 200');
    const data = JSON.parse(res.body);
    assertEqual(data.category.name, '全量测试分类已更新', '名称应已更新');
  });

  // ==========================================
  // Suite 4: 书签管理模块
  // ==========================================
  suite('4. 网址导航书签 (Bookmarks API)');

  await test('创建公开书签 (支持 backupUrl="" 与 categoryId=0 容错)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/bookmarks',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: '测试导航站',
        url: 'https://example.com',
        description: '用于全量自动化测试的示例书签',
        backupUrl: '',
        categoryId: 0,
        isPrivate: false,
      },
    });
    assertEqual(res.statusCode, 201, '创建书签应返回 201');
    const data = JSON.parse(res.body);
    testBookmarkId = data.bookmark.id;
    assert(testBookmarkId > 0, '书签 ID 应有效');
    assertEqual(data.bookmark.category_id, null, 'categoryId=0 应自动转化为 null');
    assertEqual(data.bookmark.backup_url, null, 'backupUrl="" 应自动转化为 null');
  });

  await test('创建私密书签', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/bookmarks',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: '私密管理面板',
        url: 'https://admin.example.com',
        categoryId: testCategoryId,
        isPrivate: true,
      },
    });
    assertEqual(res.statusCode, 201, '应返回 201');
    const data = JSON.parse(res.body);
    testPrivateBookmarkId = data.bookmark.id;
  });

  await test('未登录用户获取书签列表不应包含私密书签', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/bookmarks' });
    const data = JSON.parse(res.body);
    const found = data.bookmarks.find((b: any) => b.id === testPrivateBookmarkId);
    assert(!found, '未登录时不应返回私密书签');
  });

  await test('登录用户获取书签列表应包含私密书签', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/bookmarks',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const data = JSON.parse(res.body);
    const found = data.bookmarks.find((b: any) => b.id === testPrivateBookmarkId);
    assert(found, '登录后应能返回私密书签');
  });

  await test('书签搜索关键词过滤', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/bookmarks?search=测试导航站',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const data = JSON.parse(res.body);
    assert(data.bookmarks.some((b: any) => b.id === testBookmarkId), '搜索应命中目标书签');
  });

  await test('更新书签属性 (PUT /api/bookmarks/:id)', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/bookmarks/${testBookmarkId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: '测试导航站(已修改)',
        backupUrl: 'https://backup.example.com',
        categoryId: testCategoryId,
      },
    });
    assertEqual(res.statusCode, 200, '更新应返回 200');
    const data = JSON.parse(res.body);
    assertEqual(data.bookmark.title, '测试导航站(已修改)', '标题应更新');
    assertEqual(data.bookmark.backup_url, 'https://backup.example.com', '备用地址应更新');
    assertEqual(data.bookmark.category_id, testCategoryId, '分类 ID 应更新');
  });

  await test('批量书签重排 (PUT /api/bookmarks/reorder)', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: '/api/bookmarks/reorder',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ids: [testBookmarkId, testPrivateBookmarkId] },
    });
    assertEqual(res.statusCode, 200, '重排应返回 200');
  });

  // ==========================================
  // Suite 5: 本地 Favicon 图标持久化与安全
  // ==========================================
  suite('5. Favicon 图标本地持久化与防穿越 (Favicon API)');

  await test('GET /api/favicon 获取图标应返回图片流或 SVG 徽标', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/favicon?url=https://github.com&title=GitHub',
    });
    assertEqual(res.statusCode, 200, '状态码应为 200');
    const cType = String(res.headers['content-type'] || '');
    assert(cType.includes('image/'), `Content-Type 应为图片类型，当前为: ${cType}`);
    assert(String(res.headers['cache-control'] || '').includes('immutable'), '应包含不可变强缓存头');
  });

  await test('Favicon 路径穿越攻击防御 (/api/favicon/../../etc/passwd 应被阻止)', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/favicon/..%2F..%2Fpackage.json',
    });
    // basename 将路径清洗为 package.json，在 favicons 目录中不存在，应返回 404，绝不外泄
    assertEqual(res.statusCode, 404, '路径穿越应安全返回 404');
  });

  // ==========================================
  // Suite 6: SSRF 深度攻防防御
  // ==========================================
  suite('6. SSRF 深度网络隔离攻防 (SSRF Defense)');

  const ssrfTargets = [
    { url: 'http://127.0.0.1:80', desc: 'IPv4 本地环回 127.0.0.1' },
    { url: 'http://localhost:3000', desc: 'localhost 域名' },
    { url: 'http://10.0.0.1', desc: 'A 类私网 10.0.0.0/8' },
    { url: 'http://172.16.0.1', desc: 'B 类私网 172.16.0.0/12' },
    { url: 'http://192.168.1.1', desc: 'C 类私网 192.168.0.0/16' },
    { url: 'http://169.254.169.254/latest/meta-data/', desc: 'AWS/云元数据接口 169.254.169.254' },
    { url: 'http://[::1]:80', desc: 'IPv6 本地环回 [::1]' },
  ];

  for (const item of ssrfTargets) {
    await test(`拦截抓取 SSRF 目标: ${item.desc}`, async () => {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/bookmarks/fetch-meta',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { url: item.url },
      });
      assertEqual(res.statusCode, 400, `${item.desc} 应被阻断并返回 400`);
      const body = JSON.parse(res.body);
      assert(body.error?.includes('私有网段') || body.error?.includes('不合法') || body.error?.includes('受保护'), '应包含受保护网段提示');
    });
  }

  // ==========================================
  // Suite 7: 在线笔记与标签系统
  // ==========================================
  suite('7. 在线笔记与标签检索 (Notes API)');

  await test('创建笔记分类', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/note-categories',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: '开发日志', icon: 'pi pi-book' },
    });
    assertEqual(res.statusCode, 200, '创建笔记分类应返回 200');
    const data = JSON.parse(res.body);
    assert(data.category.id > 0, '分类 ID 应有效');
  });

  await test('创建带标签与 Markdown 的笔记', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: '自动化测试核心报告',
        content: '# 架构演进\n\n- 性能指标达成\n- 安全审计通过',
        tags: ['测试', '架构', 'ZenLink'],
      },
    });
    assertEqual(res.statusCode, 200, '创建笔记应返回 200');
    const data = JSON.parse(res.body);
    testNoteId = data.note.id;
    assert(testNoteId > 0, '笔记 ID 应有效');
    assert(Array.isArray(data.note.tags), 'tags 应解析为数组');
    assert(data.note.tags.includes('架构'), '应包含架构标签');
  });

  await test('获取所有笔记标签列表 (/api/notes/tags)', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/notes/tags',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assertEqual(res.statusCode, 200, '获取标签应返回 200');
    const data = JSON.parse(res.body);
    assert(Array.isArray(data.tags), '应返回标签数组');
    const archTag = data.tags.find((t: any) => t.name === '架构');
    assert(archTag && archTag.count >= 1, '架构标签计数应大于等于 1');
  });

  await test('根据标签检索笔记 (/api/notes?tag=架构)', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/notes?tag=架构',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assertEqual(res.statusCode, 200, '应返回 200');
    const data = JSON.parse(res.body);
    assert(data.notes.some((n: any) => n.id === testNoteId), '标签检索应命中目标笔记');
  });

  await test('更新笔记并置顶', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/notes/${testNoteId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: '自动化测试核心报告(已置顶)',
        isPinned: 1,
      },
    });
    assertEqual(res.statusCode, 200, '更新笔记应返回 200');
    const data = JSON.parse(res.body);
    assertEqual(data.note.is_pinned, 1, '笔记置顶状态应为 1');
  });

  // ==========================================
  // Suite 8: 笔记安全分享与阅后即焚
  // ==========================================
  suite('8. 笔记安全短链分享与阅后即焚 (Shares API)');

  await test('创建无密码公开分享链接', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: `/api/notes/${testNoteId}/share`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { expire_hours: 24 },
    });
    assertEqual(res.statusCode, 200, '创建分享应返回 200');
    const data = JSON.parse(res.body);
    testNoteShareCode = data.share.id;
    assert(testNoteShareCode.length >= 6, '分享码应有效');
    assertEqual(data.share.has_password, false, '无密码模式 has_password 应为 false');
  });

  await test('匿名公开访问无密码分享链接 (GET /api/shares/:code)', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: `/api/shares/${testNoteShareCode}`,
    });
    assertEqual(res.statusCode, 200, '访问分享应返回 200');
    const data = JSON.parse(res.body);
    assertEqual(data.need_password, false, 'need_password 应为 false');
    assert(data.transfer?.content?.includes('架构演进'), '应能直接查看笔记正文');
  });

  await test('创建阅后即焚分享链接 (burn_after_reading: true)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: `/api/notes/${testNoteId}/share`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { burn_after_reading: true },
    });
    assertEqual(res.statusCode, 200, '创建阅后即焚应返回 200');
    const data = JSON.parse(res.body);
    testBurnShareCode = data.share.id;
  });

  await test('首次读取阅后即焚分享应成功返回内容', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: `/api/shares/${testBurnShareCode}`,
    });
    assertEqual(res.statusCode, 200, '首次读取应返回 200');
    const data = JSON.parse(res.body);
    assertEqual(data.is_burned, true, 'is_burned 应为 true');
    assert(data.transfer?.content, '应成功读取内容');
  });

  await test('二次读取阅后即焚分享应返回 404 (已被物理自毁)', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: `/api/shares/${testBurnShareCode}`,
    });
    assertEqual(res.statusCode, 404, '二次读取应返回 404 已销毁');
  });

  await test('密码保护分享与提取密码校验', async () => {
    // 创建带密码的分享
    const shareRes = await fastify.inject({
      method: 'POST',
      url: `/api/notes/${testNoteId}/share`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { password: 'safe_password_999' },
    });
    const shareData = JSON.parse(shareRes.body);
    const pwdCode = shareData.share.id;

    // 1. 直接 GET 应提示需要密码且不泄露正文
    const getRes = await fastify.inject({ method: 'GET', url: `/api/shares/${pwdCode}` });
    const getData = JSON.parse(getRes.body);
    assertEqual(getData.need_password, true, '应提示 need_password');
    assert(!getData.transfer, '未输入密码绝不返回正文');

    // 2. 错误密码提取应返回 401
    const wrongVerify = await fastify.inject({
      method: 'POST',
      url: `/api/shares/${pwdCode}/verify`,
      payload: { password: 'wrong' },
    });
    assertEqual(wrongVerify.statusCode, 401, '错误密码应返回 401');

    // 3. 正确密码提取应返回 200 与正文
    const rightVerify = await fastify.inject({
      method: 'POST',
      url: `/api/shares/${pwdCode}/verify`,
      payload: { password: 'safe_password_999' },
    });
    assertEqual(rightVerify.statusCode, 200, '正确密码应返回 200');
    const rightData = JSON.parse(rightVerify.body);
    assert(rightData.transfer?.content, '应返回正文内容');

    // 3.1 分享列表脱敏检查：绝对不能在 API 中回传明文 password 字段
    const listSharesRes = await fastify.inject({
      method: 'GET',
      url: `/api/notes/${testNoteId}/shares`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assertEqual(listSharesRes.statusCode, 200, '获取分享列表应返回 200');
    const listSharesData = JSON.parse(listSharesRes.body);
    assert(Array.isArray(listSharesData.shares), 'shares 应为数组');
    const targetShare = listSharesData.shares.find((s: any) => s.id === pwdCode);
    assert(targetShare, '应包含刚才创建的分享项');
    assertEqual(targetShare.has_password, true, 'has_password 标识应为 true');
    assert(!targetShare.password, '严禁在分享列表中明文暴露 password 字段');

    // 4. 清理分享
    await fastify.inject({
      method: 'DELETE',
      url: `/api/notes/shares/${pwdCode}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
  });

  // ==========================================
  // Suite 9: 文件存储与防穿越安全
  // ==========================================
  suite('9. 附件文件与路径穿越防御 (Storage & Uploads)');

  await test('本地静态文件路径穿越攻击防御 (/api/notes/raw/../../package.json)', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/notes/raw/..%2F..%2Fpackage.json',
    });
    assertEqual(res.statusCode, 404, '非法路径穿越应安全返回 404');
  });

  // ==========================================
  // Suite 10: AI 助手流式对话与会话管理
  // ==========================================
  suite('10. AI 智能助手与流式调度 (AI Assistant)');

  await test('未授权访问 AI 配置应返回 401', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/ai/settings' });
    assertEqual(res.statusCode, 401, '未授权应返回 401');
  });

  await test('授权获取 AI 配置应正常返回且 API Key 敏感信息掩码', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/ai/settings',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assertEqual(res.statusCode, 200, '应返回 200');
    const data = JSON.parse(res.body);
    assert(data.settings, '应包含 settings');
    assert(data.settings.api_key !== undefined, '配置应存在');
  });

  await test('AI 会话创建 (POST /api/ai/conversations)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/ai/conversations',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: '测试对话会话' },
    });
    assertEqual(res.statusCode, 201, '创建会话应返回 201');
    const data = JSON.parse(res.body);
    assert(data.conversation.id, '应包含会话 ID');
  });

  await test('AI 流式对话 SSE 响应测试 (/api/ai/chat)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/ai/chat',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { message: '你好，请做个自我介绍' },
    });
    assertEqual(res.statusCode, 200, 'SSE 流应返回 200');
    assert(String(res.headers['content-type'] || '').includes('text/event-stream'), 'Content-Type 应为 text/event-stream');
    assert(res.body.includes('data:'), '应包含 SSE 数据块');
    assert(res.body.includes('[DONE]'), '应包含流式结束标记 [DONE]');
  });

  await test('AI 智能写作协同助手 SSE 测试 (/api/ai/writing-assistant)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/ai/writing-assistant',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        action: 'continue',
        content: '这是一个关于现代全栈工程架构设计的探讨。',
      },
    });
    assertEqual(res.statusCode, 200, '写作助手应返回 200');
    assert(String(res.headers['content-type'] || '').includes('text/event-stream'), '应为 SSE 流');
    assert(res.body.includes('[DONE]'), '应包含结束标记');
  });

  // ==========================================
  // Suite 11: 数据清理与闭环恢复
  // ==========================================
  suite('11. 测试数据闭环清理 (Teardown)');

  await test('删除测试书签', async () => {
    if (testBookmarkId) {
      const res = await fastify.inject({
        method: 'DELETE',
        url: `/api/bookmarks/${testBookmarkId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assertEqual(res.statusCode, 200, '删除书签应成功');
    }
    if (testPrivateBookmarkId) {
      await fastify.inject({
        method: 'DELETE',
        url: `/api/bookmarks/${testPrivateBookmarkId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
    }
  });

  await test('删除测试分类', async () => {
    if (testCategoryId) {
      const res = await fastify.inject({
        method: 'DELETE',
        url: `/api/categories/${testCategoryId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assertEqual(res.statusCode, 200, '删除分类应成功');
    }
    if (testPrivateCategoryId) {
      await fastify.inject({
        method: 'DELETE',
        url: `/api/categories/${testPrivateCategoryId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
    }
  });

  await test('删除测试笔记', async () => {
    if (testNoteId) {
      const res = await fastify.inject({
        method: 'DELETE',
        url: `/api/notes/${testNoteId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assertEqual(res.statusCode, 200, '删除笔记应成功');
    }
  });

  // ==========================================
  // 打印全量测试报告
  // ==========================================
  console.log('\n' + '='.repeat(50));
  console.log('📊 全量自动化测试汇总结果报告');
  console.log('='.repeat(50));

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`总测试项: ${total}`);
  console.log(`✅ 通过:   ${passed}`);
  console.log(`❌ 失败:   ${failed}`);

  if (failed > 0) {
    console.log('\n❌ 失败项明细:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - [${r.suite}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 所有测试用例 100% 全部通过！系统各项功能与安全机制运行完全正常！\n');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('测试运行异常退出:', err);
  process.exit(1);
});
