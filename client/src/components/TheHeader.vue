<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useSiteStore } from '@/stores/site';
import {
  Menu,
  Compass,
  FileText,
  Bot,
  MessageSquareQuote,
  Sun,
  Moon,
  Settings,
  User,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  { id: 'home', name: '网址导航', path: '/', icon: Compass },
  { id: 'notes', name: '在线笔记', path: '/notes', icon: FileText },
  { id: 'ai', name: 'AI 助手', path: '/ai', icon: Bot, badge: 'NEW' },
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
  <header class="sticky top-0 left-0 right-0 h-12 bg-background/90 backdrop-blur border-b border-border z-40">
    <div class="h-full px-4 flex items-center justify-between max-w-7xl mx-auto">
      <!-- 左侧：Logo 品牌 -->
      <div class="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          class="md:hidden"
          @click="emit('toggleSidebar')"
          title="切换菜单"
        >
          <Menu class="h-4 w-4" />
        </Button>

        <div class="flex items-center gap-2 cursor-pointer select-none" @click="switchApp({ id: 'home', path: '/' })">
          <div class="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs overflow-hidden">
            <img v-if="siteStore.siteLogo" :src="siteStore.siteLogo" alt="Logo" class="w-full h-full object-cover" />
            <span v-else>{{ (siteStore.siteName || 'Z').trim().charAt(0) }}</span>
          </div>
          <span class="text-xs font-semibold text-foreground">{{ siteStore.siteName || 'ZenLink' }}</span>
        </div>
      </div>

      <!-- 中间：核心应用切换器 (桌面端) -->
      <div class="hidden md:flex items-center">
        <Tabs :model-value="currentView" @update:model-value="v => switchApp(appTabs.find(t => t.id === v)!)">
          <TabsList class="h-8">
            <TabsTrigger
              v-for="tab in appTabs"
              :key="tab.id"
              :value="tab.id"
              class="gap-1.5 h-7 px-3 text-xs"
            >
              <component :is="tab.icon" class="h-3.5 w-3.5" />
              <span>{{ tab.name }}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <!-- 右侧：每日一言 + 主题 + 系统设置/登录 -->
      <div class="flex items-center gap-2">
        <div v-if="dailyQuote" class="hidden lg:flex items-center gap-1.5 max-w-[220px] text-xs text-muted-foreground/80">
          <MessageSquareQuote class="h-3.5 w-3.5 shrink-0 text-primary/60" />
          <span class="truncate text-[11px]">{{ dailyQuote }}</span>
        </div>

        <div class="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            class="h-7 w-7 rounded-md"
            @click="themeStore.toggle()"
            :title="themeStore.isDark ? '浅色模式' : '深色模式'"
          >
            <Sun v-if="themeStore.isDark" class="h-3.5 w-3.5" />
            <Moon v-else class="h-3.5 w-3.5" />
          </Button>

          <Button
            v-if="authStore.isLoggedIn"
            variant="outline"
            size="icon-sm"
            class="h-7 w-7 rounded-md"
            @click="router.push('/admin')"
            title="系统设置"
          >
            <Settings class="h-3.5 w-3.5" />
          </Button>

          <Button
            v-else
            variant="outline"
            size="icon-sm"
            class="h-7 w-7 rounded-md"
            @click="router.push('/login')"
            title="登录"
          >
            <User class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  </header>
</template>
