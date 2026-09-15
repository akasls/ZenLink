import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
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
  const siteName = ref(localStorage.getItem('zl_site_name') || 'ZenLink');
  const siteDesc = ref(localStorage.getItem('zl_site_desc') || '简洁高效的个人网址导航与知识工作台');
  const siteLogo = ref(localStorage.getItem('zl_site_logo') || '');
  const defaultEngine = ref(localStorage.getItem('zl_default_engine') || 'google');
  const searchBgMode = ref<'dynamic' | 'custom_image'>((localStorage.getItem('zl_search_bg_mode') as any) || 'dynamic');
  const searchBgImage = ref(localStorage.getItem('zl_search_bg_image') || '');
  const enableAi = ref(true);
  const enableNotes = ref(true);

  function updateDocumentTitle() {
    if (typeof document === 'undefined') return;
    const name = siteName.value || 'ZenLink';
    const desc = siteDesc.value || '简洁高效的个人网址导航与知识工作台';
    document.title = `${name} · ${desc}`;

    // 同步更新 meta 标签
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', `${name} - ${desc}`);

    const appNameMeta = document.querySelector('meta[name="application-name"]');
    if (appNameMeta) appNameMeta.setAttribute('content', name);

    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitleMeta) appleTitleMeta.setAttribute('content', name);
  }

  function updateFavicon() {
    if (typeof document === 'undefined') return;
    const logo = siteLogo.value;
    if (!logo) return;

    // 针对所有可能的 icon 与 apple-touch-icon 统一更新
    const iconLinks = document.querySelectorAll<HTMLLinkElement>(
      "link[rel*='icon'], link[rel*='apple-touch-icon']"
    );

    if (iconLinks.length > 0) {
      iconLinks.forEach((link) => {
        link.href = logo;
        // 若非 svg 图片，移除可能导致现代浏览器渲染失败的 type="image/svg+xml"
        if (!logo.endsWith('.svg') && !logo.includes('image/svg')) {
          link.removeAttribute('type');
        }
      });
    } else {
      const link = document.createElement('link');
      link.rel = 'shortcut icon';
      link.href = logo;
      document.head.appendChild(link);
    }
  }

  // 构造时立即同步更新 Title、Meta 与 Favicon
  updateDocumentTitle();
  updateFavicon();

  // 响应式联动监听
  watch([siteName, siteDesc], () => updateDocumentTitle());
  watch(siteLogo, () => updateFavicon());

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
    default_engine?: string;
    search_bg_mode?: string;
    search_bg_image?: string;
  }) {
    const engine = data.default_engine || defaultEngine.value || 'google';
    await settingsApi.save({ ...data, default_engine: engine });
    siteName.value = data.site_name;
    siteDesc.value = data.site_desc;
    defaultEngine.value = engine;
    localStorage.setItem('zl_site_name', data.site_name);
    localStorage.setItem('zl_site_desc', data.site_desc);
    localStorage.setItem('zl_default_engine', engine);

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
