import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import crypto from 'crypto';
import dbHelper, { saveDatabase } from '../db/index.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { fetchSiteMeta, checkUrlStatus, isSafeUrl, isSafeUrlAsync, safeFetch } from '../services/meta-scraper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAVICON_DIR = resolve(__dirname, '../../../data/favicons');
if (!existsSync(FAVICON_DIR)) {
  mkdirSync(FAVICON_DIR, { recursive: true });
}

export default async function bookmarkRoutes(fastify: FastifyInstance): Promise<void> {
  // ==================== 本地永久持久化 Favicon 图标体系 ====================
  const AVATAR_COLORS = [
    '#f1404b', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
    '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
  ];

  function getAvatarSvg(char: string, strForColor: string): Buffer {
    let hash = 0;
    for (let i = 0; i < strForColor.length; i++) {
      hash = strForColor.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    const displayChar = (char || 'Z').trim().charAt(0).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${color}"/><text x="32" y="32" dominant-baseline="central" text-anchor="middle" font-size="28" font-family="system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-weight="600" fill="#ffffff">${displayChar}</text></svg>`;
    return Buffer.from(svg, 'utf-8');
  }

  function getFaviconKey(url?: string, domain?: string, icon?: string): string {
    const str = (domain || url || icon || 'default').toLowerCase().trim();
    return crypto.createHash('md5').update(str).digest('hex');
  }

  function getDiskFavicon(key: string): { buffer: Buffer; contentType: string; filename: string } | null {
    if (!existsSync(FAVICON_DIR)) return null;
    const extensions = ['.png', '.svg', '.ico', '.webp', '.jpg'];
    for (const ext of extensions) {
      const filename = `${key}${ext}`;
      const filePath = join(FAVICON_DIR, filename);
      if (existsSync(filePath)) {
        try {
          const buffer = readFileSync(filePath);
          if (buffer.length > 0) {
            let contentType = 'image/png';
            if (ext === '.svg') contentType = 'image/svg+xml';
            else if (ext === '.ico') contentType = 'image/x-icon';
            else if (ext === '.webp') contentType = 'image/webp';
            else if (ext === '.jpg') contentType = 'image/jpeg';
            return { buffer, contentType, filename };
          }
        } catch {}
      }
    }
    return null;
  }

  function saveDiskFavicon(key: string, buffer: Buffer, contentType: string): string {
    try {
      if (!existsSync(FAVICON_DIR)) {
        mkdirSync(FAVICON_DIR, { recursive: true });
      }
      let ext = '.png';
      if (contentType.includes('svg')) ext = '.svg';
      else if (contentType.includes('icon') || contentType.includes('ico')) ext = '.ico';
      else if (contentType.includes('webp')) ext = '.webp';
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';

      const filename = `${key}${ext}`;
      const filePath = join(FAVICON_DIR, filename);
      writeFileSync(filePath, buffer);
      return `/api/favicon/${filename}`;
    } catch {
      return '';
    }
  }

  async function fetchAndPersistFavicon(targetUrl: string, customIcon: string, siteTitle: string, key: string, domain: string): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    // 1. 优先读取磁盘
    const onDisk = getDiskFavicon(key);
    if (onDisk) {
      return onDisk;
    }

    // 2. 抓取候选列表
    const candidateUrls: string[] = [];
    const isExplicitHD = customIcon && (
      customIcon.includes('.svg') ||
      customIcon.includes('apple-touch') ||
      customIcon.includes('192') ||
      customIcon.includes('180') ||
      customIcon.includes('512')
    );

    if (isExplicitHD && isSafeUrl(customIcon)) {
      candidateUrls.push(customIcon);
    }

    if (domain && isSafeUrl(`https://${domain}`)) {
      candidateUrls.push(`https://${domain}/apple-touch-icon.png`);
      candidateUrls.push(`https://${domain}/favicon.svg`);
      candidateUrls.push(`https://${domain}/favicon.png`);
      candidateUrls.push(`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`);
      candidateUrls.push(`https://api.iowen.cn/favicon/${domain}.png`);
      candidateUrls.push(`https://favicon.pub/v1/${domain}`);
      candidateUrls.push(`https://icon.horse/icon/${domain}`);
      candidateUrls.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
      candidateUrls.push(`https://${domain}/favicon.ico`);
    }

    if (customIcon && !isExplicitHD && !customIcon.startsWith('/api/') && isSafeUrl(customIcon)) {
      if (!candidateUrls.includes(customIcon)) {
        candidateUrls.push(customIcon);
      }
    }

    async function tryFetchIcon(iconUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await safeFetch(iconUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
        });
        clearTimeout(timeout);

        if (res.ok) {
          const contentType = res.headers.get('content-type') || 'image/x-icon';
          if (contentType.includes('image') || contentType.includes('octet-stream')) {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (buffer.length > 30) {
              const actualContentType = contentType.includes('octet-stream') ? 'image/x-icon' : contentType;
              return { buffer, contentType: actualContentType };
            }
          }
        }
      } catch {}
      return null;
    }

    // 并发快速拉取候选图标，取最快返回的有效高清图标
    try {
      const fetchPromises = candidateUrls.map(u => 
        tryFetchIcon(u).then(res => {
          if (res) return res;
          throw new Error('not found');
        })
      );
      const winner = await Promise.any(fetchPromises);
      if (winner && winner.buffer) {
        saveDiskFavicon(key, winner.buffer, winner.contentType);
        const ext = winner.contentType.includes('svg') ? '.svg' : winner.contentType.includes('ico') || winner.contentType.includes('icon') ? '.ico' : winner.contentType.includes('webp') ? '.webp' : '.png';
        return { buffer: winner.buffer, contentType: winner.contentType, filename: `${key}${ext}` };
      }
    } catch {}

    // 3. Fallback 到原生 SVG 徽标并落盘
    const char = siteTitle || domain || targetUrl || 'Z';
    const svgBuffer = getAvatarSvg(char, domain || siteTitle || targetUrl);
    saveDiskFavicon(key, svgBuffer, 'image/svg+xml');
    return { buffer: svgBuffer, contentType: 'image/svg+xml', filename: `${key}.svg` };
  }

  // 静态直读本地缓存文件（极速 1ms 响应）
  fastify.get('/api/favicon/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const safeName = basename(filename);
    const filePath = join(FAVICON_DIR, safeName);
    if (existsSync(filePath)) {
      const ext = safeName.split('.').pop()?.toLowerCase() || 'png';
      let contentType = 'image/png';
      if (ext === 'svg') contentType = 'image/svg+xml';
      else if (ext === 'ico') contentType = 'image/x-icon';
      else if (ext === 'webp') contentType = 'image/webp';
      else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';

      const buffer = readFileSync(filePath);
      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(buffer);
    }
    return reply.status(404).send({ error: 'Favicon not found' });
  });

  // 主 Favicon 获取接口：优先 100% 磁盘读取，彻底避免前台用户浏览时产生外部网络开销
  fastify.get('/api/favicon', async (request, reply) => {
    const { url, icon, title } = request.query as { url?: string; icon?: string; title?: string };
    const targetUrl = url || '';
    const customIcon = icon || '';
    const siteTitle = title || '';

    let domain = '';
    try {
      if (targetUrl) {
        const u = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
        if (isSafeUrl(u)) {
          domain = new URL(u).hostname;
        }
      }
    } catch {}

    const key = getFaviconKey(targetUrl, domain, customIcon);

    // 1. 优先直接从磁盘读取（0 毫秒，0 外部请求）
    const diskCached = getDiskFavicon(key);
    if (diskCached) {
      return reply
        .header('Content-Type', diskCached.contentType)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(diskCached.buffer);
    }

    // 2. 磁盘不存在时拉取并永久落盘
    const result = await fetchAndPersistFavicon(targetUrl, customIcon, siteTitle, key, domain);
    return reply
      .header('Content-Type', result.contentType)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(result.buffer);
  });

  // 后台静默预热：启动后自动缓存所有存量书签图标到本地磁盘
  setTimeout(async () => {
    try {
      const bookmarks = dbHelper.all('SELECT id, title, url, favicon FROM bookmarks');
      for (const bm of bookmarks) {
        try {
          let domain = '';
          if (bm.url) {
            const u = bm.url.startsWith('http') ? bm.url : `https://${bm.url}`;
            domain = new URL(u).hostname;
          }
          const key = getFaviconKey(bm.url, domain, bm.favicon);
          if (!getDiskFavicon(key)) {
            await fetchAndPersistFavicon(bm.url, bm.favicon, bm.title, key, domain);
          }
        } catch {}
      }
    } catch {}
  }, 2000);

  // ==================== 前台获取书签列表 ====================

  fastify.get('/api/bookmarks', { preHandler: [optionalAuth] }, async (request) => {
    const user = (request as any).user;
    const { categoryId, search } = request.query as { categoryId?: string; search?: string };

    let sql = 'SELECT * FROM bookmarks WHERE 1=1';
    const params: any[] = [];

    // 未登录用户只能看到公开书签
    if (!user) {
      sql += ' AND is_private = 0';
    }

    if (categoryId) {
      sql += ' AND category_id = ?';
      params.push(Number(categoryId));
    }

    if (search) {
      sql += ' AND (title LIKE ? OR description LIKE ? OR url LIKE ?)';
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword);
    }

    sql += ' ORDER BY sort_order ASC, created_at DESC';

    const bookmarks = dbHelper.all(sql, params);
    return { bookmarks };
  });

  // ==================== 前台快捷添加书签 ====================

  const createBookmarkSchema = z.object({
    title: z.string().min(1, '标题不能为空').max(200),
    description: z.string().max(500).optional().default(''),
    url: z.string().url('请输入有效的 URL'),
    backupUrl: z.string().url().optional().nullable(),
    favicon: z.string().optional().default(''),
    categoryId: z.number().int().positive().optional().nullable(),
    isPrivate: z.boolean().optional().default(false),
  });

  fastify.post('/api/bookmarks', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const body = createBookmarkSchema.parse(request.body);

      // 获取当前最大 sort_order
      const maxSort = dbHelper.get('SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM bookmarks');
      const sortOrder = (maxSort?.max_sort || 0) + 1;

      const result = dbHelper.run(
        'INSERT INTO bookmarks (title, description, url, backup_url, favicon, category_id, is_private, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [body.title, body.description, body.url, body.backupUrl || null, body.favicon, body.categoryId || null, body.isPrivate ? 1 : 0, sortOrder]
      );

      saveDatabase();

      const bookmark = dbHelper.get('SELECT * FROM bookmarks WHERE id = ?', [result.lastInsertRowid]);
      return reply.status(201).send({ bookmark });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: '参数验证失败', details: error.errors });
      }
      throw error;
    }
  });

  // ==================== 更新书签 ====================

  const updateBookmarkSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional(),
    url: z.string().url().optional(),
    backupUrl: z.string().url().optional().nullable(),
    favicon: z.string().optional(),
    categoryId: z.number().int().positive().optional().nullable(),
    isPrivate: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  });

  fastify.put('/api/bookmarks/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateBookmarkSchema.parse(request.body);

    const existing = dbHelper.get('SELECT * FROM bookmarks WHERE id = ?', [Number(id)]);
    if (!existing) {
      return reply.status(404).send({ error: '书签不存在' });
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
    if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
    if (body.url !== undefined) { fields.push('url = ?'); values.push(body.url); }
    if (body.backupUrl !== undefined) { fields.push('backup_url = ?'); values.push(body.backupUrl); }
    if (body.favicon !== undefined) { fields.push('favicon = ?'); values.push(body.favicon); }
    if (body.categoryId !== undefined) { fields.push('category_id = ?'); values.push(body.categoryId); }
    if (body.isPrivate !== undefined) { fields.push('is_private = ?'); values.push(body.isPrivate ? 1 : 0); }
    if (body.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(body.sortOrder); }

    if (fields.length === 0) {
      return reply.status(400).send({ error: '没有需要更新的字段' });
    }

    fields.push("updated_at = datetime('now')");
    values.push(Number(id));

    dbHelper.run(`UPDATE bookmarks SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase();

    const bookmark = dbHelper.get('SELECT * FROM bookmarks WHERE id = ?', [Number(id)]);
    return { bookmark };
  });

  // ==================== 删除书签 ====================

  fastify.delete('/api/bookmarks/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = dbHelper.run('DELETE FROM bookmarks WHERE id = ?', [Number(id)]);
    if (result.changes === 0) {
      return reply.status(404).send({ error: '书签不存在' });
    }
    saveDatabase();

    return { success: true };
  });

  // ==================== 批量更新书签排序 ====================

  fastify.put('/api/bookmarks/reorder', { preHandler: [requireAuth] }, async (request) => {
    const { ids } = request.body as { ids: number[] };
    if (Array.isArray(ids)) {
      ids.forEach((id, index) => {
        dbHelper.run('UPDATE bookmarks SET sort_order = ? WHERE id = ?', [index + 1, Number(id)]);
      });
      saveDatabase();
    }
    return { success: true };
  });

  // ==================== 自动抓取网站元信息与 AI 智能精炼 ====================

  const KNOWN_SITES: Record<string, { title: string; desc: string }> = {
    'chat.openai.com': { title: 'ChatGPT', desc: 'OpenAI 官方推出的 AI 人工智能对话大模型助手服务平台。' },
    'chatgpt.com': { title: 'ChatGPT', desc: 'OpenAI 官方推出的 AI 人工智能对话大模型助手服务平台。' },
    'gemini.google.com': { title: 'Gemini', desc: 'Google 谷歌旗下新一代多模态大语言模型 AI 助手平台。' },
    'claude.ai': { title: 'Claude', desc: 'Anthropic 旗下高智能安全 AI 对话与大模型助手平台。' },
    'github.com': { title: 'GitHub', desc: '全球领先的代码托管平台与开源开发者协作社区。' },
    'bilibili.com': { title: '哔哩哔哩', desc: '国内知名的弹幕视频与年轻人文化社区。' },
    'youtube.com': { title: 'YouTube', desc: '全球最大的视频分享与创作者内容平台。' },
    'deepl.com': { title: 'DeepL', desc: '全球精准的高质量神经网络 AI 智能翻译工具。' },
    'notion.so': { title: 'Notion', desc: '集笔记、文档、知识库与任务管理于一体的协作工作区。' },
    'linux.do': { title: 'LINUX DO', desc: '高品质技术探索与开发者交流社区。' },
    'v2ex.com': { title: 'V2EX', desc: '创意工作者与程序员讨论社区。' },
    'tool.browser.qq.com': { title: '帮小忙', desc: '腾讯QQ浏览器在线工具箱平台，提供证件照生成、PDF转换、文字提取等在线服务。' },
    'huggingface.co': { title: 'Hugging Face', desc: '全球知名的人工智能与机器学习开源社区，提供海量开源大模型、数据集与应用托管分享。' },
    'tailwindcss.com': { title: 'Tailwind CSS', desc: '现代化的原子类 CSS 框架，支持在 HTML 中快速构建高定制性的响应式前端界面。' },
    'docker.com': { title: 'Docker', desc: '全球领先的应用容器化开发与部署平台，提供轻量级应用容器打包与运行环境。' },
    'vuejs.org': { title: 'Vue.js', desc: '渐进式 JavaScript 前端框架，易学易用，性能出色，广泛用于现代化 Web 应用开发。' },
    'react.dev': { title: 'React', desc: 'Meta 官方推出的用于构建 Web 与原生交互界面的前端 JavaScript 视图库。' },
    'npmjs.com': { title: 'npm', desc: 'Node.js 官方包管理平台与全球最大的开源 JavaScript 软件模块注册表。' },
    'stackoverflow.com': { title: 'Stack Overflow', desc: '全球最大的程序员与开发者技术问答与编程知识共享社区。' },
    'reddit.com': { title: 'Reddit', desc: '全球知名的话题讨论社区与网络流行文化发源地。' },
    'twitter.com': { title: 'X', desc: '全球知名的实时信息流、新闻动态与社交互动平台。' },
    'x.com': { title: 'X', desc: '全球知名的实时信息流、新闻动态与社交互动平台。' },
    'discord.com': { title: 'Discord', desc: '广受欢迎的群组语音、视频与文字即时沟通互动社区。' },
    'telegram.org': { title: 'Telegram', desc: '主打隐私安全与高速传输的全球即时通讯云端通讯工具。' },
    't.me': { title: 'Telegram', desc: '主打隐私安全与高速传输的全球即时通讯云端通讯工具。' },
    'figma.com': { title: 'Figma', desc: '基于浏览器的全功能协作式 UI/UX 界面设计与产品原型制作工具。' },
    'canva.com': { title: 'Canva 可画', desc: '全球领先的在线平面设计平台，提供海量海报、幻灯片与社交媒体模板。' },
  };

  function getKnownSite(url?: string): { title: string; desc: string } | null {
    if (!url) return null;
    try {
      const u = url.startsWith('http') ? url : `https://${url}`;
      const hostname = new URL(u).hostname.toLowerCase();
      if (KNOWN_SITES[hostname]) return KNOWN_SITES[hostname];
      const withoutWww = hostname.replace(/^www\./, '');
      if (KNOWN_SITES[withoutWww]) return KNOWN_SITES[withoutWww];
    } catch {}
    return null;
  }

  function cleanSiteTitle(rawTitle: string, url?: string): string {
    const known = getKnownSite(url);
    if (known && (!rawTitle || rawTitle.trim() === 'Chat' || rawTitle.length > 20)) {
      return known.title;
    }

    if (!rawTitle) {
      if (url) {
        try {
          const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
          const hostParts = hostname.replace(/^www\./, '').split('.');
          if (hostParts.length > 0 && hostParts[0]) {
            const domainName = hostParts[0];
            return domainName.charAt(0).toUpperCase() + domainName.slice(1);
          }
        } catch {}
      }
      return '';
    }

    let t = rawTitle.trim();
    // 1. 去除首尾常见的包裹符号如 【...】、(...)、[...]、"..."
    t = t.replace(/^[【\[(（"“'‘\s]+|[】\])）"”'’\s]+$/g, '');

    // 2. 去除末尾的营销词 / 官网字眼
    t = t.replace(/\s*[-_–—|，,]\s*(官方网站|官网|首页|官方|Official Site|Home|Home Page|Leading|平台|门户|主页).*$/i, '');

    // 3. 按常见分隔符切分（包括中文逗号、英文逗号、破折号、下划线、竖线、斜杠、冒号）
    const parts = t.split(/\s*[,，\-_–—|/\\:：]\s*/).filter(p => p.trim().length > 0);
    if (parts.length > 0) {
      // 优先取第一段如果第一段是 2~15 字的产品名
      const first = parts[0].trim();
      if (first.length >= 2 && first.length <= 15) {
        t = first;
      }
    }

    // 4. 清理残留的冒号或多余符号
    t = t.replace(/[:：].*$/, '').replace(/^[“"']+|[”"']+$/g, '').trim();

    return t || rawTitle.trim();
  }

  function cleanSiteDescription(rawDesc: string, rawTitle: string, url?: string): string {
    const known = getKnownSite(url);
    if (known) {
      return known.desc;
    }

    const titleCore = cleanSiteTitle(rawTitle, url);

    if (!rawDesc || !rawDesc.trim()) {
      return `${titleCore || '该网站'} 官方网站，提供在线服务与相关资源。`;
    }

    let d = rawDesc.trim();

    // 如果原描述完全没有中文字符且含有英文段落，说明未经过翻译，降级为友好中文简介，杜绝英文段落直接返回
    if (!/[\u4e00-\u9fa5]/.test(d) && /[a-zA-Z]{4,}/.test(d)) {
      return `${titleCore || '该网站'} 官方平台，提供相关在线功能与专业服务。`;
    }

    // 2. 如果描述以产品名称开头（如“帮小忙，腾讯QQ浏览器...”），剔除开头的重复产品名与标点
    if (titleCore && titleCore.length >= 2) {
      if (d.toLowerCase().startsWith(titleCore.toLowerCase())) {
        d = d.slice(titleCore.length).replace(/^[,，\-_–—|:：\s]+/, '').trim();
      }
    }

    // 3. 去除末尾的重复产品名或SEO分类
    if (titleCore && titleCore.length >= 2) {
      const lastIdx = d.toLowerCase().lastIndexOf(titleCore.toLowerCase());
      if (lastIdx > 0 && lastIdx >= d.length - titleCore.length - 20) {
        d = d.slice(0, lastIdx).replace(/[,，、\-_–—|:：\s]+$/, '').trim();
      }
    }

    // 4. 去除末尾常见的 SEO 堆砌字样
    d = d.replace(/([。！!？?~～]|\s)[^。！!？?~～]{0,10}(全部分类|分类工具|官网|官方网站|首页)[^。！!？?~～]*$/, '$1');

    // 5. 清理末尾悬空的逗号或标点
    d = d.replace(/[,，、\-_–—|:：\s]+$/, '');
    if (d && !/[。！!？?~～]$/.test(d)) {
      d += '。';
    }

    return d.trim();
  }

  async function getAiCleanMeta(rawTitle: string, url: string, rawDesc: string): Promise<{ title: string; description: string; aiUsed?: boolean }> {
    const known = getKnownSite(url);
    const fallback = {
      title: (known && (!rawTitle || rawTitle === 'Chat')) ? known.title : cleanSiteTitle(rawTitle, url),
      description: cleanSiteDescription(rawDesc, rawTitle, url),
      aiUsed: false,
    };

    try {
      const apiKeyRow = dbHelper.get("SELECT value FROM ai_settings WHERE key = 'api_key'");
      if (!apiKeyRow?.value) return fallback;

      const baseUrlRow = dbHelper.get("SELECT value FROM ai_settings WHERE key = 'base_url'");
      const bookmarkModelRow = dbHelper.get("SELECT value FROM ai_settings WHERE key = 'bookmark_model'");
      const modelRow = dbHelper.get("SELECT value FROM ai_settings WHERE key = 'model'");
      const availableModelsRow = dbHelper.get("SELECT value FROM ai_settings WHERE key = 'available_models'");

      let availableList: string[] = [];
      try {
        if (availableModelsRow?.value) {
          availableList = JSON.parse(availableModelsRow.value);
        }
      } catch {}

      const apiKey = apiKeyRow.value;
      const baseUrl = (baseUrlRow?.value || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
      let model = bookmarkModelRow?.value?.trim() || modelRow?.value?.trim() || '';
      if (!model) {
        model = availableList.includes('gpt-5.5') ? 'gpt-5.5' : (availableList[0] || 'gpt-5.5');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `你是一个专业的网址导航书签元数据提炼专家。请将用户提供的网站信息提炼为精准的书签名称和中文简介。
【极重要规则】
1. 语言要求：description（简介）必须且只能使用流畅、地道的【纯简体中文】！严禁输出英文或任何外文简介！如果原始网页标题或描述是英文、日文等外文，必须完整翻译并意译提炼为地道中文！
2. title（名称）：提取最核心、最简短的产品品牌名称（通常 2~8 个字，如“GitHub”、“Docker”、“帮小忙”、“Gemini”），去除任何口号、标点或SEO后缀。
3. description（简介）：字数约 30~80 字，精准概括该网站的核心功能与定位，去除开头重复名称，必须是纯简体中文！
4. 如果目标网站受反爬/网络限制没有抓取到原始标题或描述，请结合你所掌握的互联网全球知名网站与产品知识库，推断提炼出该网址最准确的官方产品名称及地道中文简介。

请严格输出合法 JSON 格式：{"title": "名称", "description": "纯简体中文简介"}，严禁输出任何 markdown 格式代码块或多余解释。`
            },
            {
              role: 'user',
              content: `网址: ${url}\n网页标题: ${rawTitle || '无'}\n原始描述: ${rawDesc || '无'}`
            }
          ],
          temperature: 0.1,
          max_tokens: 350,
        }),
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        let content = data.choices?.[0]?.message?.content?.trim() || '';
        content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(content);

        let parsedTitle = parsed.title ? String(parsed.title).trim() : fallback.title;
        let parsedDesc = parsed.description ? String(parsed.description).trim() : fallback.description;

        // 如果模型输出的简介中完全不包含中文字符且包含英文字母（说明模型漏翻直接输出了英文），立即执行二次强制中译
        if (parsedDesc && !/[\u4e00-\u9fa5]/.test(parsedDesc) && /[a-zA-Z]{3,}/.test(parsedDesc)) {
          try {
            const transController = new AbortController();
            const transTimer = setTimeout(() => transController.abort(), 4000);
            const transRes = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              signal: transController.signal,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  {
                    role: 'system',
                    content: '你是一个专业中英翻译专家。请将用户提供的英文网站简介翻译并提炼为 30~80 字流畅通顺的纯简体中文，只输出翻译后的中文文本，不要任何多余内容。'
                  },
                  {
                    role: 'user',
                    content: parsedDesc
                  }
                ],
                temperature: 0.1,
                max_tokens: 200,
              }),
            });
            clearTimeout(transTimer);
            if (transRes.ok) {
              const transData = await transRes.json();
              const zhText = transData.choices?.[0]?.message?.content?.trim();
              if (zhText && /[\u4e00-\u9fa5]/.test(zhText)) {
                parsedDesc = zhText;
              }
            }
          } catch {}
        }

        return {
          title: parsedTitle,
          description: parsedDesc || fallback.description,
          aiUsed: true,
        };
      }
    } catch {}
    return fallback;
  }

  const fetchMetaSchema = z.object({
    url: z.string().url('请输入有效的 URL'),
  });

  fastify.post('/api/bookmarks/fetch-meta', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const { url } = fetchMetaSchema.parse(request.body);
      if (!isSafeUrl(url)) {
        return reply.status(400).send({ error: '目标 URL 不合法或属于受保护的私有网段/环回地址' });
      }

      let meta = { title: '', description: '', favicon: '' };
      let scraped = false;
      try {
        meta = await fetchSiteMeta(url);
        if (meta.title || meta.description) {
          scraped = true;
        }
      } catch {}

      const cleanResult = await getAiCleanMeta(meta.title, url, meta.description || '');
      meta.title = cleanResult.title || cleanSiteTitle('', url);
      meta.description = cleanResult.description || '';
      const aiUsed = !!cleanResult.aiUsed;

      if (!meta.favicon) {
        meta.favicon = `/api/favicon?url=${encodeURIComponent(url)}`;
      }
      return { meta, scraped, aiUsed };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: '请输入有效的 URL' });
      }
      return reply.status(500).send({ error: '抓取失败，请手动填写' });
    }
  });

  // ==================== 连通性检测 ====================

  fastify.post('/api/bookmarks/:id/check', { preHandler: [requireAuth] }, async (request) => {
    const { id } = request.params as { id: string };
    const bookmark = dbHelper.get('SELECT url FROM bookmarks WHERE id = ?', [Number(id)]);

    if (!bookmark) {
      return { error: '书签不存在' };
    }

    const status = await checkUrlStatus(bookmark.url);
    dbHelper.run(
      "UPDATE bookmarks SET status = ?, last_check_at = datetime('now') WHERE id = ?",
      [status, Number(id)]
    );
    saveDatabase();

    return { id: Number(id), status };
  });

  fastify.post('/api/bookmarks/check-all', { preHandler: [requireAuth] }, async () => {
    const bookmarks = dbHelper.all('SELECT id, url FROM bookmarks');

    const results: { id: number; status: string }[] = [];

    // 并发控制：每次最多 5 个并发请求
    const batchSize = 5;
    for (let i = 0; i < bookmarks.length; i += batchSize) {
      const batch = bookmarks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (bm: any) => {
          const status = await checkUrlStatus(bm.url);
          dbHelper.run(
            "UPDATE bookmarks SET status = ?, last_check_at = datetime('now') WHERE id = ?",
            [status, bm.id]
          );
          return { id: bm.id, status };
        })
      );
      results.push(...batchResults);
    }

    saveDatabase();
    return { results, total: results.length };
  });
}
