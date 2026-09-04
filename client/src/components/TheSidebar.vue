<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { mapIcon } from '@/utils/icon-map';
import { useSiteStore } from '@/stores/site';
import { useThemeStore } from '@/stores/theme';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronRight,
  Bot,
  FileText,
  Settings,
  Sun,
  Moon,
} from 'lucide-vue-next';

const siteStore = useSiteStore();
const themeStore = useThemeStore();

interface Category {
  id: number;
  name: string;
  icon: string;
  is_private: number;
  parent_id: number | null;
}

const props = defineProps<{
  collapsed: boolean;
  mobileOpen: boolean;
  categories: Category[];
  selectedCategoryId: number | null;
  currentView: 'home' | 'admin' | 'notes' | 'ai';
  isLoggedIn: boolean;
}>();

const emit = defineEmits<{
  selectCategory: [id: number];
  selectSubCategory: [topId: number, subId: number];
  changeView: [view: 'home' | 'admin' | 'notes' | 'ai'];
  login: [targetView?: string];
  closeMobile: [];
  toggleCollapse: [];
}>();

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
function onResize() {
  isMobile.value = window.innerWidth < 768;
}
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const isExpanded = computed(() => {
  if (isMobile.value) {
    return props.mobileOpen;
  }
  return !props.collapsed;
});

const topCats = computed(() =>
  (props.categories || [])
    .filter((c) => c && !c.parent_id)
    .sort((a: any, b: any) => (a?.sort_order || 0) - (b?.sort_order || 0))
);

function getSubCats(parentId: number) {
  return (props.categories || [])
    .filter((c) => c && c.parent_id === parentId)
    .sort((a: any, b: any) => (a?.sort_order || 0) - (b?.sort_order || 0));
}

