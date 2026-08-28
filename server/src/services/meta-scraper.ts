import * as cheerio from 'cheerio';
import net from 'net';

export interface SiteMeta {
  title: string;
  description: string;
  favicon: string;
}

/**
 * 深度 SSRF 防御：严格阻断私有网段、本地环回、云厂商元数据接口及非法协议
 */
export function isSafeUrl(targetUrl: string): boolean {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    let hostname = parsed.hostname.toLowerCase();
    // 移除 IPv6 方括号
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    if (!hostname) return false;

    // 1. 域名黑名单与后缀
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.arpa') ||
      hostname.endsWith('.invalid') ||
      hostname === 'instance-data' ||
      hostname === 'metadata.google.internal'
    ) {
      return false;
    }

    // 2. IP 地址检测
    const ipType = net.isIP(hostname);
    if (ipType === 4) {
      const parts = hostname.split('.').map(Number);
      if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        return false;
      }
      const [a, b, c, d] = parts;

      // 0.0.0.0/8
      if (a === 0) return false;
      // 127.0.0.0/8 环回地址
      if (a === 127) return false;
      // 10.0.0.0/8 私网
      if (a === 10) return false;
      // 172.16.0.0/12 私网 (172.16.0.0 - 172.31.255.255)
      if (a === 172 && b >= 16 && b <= 31) return false;
      // 192.168.0.0/16 私网
      if (a === 192 && b === 168) return false;
      // 169.254.0.0/16 链路本地 / 云厂商元数据 (169.254.169.254)
      if (a === 169 && b === 254) return false;
      // 100.64.0.0/10 运营商级 NAT / 阿里云内部元数据 (100.100.100.200)
      if (a === 100 && b >= 64 && b <= 127) return false;
      // 224.0.0.0/4 组播与保留
      if (a >= 224) return false;
    } else if (ipType === 6) {
      const lower = hostname.toLowerCase();
      // ::1 环回
      if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return false;
      // :: 未指定
      if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return false;
      // fc00::/7 (Unique Local Address)
      if (lower.startsWith('fc') || lower.startsWith('fd')) return false;
      // fe80::/10 (Link-Local)
      if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return false;
      // IPv4 映射 IPv6 (::ffff:127.0.0.1 等)
      if (lower.startsWith('::ffff:')) {
        const v4Part = lower.slice(7);
        if (net.isIPv4(v4Part) && !isSafeUrl(`http://${v4Part}`)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 自动抓取网站元信息（标题、描述、图标）
 * 处理各种网页 meta 结构和图标路径 fallback
 */
export async function fetchSiteMeta(url: string): Promise<SiteMeta> {
  const result: SiteMeta = {
    title: '',
    description: '',
    favicon: '',
  };

  if (!isSafeUrl(url)) {
    return result;
  }

  try {
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // 请求网页内容，设置超时和 User-Agent
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 1. 提取标题（优先级：og:title > twitter:title > <title>）
    result.title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      '';
    result.title = result.title.trim().substring(0, 200);

    // 2. 提取描述（优先级：og:description > meta description > twitter:description）
    result.description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      '';
    result.description = result.description.trim().substring(0, 500);

    // 3. 提取 Favicon（多种 fallback 策略）
    result.favicon = extractFavicon($, baseUrl);

  } catch (error) {
    console.warn(`抓取元信息失败 [${url}]:`, (error as Error).message);
  }

  return result;
}

/**
 * 提取网站图标，按优先级尝试多种来源
 */
function extractFavicon($: cheerio.CheerioAPI, baseUrl: string): string {
  // 高清优先选择器列表（180px+ Apple Touch Icon / SVG / Android HD > 普通小图标）
  const selectors = [
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel="icon"][type="image/svg+xml"]',
    'link[rel="icon"][sizes="192x192"]',
    'link[rel="icon"][sizes="180x180"]',
    'link[rel="icon"][sizes="128x128"]',
    'link[rel="icon"][sizes="96x96"]',
    'link[rel="icon"][sizes="64x64"]',
    'link[rel="icon"][sizes="32x32"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel*="icon"]',
    'meta[property="og:image"]',
  ];

  for (const selector of selectors) {
    const el = $(selector).first();
    const href = el.attr('href') || el.attr('content');
    if (href && typeof href === 'string') {
      return resolveUrl(href, baseUrl);
    }
  }

  return '';
}

/**
 * 将相对路径解析为绝对 URL
 */
function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
  if (href.startsWith('//')) {
    return `https:${href}`;
  }
  if (href.startsWith('/')) {
    return `${baseUrl}${href}`;
  }
  return `${baseUrl}/${href}`;
}

/**
 * 检测链接连通性
 */
export async function checkUrlStatus(url: string): Promise<'online' | 'offline'> {
  if (!isSafeUrl(url)) {
    return 'offline';
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'ZenLink-Bot/1.0',
      },
    });

    clearTimeout(timeout);
    return response.ok ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}
