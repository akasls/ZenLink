import { defineStore } from 'pinia';
import { ref, nextTick } from 'vue';

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
  }

  function setMode(m: ThemeMode) {
    mode.value = m;
    localStorage.setItem('zenlink_theme', m);
    applyTheme();
  }

  function triggerFallbackRipple(x: number, y: number, toDark: boolean) {
    if (typeof document === 'undefined') {
      setMode(toDark ? 'dark' : 'light');
      return;
    }
    const ripple = document.createElement('div');
    const size = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    ) * 2.2;

    ripple.style.position = 'fixed';
    ripple.style.left = `${x - size / 2}px`;
    ripple.style.top = `${y - size / 2}px`;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.borderRadius = '50%';
    ripple.style.backgroundColor = toDark ? '#282a2b' : '#f9f9f9';
    ripple.style.pointerEvents = 'none';
    ripple.style.zIndex = '999999';
    ripple.style.transform = 'scale(0)';
    ripple.style.opacity = '1';
    ripple.style.transition = 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease 0.4s';

    document.body.appendChild(ripple);

    requestAnimationFrame(() => {
      ripple.style.transform = 'scale(1)';
    });

    setTimeout(() => {
      setMode(toDark ? 'dark' : 'light');
      ripple.style.opacity = '0';
      setTimeout(() => {
        ripple.remove();
      }, 250);
    }, 220);
  }

  async function toggle(event?: MouseEvent) {
    // 准确定位切换主题按钮的绝对几何中心
    let x = window.innerWidth - 34;
    let y = window.innerHeight - 34;

    const btn =
      ((event?.currentTarget as HTMLElement) || (event?.target as HTMLElement)?.closest('.fab-btn')) ||
      document.querySelector('.fab-group .fab-btn:last-child');

    if (btn) {
      const rect = btn.getBoundingClientRect();
      x = Math.round(rect.left + rect.width / 2);
      y = Math.round(rect.top + rect.height / 2);
    } else if (typeof event?.clientX === 'number' && !isNaN(event.clientX)) {
      x = Math.round(event.clientX);
      y = Math.round(event.clientY);
    }

    const nextDark = !isDark.value;

    // 检查浏览器是否支持原生 View Transition
    const isTransitionSupported =
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isTransitionSupported) {
      triggerFallbackRipple(x, y, nextDark);
      return;
    }

    const endRadius = Math.ceil(
      Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )
    );

    const transition = (document as any).startViewTransition(async () => {
      if (isDark.value) {
        setMode('light');
      } else {
        setMode('dark');
      }
      await nextTick();
    });

    try {
      await transition.ready;
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      // 无论切暗黑还是切明亮，始终将新视图 (::view-transition-new) 从按钮圆心向外全屏扩散放大
      const anim = document.documentElement.animate(
        {
          clipPath,
        },
        {
          duration: 420,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );

      await anim.finished;
    } catch {}
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
