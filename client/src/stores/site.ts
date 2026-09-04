import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi } from '@/api';

// 清理历史残留的动态内联主题颜色变量与缓存，确保全量回归 Shadcn 原生规范
if (typeof document !== 'undefined') {
  const root = document.documentElement;
  root.style.removeProperty('--primary');
  root.style.removeProperty('--ring');
  root.style.removeProperty('--primary-foreground');
  root.style.removeProperty('--zl-primary');
  root.style.removeProperty('--zl-primary-rgb');
  root.style.removeProperty('--zl-primary-hover');
  root.style.removeProperty('--zl-primary-light');
  root.style.removeProperty('--zl-primary-glow');
  root.style.removeProperty('--zl-sidebar-active');
  root.style.removeProperty('--zl-accent');
  root.style.removeProperty('--zl-accent-text');
  try {
    localStorage.removeItem('zl_theme_primary_color');
  } catch {}
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

  // 初始化 Favicon
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
    fetchSettings,
    saveSettings,
    setSiteLogo,
    updateDocumentTitle,
    updateFavicon,
  };
});
