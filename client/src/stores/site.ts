import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi } from '@/api';

// 混合颜色函数，用于生成 Element Plus 规范的 light-3 / light-5 / light-7 / light-8 / light-9 / dark-2 阶梯色
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

export function applyThemeColor(hex: string) {
  if (!hex || typeof document === 'undefined') return;
  const root = document.documentElement;

  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return;

  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const rgbStr = `${r}, ${g}, ${b}`;
  const hoverHex = mixColor(hex, '#000000', 0.15);

  // 1. ZenLink 自定义全局变量
  root.style.setProperty('--zl-primary', hex);
  root.style.setProperty('--zl-primary-rgb', rgbStr);
  root.style.setProperty('--zl-primary-hover', hoverHex);
  root.style.setProperty('--zl-primary-light', `rgba(${rgbStr}, 0.12)`);
  root.style.setProperty('--zl-primary-glow', `rgba(${rgbStr}, 0.28)`);
  root.style.setProperty('--zl-sidebar-active', hex);
  root.style.setProperty('--zl-accent', hex);
  root.style.setProperty('--zl-accent-text', hex);

  // 2. Element Plus 官方全局色阶梯变量覆盖 (确保所有 el-button, el-switch, el-input, el-slider 实时变色)
  root.style.setProperty('--el-color-primary', hex);
  root.style.setProperty('--el-color-primary-rgb', rgbStr);
  root.style.setProperty('--el-color-primary-light-3', mixColor(hex, '#ffffff', 0.3));
  root.style.setProperty('--el-color-primary-light-5', mixColor(hex, '#ffffff', 0.5));
  root.style.setProperty('--el-color-primary-light-7', mixColor(hex, '#ffffff', 0.7));
  root.style.setProperty('--el-color-primary-light-8', mixColor(hex, '#ffffff', 0.8));
  root.style.setProperty('--el-color-primary-light-9', mixColor(hex, '#ffffff', 0.9));
  root.style.setProperty('--el-color-primary-dark-2', mixColor(hex, '#000000', 0.2));
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
  const themePrimaryColor = ref(localStorage.getItem('zl_theme_primary_color') || '#f1404b');

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
