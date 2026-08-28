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
  <nav class="mobile-tabbar">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tabbar-item"
      :class="{ active: currentView === tab.id }"
      @click="switchTab(tab.path)"
    >
      <div class="tabbar-icon-wrap">
        <el-icon class="tabbar-icon"><component :is="tab.icon" /></el-icon>
      </div>
      <span class="tabbar-label">{{ tab.name }}</span>
    </button>
  </nav>
</template>

<style scoped>
.mobile-tabbar {
  display: none;
}

@media (max-width: 768px) {
  .mobile-tabbar {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 56px;
    height: calc(56px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    z-index: 1200;
    align-items: center;
    justify-content: space-around;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.04);
  }

  :global(html.dark) .mobile-tabbar {
    background: rgba(38, 40, 41, 0.94);
    border-top-color: rgba(255, 255, 255, 0.08);
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.35);
  }

  .tabbar-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    border: none;
    background: transparent;
    color: #888888;
    cursor: pointer;
    gap: 3px;
    transition: all 0.15s ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  :global(html.dark) .tabbar-item {
    color: #999999;
  }

  .tabbar-icon-wrap {
    width: 28px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    transition: all 0.2s ease;
  }

  .tabbar-icon {
    font-size: 19px;
    transition: transform 0.2s ease;
  }

  .tabbar-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: -0.01em;
    transition: color 0.2s ease, font-weight 0.2s ease;
  }

  .tabbar-item.active {
    color: var(--zl-primary) !important;
  }

  .tabbar-item.active .tabbar-icon-wrap {
    background: rgba(var(--zl-primary-rgb), 0.1);
  }

  :global(html.dark) .tabbar-item.active .tabbar-icon-wrap {
    background: rgba(var(--zl-primary-rgb), 0.2);
  }

  .tabbar-item.active .tabbar-icon {
    transform: scale(1.08);
  }

  .tabbar-item.active .tabbar-label {
    font-weight: 600;
  }
}
</style>
