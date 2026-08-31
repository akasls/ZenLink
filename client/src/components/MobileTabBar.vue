<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const currentView = computed(() => {
  if (route.meta?.view) return route.meta.view as string;
  if (route.path === '/notes') return 'notes';
  if (route.path === '/ai') return 'ai';
  if (route.path === '/admin') return 'admin';
  return 'home';
});

const tabs = [
  { id: 'home', name: '导航', path: '/', icon: 'Compass' },
  { id: 'notes', name: '笔记', path: '/notes', icon: 'Document' },
  { id: 'ai', name: 'AI 助手', path: '/ai', icon: 'ChatDotRound' },
];

function switchTab(path: string) {
  router.push(path);
}
</script>

<template>
  <nav class="md:hidden fixed bottom-0 left-0 right-0 h-12 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200/80 dark:border-slate-800 z-40 flex items-center justify-around px-2">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer"
      :class="[
        currentView === tab.id
          ? 'text-slate-900 dark:text-slate-100 font-semibold'
          : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
      ]"
      @click="switchTab(tab.path)"
    >
      <el-icon class="text-base"><component :is="tab.icon" /></el-icon>
      <span class="text-[10px] tracking-tight leading-none">{{ tab.name }}</span>
    </button>
  </nav>
</template>

