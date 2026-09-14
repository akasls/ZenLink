import dbHelper, { saveDatabase } from './index.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * 初始化种子数据：创建默认管理员账户、分类和示例书签
 */
export function seedDatabase(): void {
  const result = dbHelper.get('SELECT COUNT(*) as count FROM users');
  if (result && result.count > 0) {
    // 允许通过环境变量 ADMIN_PASSWORD 或 RESET_ADMIN_PASSWORD 强制重置已存在的数据卷密码
    const targetPassword = process.env.RESET_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (targetPassword) {
      const hash = bcrypt.hashSync(targetPassword, 12);
      dbHelper.run('UPDATE users SET password_hash = ?, totp_enabled = 0, totp_secret = NULL WHERE username = ?', [hash, 'admin']);
      saveDatabase();
      console.log(`🔐 管理员密码已通过环境变量同步/重置为指定密码`);
    }
    return;
  }

  console.log('🌱 正在创建种子数据...');

  // 创建默认管理员 (默认口令: admin123，支持通过环境变量 ADMIN_PASSWORD 或 INITIAL_ADMIN_PASSWORD 自定义)
  const initialPassword = process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || 'admin123';
  const passwordHash = bcrypt.hashSync(initialPassword, 12);
  dbHelper.run('INSERT INTO users (username, password_hash, token_version) VALUES (?, ?, 1)', ['admin', passwordHash]);
  console.log(`✅ 默认管理员账户创建完成 (用户名: admin / 默认密码: ${initialPassword})`);

  // ===== 一级分类 =====
  const topCategories = [
    ['常用工具', 'pi pi-wrench', 1, 0],
    ['开发资源', 'pi pi-code', 2, 0],
    ['设计素材', 'pi pi-palette', 3, 0],
    ['学习教程', 'pi pi-book', 4, 0],
  ];

  for (const [name, icon, sortOrder, isPrivate] of topCategories) {
    dbHelper.run(
      'INSERT INTO categories (name, icon, sort_order, is_private) VALUES (?, ?, ?, ?)',
      [name, icon, sortOrder, isPrivate]
    );
  }

  // ===== 二级分类 =====
  // 常用工具(id=1) 的子分类
  dbHelper.run('INSERT INTO categories (name, icon, sort_order, is_private, parent_id) VALUES (?, ?, ?, ?, ?)', ['效率工具', 'pi pi-bolt', 1, 0, 1]);
  dbHelper.run('INSERT INTO categories (name, icon, sort_order, is_private, parent_id) VALUES (?, ?, ?, ?, ?)', ['AI 助手', 'pi pi-microchip', 2, 0, 1]);
  dbHelper.run('INSERT INTO categories (name, icon, sort_order, is_private, parent_id) VALUES (?, ?, ?, ?, ?)', ['在线转换', 'pi pi-sync', 3, 0, 1]);

  // 开发资源(id=2) 的子分类
  dbHelper.run('INSERT INTO categories (name, icon, sort_order, is_private, parent_id) VALUES (?, ?, ?, ?, ?)', ['前端框架', 'pi pi-desktop', 1, 0, 2]);
  dbHelper.run('INSERT INTO categories (name, icon, sort_order, is_private, parent_id) VALUES (?, ?, ?, ?, ?)', ['后端服务', 'pi pi-server', 2, 0, 2]);
  dbHelper.run('INSERT INTO categories (name, icon, sort_order, is_private, parent_id) VALUES (?, ?, ?, ?, ?)', ['DevOps', 'pi pi-cloud', 3, 0, 2]);

  // 设计素材(id=3) 的子分类
  dbHelper.run('INSERT INTO categories (name, icon, sort_order, is_private, parent_id) VALUES (?, ?, ?, ?, ?)', ['图标素材', 'pi pi-image', 1, 0, 3]);
  dbHelper.run('INSERT INTO categories (name, icon, sort_order, is_private, parent_id) VALUES (?, ?, ?, ?, ?)', ['配色工具', 'pi pi-palette', 2, 0, 3]);

  // ===== 示例书签 =====
  const bookmarks = [
    // 常用工具 - 效率工具 (cat_id=6)
    ['Notion', '一体化工作空间', 'https://www.notion.so', null, 'https://www.notion.so/images/favicon.ico', 6, 0, 1],
    ['Todoist', '任务管理工具', 'https://todoist.com', null, 'https://todoist.com/favicon.ico', 6, 0, 2],
    // 常用工具 - AI 助手 (cat_id=7)
    ['ChatGPT', 'OpenAI 对话 AI', 'https://chat.openai.com', null, 'https://chat.openai.com/favicon.ico', 7, 0, 1],
    ['Claude', 'Anthropic AI 助手', 'https://claude.ai', null, 'https://claude.ai/favicon.ico', 7, 0, 2],
    // 开发资源 - 前端框架 (cat_id=9)
    ['Vue.js', '渐进式 JavaScript 框架', 'https://vuejs.org', 'https://cn.vuejs.org', 'https://vuejs.org/logo.svg', 9, 0, 1],
    ['React', 'Facebook 前端库', 'https://react.dev', null, 'https://react.dev/favicon.ico', 9, 0, 2],
    ['Svelte', '编译型前端框架', 'https://svelte.dev', null, 'https://svelte.dev/favicon.png', 9, 0, 3],
    // 开发资源 - 后端服务 (cat_id=10)
    ['GitHub', '代码托管平台', 'https://github.com', null, 'https://github.com/favicon.ico', 10, 0, 1],
    ['Docker Hub', '容器镜像仓库', 'https://hub.docker.com', null, 'https://hub.docker.com/favicon.ico', 10, 0, 2],
    // 开发资源 - DevOps (cat_id=11)
    ['Vercel', '前端部署平台', 'https://vercel.com', null, 'https://vercel.com/favicon.ico', 11, 0, 1],
    ['Cloudflare', 'CDN 与安全服务', 'https://www.cloudflare.com', null, 'https://www.cloudflare.com/favicon.ico', 11, 0, 2],
    // 设计素材 - 图标素材 (cat_id=12)
    ['Iconify', '统一图标框架', 'https://iconify.design', null, 'https://iconify.design/favicon.ico', 12, 0, 1],
    ['Lucide', '开源图标库', 'https://lucide.dev', null, 'https://lucide.dev/favicon.ico', 12, 0, 2],
    // 学习教程 (cat_id=4，无子分类)
    ['MDN Web Docs', 'Mozilla 开发者文档', 'https://developer.mozilla.org', null, 'https://developer.mozilla.org/favicon.ico', 4, 0, 1],
    ['freeCodeCamp', '免费编程学习', 'https://www.freecodecamp.org', null, 'https://www.freecodecamp.org/favicon.ico', 4, 0, 2],
  ];

  for (const [title, desc, url, backupUrl, favicon, catId, isPrivate, sortOrder] of bookmarks) {
    dbHelper.run(
      'INSERT INTO bookmarks (title, description, url, backup_url, favicon, category_id, is_private, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, desc, url, backupUrl, favicon, catId, isPrivate, sortOrder]
    );
  }

  saveDatabase();
  console.log('✅ 种子数据创建完成 (管理员: admin / admin123)');
}
