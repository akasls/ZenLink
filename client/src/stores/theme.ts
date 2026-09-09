import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(
    (localStorage.getItem('zenlink_theme') as ThemeMode) || 'system'
  );

  const isDark = ref(false);

  function applyTheme() {
    let dark = false;
    if (mode.value === 'dark') {
      dark = true;
    } else if (mode.value === 'system') {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    isDark.value = dark;

    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }

    try {
      const metas = document.querySelectorAll('meta[name="theme-color"]');
      metas.forEach((el) => el.setAttribute('content', dark ? '#090d16' : '#f8f9fa'));
    } catch {}
  }

  function setMode(m: ThemeMode) {
    mode.value = m;
    localStorage.setItem('zenlink_theme', m);
    applyTheme();
  }

  function toggle() {
    setMode(isDark.value ? 'light' : 'dark');
  }

  // 监听系统主题变化
  function init() {
    applyTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (mode.value === 'system') applyTheme();
    });
  }

  return { mode, isDark, setMode, toggle, init };
});
