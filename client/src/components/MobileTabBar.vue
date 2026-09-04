<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Compass, FileText, Bot } from 'lucide-vue-next';

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
  { id: 'home', name: '导航', path: '/', icon: Compass },
  { id: 'notes', name: '笔记', path: '/notes', icon: FileText },
  { id: 'ai', name: 'AI 助手', path: '/ai', icon: Bot },
];

function switchTab(path: string) {
  router.push(path);
}
</script>

<template>
  <nav class="md:hidden fixed bottom-0 left-0 right-0 h-12 bg-background/95 backdrop-blur border-t border-border z-40 flex items-center justify-around px-2">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer"
      :class="[
        currentView === tab.id
          ? 'text-foreground font-semibold'
          : 'text-muted-foreground hover:text-foreground'
      ]"
      @click="switchTab(tab.path)"
    >
      <component :is="tab.icon" class="h-4 w-4" />
      <span class="text-[10px] tracking-tight leading-none">{{ tab.name }}</span>
    </button>
  </nav>
</template>