function handleSelectCategory(id: number) {
  emit('selectCategory', id);
  emit('changeView', 'home');
  emit('closeMobile');
  nextTick(() => {
    const el = document.getElementById(`sec-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function handleSelectSubCategory(topId: number, subId: number) {
  emit('selectSubCategory', topId, subId);
  emit('changeView', 'home');
  emit('closeMobile');
  nextTick(() => {
    const el = document.getElementById(`sec-${topId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function handleLogoClick() {
  emit('changeView', 'home');
  emit('closeMobile');
  nextTick(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function handleChangeView(view: 'home' | 'admin' | 'notes' | 'ai') {
  if (view !== 'home' && !props.isLoggedIn) {
    emit('login', view);
    emit('closeMobile');
    return;
  }
  emit('changeView', view);
  emit('closeMobile');
}

function handleSettings() {
  if (props.isLoggedIn) {
    emit('changeView', 'admin');
  } else {
    emit('login', 'admin');
  }
  emit('closeMobile');
}

function handleToggleCollapse() {
  if (props.mobileOpen) {
    emit('closeMobile');
  } else {
    emit('toggleCollapse');
  }
}
</script>

<template>
  <!-- 移动端遮罩层 -->
  <transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="mobileOpen"
      class="fixed inset-0 bg-background/80 backdrop-blur-xs z-40 md:hidden"
      @click="emit('closeMobile')"
    ></div>
  </transition>

  <aside
    class="fixed top-0 left-0 bottom-0 h-screen bg-card border-r border-border flex flex-col z-50 transition-all duration-200 ease-in-out select-none"
    :class="[
      isExpanded ? 'w-52' : 'w-12 md:w-14',
      mobileOpen ? 'w-52 shadow-xl' : ''
    ]"
  >
    <!-- Header: 展开显示 Logo + 标题 + 收起键；折叠显示居中切换键 -->
    <div class="h-12 px-2.5 flex items-center justify-between border-b border-border shrink-0">
      <!-- 展开状态 -->
      <template v-if="isExpanded">
        <div class="flex items-center gap-2 cursor-pointer flex-1 min-w-0 pr-1 group" @click="handleLogoClick" title="返回导航页顶部">
          <div class="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 overflow-hidden font-bold text-xs">
            <img v-if="siteStore.siteLogo" :src="siteStore.siteLogo" class="w-full h-full object-cover rounded-md" alt="logo" />
            <span v-else>{{ (siteStore.siteName || 'Z').trim().charAt(0) }}</span>
          </div>
          <span class="text-xs font-semibold text-foreground/90 truncate group-hover:text-foreground transition-colors">
            {{ siteStore.siteName || 'ZenLink' }}
          </span>
        </div>
        <button
          class="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          @click="handleToggleCollapse"
          title="收起侧边栏"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <path d="M9 3v18"/>
            <path d="m16 15-3-3 3-3"/>
          </svg>
        </button>
      </template>

      <!-- 折叠状态 -->
      <template v-else>
        <button
          class="w-full h-8 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          @click="handleToggleCollapse"
          title="展开侧边栏"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <path d="M9 3v18"/>
            <path d="m14 9 3 3-3 3"/>
          </svg>
        </button>
      </template>
    </div>

    <!-- 网址分类导航列表 -->
    <nav class="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5">
      <template v-for="cat in topCats" :key="cat.id">
        <!-- 1. 折叠状态且存在二级分类：悬浮展示二级弹层 -->
        <Popover v-if="collapsed && !isMobile && getSubCats(cat.id).length > 0">
          <PopoverTrigger as-child>
            <button
              class="w-full h-8 rounded-md flex items-center justify-center transition-colors group relative"
              :class="[
                selectedCategoryId === cat.id && currentView === 'home'
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
              ]"
              @click="handleSelectCategory(cat.id)"
            >
              <component :is="mapIcon(cat?.icon)" class="h-4 w-4" />
            </button>
          </PopoverTrigger>

          <PopoverContent side="right" align="start" class="w-40 p-1.5 shadow-lg">
            <div class="flex flex-col gap-0.5">
              <div
                class="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold text-foreground hover:bg-accent cursor-pointer transition-colors"
                @click="handleSelectCategory(cat.id)"
                title="跳转至该分类"
              >
                <component :is="mapIcon(cat?.icon)" class="h-3.5 w-3.5" />
                <span>{{ cat.name }}</span>
              </div>
              <div class="h-px bg-border my-1"></div>
              <div class="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
                <div
                  v-for="sub in getSubCats(cat.id)"
                  :key="sub.id"
                  class="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
                  @click="handleSelectSubCategory(cat.id, sub.id)"
                >
                  <ChevronRight class="h-3 w-3 text-muted-foreground" />
                  <span class="truncate">{{ sub.name }}</span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <!-- 2. 普通状态或展开状态 -->
        <Tooltip
          v-else
          :delay-duration="300"
          :disabled="isExpanded"
        >
          <TooltipTrigger as-child>
            <button
              class="w-full h-8 rounded-md flex items-center transition-colors group"
              :class="[
                isExpanded ? 'px-2.5 gap-2 justify-start' : 'justify-center',
                selectedCategoryId === cat.id && currentView === 'home'
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
              ]"
              @click="handleSelectCategory(cat.id)"
            >
              <component :is="mapIcon(cat?.icon)" class="h-4 w-4 shrink-0" />
              <span v-if="isExpanded" class="text-xs truncate flex-1 text-left">{{ cat.name }}</span>
              <ChevronRight
                v-if="isExpanded"
                class="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" class="text-xs">
            {{ cat.name }}
          </TooltipContent>
        </Tooltip>
      </template>
    </nav>

    <!-- 底部上方的扩展应用 (AI对话 / 在线笔记) -->
    <div v-if="siteStore.enableAi || siteStore.enableNotes" class="p-1.5 border-t border-border space-y-0.5 shrink-0">
      <Tooltip v-if="siteStore.enableAi" :delay-duration="300" :disabled="isExpanded">
        <TooltipTrigger as-child>
          <button
            class="w-full h-8 rounded-md flex items-center transition-colors group"
            :class="[
              isExpanded ? 'px-2.5 gap-2 justify-start' : 'justify-center',
              currentView === 'ai'
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
            ]"
            @click="handleChangeView('ai')"
          >
            <Bot class="h-4 w-4 shrink-0" />
            <span v-if="isExpanded" class="text-xs truncate flex-1 text-left">AI 助手</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" class="text-xs">AI 助手</TooltipContent>
      </Tooltip>

      <Tooltip v-if="siteStore.enableNotes" :delay-duration="300" :disabled="isExpanded">
        <TooltipTrigger as-child>
          <button
            class="w-full h-8 rounded-md flex items-center transition-colors group"
            :class="[
              isExpanded ? 'px-2.5 gap-2 justify-start' : 'justify-center',
              currentView === 'notes'
                ? 'bg-accent text-accent-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
            ]"
            @click="handleChangeView('notes')"
          >
            <FileText class="h-4 w-4 shrink-0" />
            <span v-if="isExpanded" class="text-xs truncate flex-1 text-left">在线笔记</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" class="text-xs">在线笔记</TooltipContent>
      </Tooltip>
    </div>

    <!-- Footer: 系统设置与主题切换 -->
    <div class="p-1.5 border-t border-border shrink-0">
      <div v-if="isExpanded" class="flex items-center gap-1">
        <button
          class="flex-1 h-8 rounded-md px-2.5 flex items-center gap-2 text-xs font-medium transition-colors"
          :class="[
            currentView === 'admin'
              ? 'bg-accent text-accent-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
          ]"
          @click="handleSettings"
          title="系统设置"
        >
          <Settings class="h-4 w-4 shrink-0" />
          <span class="truncate">系统设置</span>
        </button>

        <button
          class="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          @click="themeStore.toggle($event)"
          :title="themeStore.isDark ? '切换至浅色模式' : '切换至暗黑模式'"
        >
          <Sun v-if="themeStore.isDark" class="h-4 w-4" />
          <Moon v-else class="h-4 w-4" />
        </button>
      </div>

      <div v-else class="flex flex-col items-center gap-1">
        <Tooltip :delay-duration="300">
          <TooltipTrigger as-child>
            <button
              class="w-full h-8 rounded-md flex items-center justify-center transition-colors"
              :class="[
                currentView === 'admin'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              ]"
              @click="handleSettings"
            >
              <Settings class="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" class="text-xs">系统设置</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </aside>
</template>
