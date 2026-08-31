import * as cheerio from 'cheerio';
import net from 'net';
import dns from 'dns/promises';

export interface SiteMeta {
  title: string;
  description: string;
  favicon: string;
}

/**
 * 校验 IP 是否属于受保护的私有网段、本地环回、云厂商元数据接口及保留地址
 */
export function isPrivateIp(ip: string): boolean {
  const ipType = net.isIP(ip);
  if (ipType === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;
    const [a, b, c, d] = parts;
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  } else if (ipType === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1' || lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    if (lower.startsWith('::ffff:')) {
      const v4Part = lower.slice(7);
      return isPrivateIp(v4Part);
    }
  }
  return false;
}

/**
 * 深度 SSRF 防御（异步 DNS 校验）：严格解析实际 IP 记录，抵御 DNS Rebinding 与私网映射
 */
export async function isSafeUrlAsync(targetUrl: string): Promise<boolean> {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    let hostname = parsed.hostname.toLowerCase();
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

    // 2. 直接 IP 地址检测
    if (net.isIP(hostname)) {
      return !isPrivateIp(hostname);
    }

    // 3. 解析真实 DNS A/AAAA 记录，彻底抵御 DNS Rebinding
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      if (!addresses || addresses.length === 0) return false;
      for (const addr of addresses) {
        if (isPrivateIp(addr.address)) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * 同步基础 URL 安全检查（快速初筛）
 */
export function isSafeUrl(targetUrl: string): boolean {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  try {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return false;
    }
    if (net.isIP(hostname)) {
      return !isPrivateIp(hostname);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全的 HTTP 抓取客户端：严格限制重定向次数并逐跳校验目标 IP，杜绝 302 重定向 SSRF
 */
export async function safeFetch(url: string, options: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const isSafe = await isSafeUrlAsync(currentUrl);
    if (!isSafe) {
      throw new Error(`SSRF Blocked: ${currentUrl} is not a safe destination`);
    }

    const res = await fetch(currentUrl, {
      ...options,
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) {
        return res;
      }
      currentUrl = new URL(location, currentUrl).toString();
      redirectCount++;
      continue;
    }

    return res;
  }

  throw new Error('Too many redirects');
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

  if (!(await isSafeUrlAsync(url))) {
    return result;
  }

  try {
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // 请求网页内容，设置超时和 User-Agent
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await safeFetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
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
  if (!(await isSafeUrlAsync(url))) {
    return 'offline';
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await safeFetch(url, {
      method: 'HEAD',
      signal: controller.signal,
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
