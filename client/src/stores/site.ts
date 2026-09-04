import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi } from '@/api';

// 混合颜色函数
function mixColor(color1: string, color2: string, weight: number): string {
  const c1 = color1.replace('#', '');
  const c2 = color2.replace('#', '');
  const r1 = parseInt(c1.substring(0, 2), 16);
  const g1 = parseInt(c1.substring(2, 4), 16);
  const b1 = parseInt(c1.substring(4, 6), 16);
  const r2 = parseInt(c2.substring(0, 2), 16);
  const g2 = parseInt(c2.substring(2, 4), 16);
  const b2 = parseInt(c2.substring(4, 6), 16);

  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] | null {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return null;
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100 * 10) / 10, Math.round(l * 100 * 10) / 10];
}

export interface ThemePreset {
  id: string;
  name: string;
  color: string;
  desc: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'iris', name: '极光蓝紫 (Iris)', color: '#6366f1', desc: 'Linear 经典主色，极简优雅' },
  { id: 'blue', name: '蔚蓝宝石 (Sapphire)', color: '#2563eb', desc: '科技专业感，清爽专注' },
  { id: 'emerald', name: '翠波竹青 (Emerald)', color: '#059669', desc: '自然温润，护眼舒适' },
  { id: 'amber', name: '琥珀日暮 (Amber)', color: '#d97706', desc: '温暖明快，活力充沛' },
  { id: 'rose', name: '绯红月季 (Rose)', color: '#e11d48', desc: '时尚现代，高对比度' },
  { id: 'obsidian', name: '曜石炭黑 (Obsidian)', color: '#18181b', desc: '纯粹黑白灰度，沉浸克制' },
];

export function applyThemeColor(hex: string) {
  if (!hex || typeof document === 'undefined') return;
  const root = document.documentElement;

  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const [r, g, b] = rgb;
  const [h, s, l] = rgbToHsl(r, g, b);

  const rgbStr = `${r}, ${g}, ${b}`;
  const hoverHex = mixColor(hex, '#000000', 0.15);

  // 1. 同步注入 Shadcn / Tailwind 核心变量
  root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
  root.style.setProperty('--ring', `${h} ${s}% ${l}%`);

  // 计算明度前景色 (Luminance 对比度自适应)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const fg = luminance > 0.65 ? '240 10% 3.9%' : '0 0% 100%';
  root.style.setProperty('--primary-foreground', fg);

  // 2. ZenLink 全局辅助变量
  root.style.setProperty('--zl-primary', hex);
  root.style.setProperty('--zl-primary-rgb', rgbStr);
  root.style.setProperty('--zl-primary-hover', hoverHex);
  root.style.setProperty('--zl-primary-light', `rgba(${rgbStr}, 0.10)`);
  root.style.setProperty('--zl-primary-glow', `rgba(${rgbStr}, 0.25)`);
  root.style.setProperty('--zl-sidebar-active', hex);
  root.style.setProperty('--zl-accent', hex);
  root.style.setProperty('--zl-accent-text', hex);
}

