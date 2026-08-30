<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useSiteStore } from '@/stores/site';

defineProps<{
  currentView: 'home' | 'admin' | 'notes' | 'ai';
}>();

const emit = defineEmits<{
  toggleSidebar: [];
  changeView: [view: 'home' | 'admin' | 'notes' | 'ai'];
}>();

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const siteStore = useSiteStore();

const dailyQuote = ref('');

const appTabs = [
  { id: 'home', name: '网址导航', path: '/', icon: 'Compass' },
  { id: 'notes', name: '在线笔记', path: '/notes', icon: 'Document' },
    { id: 'ai', name: 'AI 助手', path: '/ai', icon: 'ChatDotRound', badge: 'NEW' },
];

function switchApp(tab: { id: string; path: string }) {
  emit('changeView', tab.id as any);
  router.push(tab.path);
}

async function fetchQuote() {
  try {
    const res = await fetch('https://v1.hitokoto.cn/?c=d&c=i&c=k&encode=json');
    const data = await res.json();
    dailyQuote.value = data.hitokoto || '嘴勤不走冤枉路';
  } catch {
    dailyQuote.value = '嘴勤不走冤枉路';
  }
}

onMounted(() => {
  fetchQuote();
});
</script>

<template>
  <header class="global-header">
    <div class="header-inner">
      <!-- 左侧：移动端汉堡菜单 + Logo 品牌 -->
      <div class="header-left">
        <button class="header-menu-btn" @click="emit('toggleSidebar')" title="切换菜单">
          <el-icon><component is="Fold" /></el-icon>
        </button>

        <div class="header-brand" @click="switchApp({ id: 'home', path: '/' })">
          <div class="brand-logo">
            <img v-if="siteStore.siteLogo" :src="siteStore.siteLogo" alt="Logo" class="brand-logo-img" />
            <img v-else src="/favicon.svg" alt="Logo" class="brand-logo-img" />
          </div>
          <span class="brand-name">{{ siteStore.siteName || '不凡导航' }}</span>
        </div>
      </div>

      <!-- 中间：4 大核心应用胶囊切换器 (桌面端居中) -->
      <div class="header-center hidden md:flex">
        <div class="header-app-capsule">
          <button
            v-for="tab in appTabs"
            :key="tab.id"
            class="app-capsule-item"
            :class="{ active: currentView === tab.id }"
            @click="switchApp(tab)"
          >
            <el-icon class="app-icon"><component :is="tab.icon" /></el-icon>
            <span>{{ tab.name }}</span>
            <span v-if="tab.badge" class="capsule-badge">{{ tab.badge }}</span>
          </button>
        </div>
      </div>

      <!-- 右侧：每日一言 + 主题 + 系统设置/登录 -->
      <div class="header-right">
        <!-- 每日一言公告 -->
        <div v-if="dailyQuote" class="header-quote hidden lg:flex items-center">
          <el-icon class="quote-icon"><component is="ChatDotRound" /></el-icon>
          <span class="quote-text truncate">{{ dailyQuote }}</span>
        </div>

        <div class="header-actions">
          <button class="header-action-btn" @click="themeStore.toggle()" :title="themeStore.isDark ? '浅色模式' : '深色模式'">
            <el-icon><component :is="themeStore.isDark ? 'Sunny' : 'Moon'" /></el-icon>
          </button>

          <button v-if="authStore.isLoggedIn" class="header-action-btn" @click="router.push('/admin')" title="系统设置">
            <el-icon><component is="Setting" /></el-icon>
          </button>

          <button v-else class="header-action-btn" @click="router.push('/login')" title="登录">
            <el-icon><component is="User" /></el-icon>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.global-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--zl-border);
  z-index: 1000;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

:global(html.dark) .global-header {
  background: rgba(38, 40, 41, 0.94);
  border-bottom-color: var(--zl-border);
}

.header-inner {
  height: 100%;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  max-width: 100%;
  margin: 0 auto;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  z-index: 5;
}

.header-menu-btn {
  display: none;
  width: 34px;
  height: 34px;
  border-radius: 6px;
  border: 1px solid var(--zl-border);
  background: transparent;
  color: var(--zl-text);
  font-size: 16px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.header-menu-btn:hover {
  color: var(--zl-text-main);
  border-color: var(--zl-border-hover);
}

@media (max-width: 768px) {
  .global-header {
    height: 50px !important;
  }
  .header-inner {
    padding: 0 12px !important;
  }
  .header-menu-btn {
    display: flex;
    width: 30px;
    height: 30px;
    font-size: 15px;
  }
  .brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.brand-logo {
    width: 28px !important;
    height: 28px !important;
    font-size: 14px !important;
  }
  .brand-name {
    font-size: 15px !important;
  }
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.brand-logo {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--zl-text-main);
  color: var(--zl-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  transition: all 0.2s ease;
}

.brand-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--zl-text);
  letter-spacing: -0.01em;
}

/* 顶部绝对居中 4 大应用切换胶囊 */
.header-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.header-app-capsule {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 100px;
}

:global(html.dark) .header-app-capsule {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.app-capsule-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  border-radius: 100px;
  border: none;
  background: transparent;
  color: var(--zl-text-secondary);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.app-capsule-item .app-icon {
  font-size: 15px;
}

.app-capsule-item:hover {
  color: var(--zl-text-main);
  background: rgba(0, 0, 0, 0.05);
}

.app-capsule-item.active {
  background: var(--zl-text-main) !important;
  color: var(--zl-card) !important;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.capsule-badge {
  font-size: 9px;
  background: #fff;
  color: var(--zl-primary);
  padding: 0 5px;
  border-radius: 8px;
  font-weight: 800;
  line-height: 14px;
  margin-left: 2px;
}

.app-capsule-item:not(.active) .capsule-badge {
  background: var(--zl-primary);
  color: #fff;
}

/* 右侧 */
.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.header-quote {
  max-width: 260px;
  gap: 6px;
  font-size: 12.5px;
  color: var(--zl-text-muted);
}

.quote-icon {
  font-size: 14px;
  color: var(--zl-primary);
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-action-btn {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  border: 1px solid var(--zl-border);
  background: var(--zl-card);
  color: var(--zl-text);
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}

.header-action-btn:hover {
  color: var(--zl-text-main);
  border-color: var(--zl-border-hover);
  background: var(--zl-bg-hover);
}
</style>
