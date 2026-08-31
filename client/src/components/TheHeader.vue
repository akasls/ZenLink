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
  <header class="sticky top-0 left-0 right-0 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 z-40">
    <div class="h-full px-4 flex items-center justify-between max-w-7xl mx-auto">
      <!-- 左侧：Logo 品牌 -->
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="md:hidden w-7 h-7 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
          @click="emit('toggleSidebar')"
          title="切换菜单"
        >
          <el-icon><component is="Fold" /></el-icon>
        </button>

        <div class="flex items-center gap-2 cursor-pointer select-none" @click="switchApp({ id: 'home', path: '/' })">
          <div class="w-6 h-6 rounded-md bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 font-bold text-xs overflow-hidden">
            <img v-if="siteStore.siteLogo" :src="siteStore.siteLogo" alt="Logo" class="w-full h-full object-cover" />
            <span v-else>{{ (siteStore.siteName || 'Z').trim().charAt(0) }}</span>
          </div>
          <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">{{ siteStore.siteName || 'ZenLink' }}</span>
        </div>
      </div>

      <!-- 中间：核心应用切换器 (桌面端) -->
      <div class="hidden md:flex items-center gap-1 p-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
        <button
          v-for="tab in appTabs"
          :key="tab.id"
          type="button"
          class="px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 cursor-pointer"
          :class="[
            currentView === tab.id
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          ]"
          @click="switchApp(tab)"
        >
          <el-icon class="text-xs"><component :is="tab.icon" /></el-icon>
          <span>{{ tab.name }}</span>
        </button>
      </div>

      <!-- 右侧：每日一言 + 主题 + 系统设置/登录 -->
      <div class="flex items-center gap-2">
        <div v-if="dailyQuote" class="hidden lg:flex items-center gap-1 max-w-[200px] text-xs text-slate-400">
          <el-icon class="text-xs text-slate-400 flex-shrink-0"><component is="ChatDotRound" /></el-icon>
          <span class="truncate text-[11px]">{{ dailyQuote }}</span>
        </div>

        <div class="flex items-center gap-1">
          <button
            type="button"
            class="w-7 h-7 rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            @click="themeStore.toggle()"
            :title="themeStore.isDark ? '浅色模式' : '深色模式'"
          >
            <el-icon class="text-xs"><component :is="themeStore.isDark ? 'Sunny' : 'Moon'" /></el-icon>
          </button>

          <button
            v-if="authStore.isLoggedIn"
            type="button"
            class="w-7 h-7 rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            @click="router.push('/admin')"
            title="系统设置"
          >
            <el-icon class="text-xs"><component is="Setting" /></el-icon>
          </button>

          <button
            v-else
            type="button"
            class="w-7 h-7 rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            @click="router.push('/login')"
            title="登录"
          >
            <el-icon class="text-xs"><component is="User" /></el-icon>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