export const useSiteStore = defineStore('site', () => {
  const siteName = ref(localStorage.getItem('zl_site_name') || '不凡导航');
  const siteDesc = ref(localStorage.getItem('zl_site_desc') || '干净简洁的导航！');
  const siteLogo = ref(localStorage.getItem('zl_site_logo') || '');
  const defaultEngine = ref(localStorage.getItem('zl_default_engine') || 'google');
  const searchBgMode = ref<'dynamic' | 'custom_image'>((localStorage.getItem('zl_search_bg_mode') as any) || 'dynamic');
  const searchBgImage = ref(localStorage.getItem('zl_search_bg_image') || '');
  const enableAi = ref(true);
  const enableNotes = ref(true);

  // 默认使用高品质的 Linear Iris (#6366f1)
  const savedPrimary = localStorage.getItem('zl_theme_primary_color');
  const initialPrimary = (!savedPrimary || savedPrimary === '#f1404b') ? '#6366f1' : savedPrimary;
  const themePrimaryColor = ref(initialPrimary);

  // 初始化应用主题色与 Favicon
  applyThemeColor(themePrimaryColor.value);
  updateFavicon();

  function updateDocumentTitle() {
    if (typeof document !== 'undefined') {
      document.title = siteName.value ? `${siteName.value} · ${siteDesc.value}` : '不凡导航 · 干净简洁的导航！';
    }
  }

  function updateFavicon() {
    if (typeof document === 'undefined') return;
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'shortcut icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    if (siteLogo.value) {
      link.href = siteLogo.value;
    }
  }

  function setThemePrimaryColor(color: string) {
    if (!color) return;
    themePrimaryColor.value = color;
    localStorage.setItem('zl_theme_primary_color', color);
    applyThemeColor(color);
  }

  function setSiteLogo(logoUrl: string) {
    siteLogo.value = logoUrl;
    localStorage.setItem('zl_site_logo', logoUrl);
    updateFavicon();
  }

  async function fetchSettings() {
    try {
      const { data } = await settingsApi.get();
      if (data && data.settings) {
        if (data.settings.site_name) {
          siteName.value = data.settings.site_name;
          localStorage.setItem('zl_site_name', data.settings.site_name);
        }
        if (data.settings.site_desc) {
          siteDesc.value = data.settings.site_desc;
          localStorage.setItem('zl_site_desc', data.settings.site_desc);
        }
        if (data.settings.site_logo !== undefined) {
          setSiteLogo(data.settings.site_logo);
        }
        if (data.settings.default_engine) {
          defaultEngine.value = data.settings.default_engine;
          localStorage.setItem('zl_default_engine', data.settings.default_engine);
        }
        if (data.settings.search_bg_mode) {
          searchBgMode.value = data.settings.search_bg_mode as any;
          localStorage.setItem('zl_search_bg_mode', data.settings.search_bg_mode);
        }
        if (data.settings.search_bg_image !== undefined) {
          searchBgImage.value = data.settings.search_bg_image;
          localStorage.setItem('zl_search_bg_image', data.settings.search_bg_image);
        }
        if (data.settings.theme_primary_color) {
          setThemePrimaryColor(data.settings.theme_primary_color);
        }
        updateDocumentTitle();
      }
    } catch {}
  }

  async function saveSettings(data: {
    site_name: string;
    site_desc: string;
    site_logo?: string;
    default_engine: string;
    search_bg_mode?: string;
    search_bg_image?: string;
    theme_primary_color?: string;
  }) {
    await settingsApi.save(data);
    siteName.value = data.site_name;
    siteDesc.value = data.site_desc;
    defaultEngine.value = data.default_engine;
    localStorage.setItem('zl_site_name', data.site_name);
    localStorage.setItem('zl_site_desc', data.site_desc);
    localStorage.setItem('zl_default_engine', data.default_engine);

    if (data.site_logo !== undefined) {
      setSiteLogo(data.site_logo);
    }
    if (data.search_bg_mode) {
      searchBgMode.value = data.search_bg_mode as any;
      localStorage.setItem('zl_search_bg_mode', data.search_bg_mode);
    }
    if (data.search_bg_image !== undefined) {
      searchBgImage.value = data.search_bg_image;
      localStorage.setItem('zl_search_bg_image', data.search_bg_image);
    }
    if (data.theme_primary_color) {
      setThemePrimaryColor(data.theme_primary_color);
    }

    updateDocumentTitle();
  }

  return {
    enableAi,
    enableNotes,
    siteName,
    siteDesc,
    siteLogo,
    defaultEngine,
    searchBgMode,
    searchBgImage,
    themePrimaryColor,
    fetchSettings,
    saveSettings,
    setThemePrimaryColor,
    setSiteLogo,
    updateDocumentTitle,
    updateFavicon,
  };
});
