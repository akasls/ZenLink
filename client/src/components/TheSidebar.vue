<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { mapIcon } from '@/utils/icon-map';
import { useSiteStore } from '@/stores/site';
import { useThemeStore } from '@/stores/theme';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  Compass,
  Bot,
  FileText,
  Settings,
  Sun,
  Moon,
  X,
} from 'lucide-vue-next';

const siteStore = useSiteStore();
const themeStore = useThemeStore();

interface Category {
  id: number;
  name: string;
  icon: string;
  is_private: number;
  parent_id: number | null;
  sort_order?: number;
}

const props = defineProps<{
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
}>();

const { isMobile, setOpenMobile } = useSidebar();

const expandedCatIds = ref<Set<number>>(new Set());

function toggleSubCats(catId: number) {
  if (expandedCatIds.value.has(catId)) {
    expandedCatIds.value.delete(catId);
  } else {
    expandedCatIds.value.add(catId);
  }
}

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
  if (isMobile.value) setOpenMobile(false);
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
  if (isMobile.value) setOpenMobile(false);
  nextTick(() => {
    const el = document.getElementById(`sec-${topId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function handleLogoClick() {
  emit('changeView', 'home');
  if (isMobile.value) setOpenMobile(false);
  nextTick(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function handleChangeView(view: 'home' | 'admin' | 'notes' | 'ai') {
  if (view !== 'home' && !props.isLoggedIn) {
    emit('login', view);
    if (isMobile.value) setOpenMobile(false);
    return;
  }
  emit('changeView', view);
  if (isMobile.value) setOpenMobile(false);
}

function handleSettings() {
  if (props.isLoggedIn) {
    emit('changeView', 'admin');
  } else {
    emit('login', 'admin');
  }
  if (isMobile.value) setOpenMobile(false);
}
</script>

<template>
  <Sidebar collapsible="icon" variant="sidebar">
    <!-- Header: Workspace / Logo -->
    <SidebarHeader class="border-b border-sidebar-border/60 pb-3">
      <div class="flex items-center justify-between">
        <SidebarMenu class="flex-1 min-w-0">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="返回首页"
              class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
              @click="handleLogoClick"
            >
              <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-xs overflow-hidden shrink-0">
                <img v-if="siteStore.siteLogo" :src="siteStore.siteLogo" class="size-full object-cover" alt="logo" />
                <span v-else>{{ (siteStore.siteName || 'Z').trim().charAt(0) }}</span>
              </div>
              <div class="grid flex-1 text-left text-xs leading-tight min-w-0">
                <span class="truncate font-semibold text-foreground tracking-tight">{{ siteStore.siteName || 'ZenLink' }}</span>
                <span class="truncate text-[11px] text-muted-foreground">{{ siteStore.siteDesc || '干净简洁的导航' }}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <!-- 移动端关闭按钮 -->
        <Button
          v-if="isMobile"
          variant="ghost"
          size="icon-xs"
          class="text-muted-foreground hover:text-foreground shrink-0 ml-1"
          @click="setOpenMobile(false)"
          title="关闭菜单"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </SidebarHeader>

    <!-- Content: Apps & Categories -->
    <SidebarContent class="px-2 py-2">
      <!-- 核心功能模式 Group -->
      <SidebarGroup>
        <SidebarGroupLabel>核心功能</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                :is-active="currentView === 'home'"
                tooltip="网址导航"
                class="cursor-pointer"
                @click="handleChangeView('home')"
              >
                <Compass class="size-4 shrink-0" />
                <span>网址导航</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem v-if="siteStore.enableNotes">
              <SidebarMenuButton
                :is-active="currentView === 'notes'"
                tooltip="在线笔记"
                class="cursor-pointer"
                @click="handleChangeView('notes')"
              >
                <FileText class="size-4 shrink-0" />
                <span>在线笔记</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem v-if="siteStore.enableAi">
              <SidebarMenuButton
                :is-active="currentView === 'ai'"
                tooltip="AI 助手"
                class="cursor-pointer"
                @click="handleChangeView('ai')"
              >
                <Bot class="size-4 shrink-0" />
                <span>AI 助手</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <!-- 网址分类 Group -->
      <SidebarGroup class="mt-2">
        <SidebarGroupLabel>书签分类</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="cat in topCats" :key="cat.id">
              <SidebarMenuButton
                :is-active="selectedCategoryId === cat.id && currentView === 'home'"
                :tooltip="cat.name"
                class="cursor-pointer"
                @click="handleSelectCategory(cat.id)"
              >
                <component :is="mapIcon(cat?.icon)" class="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <span class="truncate">{{ cat.name }}</span>
              </SidebarMenuButton>

              <SidebarMenuAction
                v-if="getSubCats(cat.id).length > 0"
                :class="[
                  'cursor-pointer transition-transform duration-200',
                  expandedCatIds.has(cat.id) ? 'rotate-90' : '',
                ]"
                @click.stop="toggleSubCats(cat.id)"
                title="展开/收起子分类"
              >
                <ChevronRight class="size-3.5" />
              </SidebarMenuAction>

              <!-- 子分类下拉列表 -->
              <SidebarMenuSub v-if="getSubCats(cat.id).length > 0 && expandedCatIds.has(cat.id)">
                <SidebarMenuSubItem v-for="sub in getSubCats(cat.id)" :key="sub.id">
                  <SidebarMenuSubButton
                    class="cursor-pointer"
                    @click="handleSelectSubCategory(cat.id, sub.id)"
                  >
                    <span class="truncate">{{ sub.name }}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <!-- Footer: 系统设置与主题模式 -->
    <SidebarFooter class="border-t border-sidebar-border/60 pt-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            :is-active="currentView === 'admin'"
            tooltip="系统设置"
            class="cursor-pointer"
            @click="handleSettings"
          >
            <Settings class="size-4 shrink-0" />
            <span>系统设置</span>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="切换主题"
            class="cursor-pointer"
            @click="themeStore.toggle($event)"
          >
            <Sun v-if="themeStore.isDark" class="size-4 shrink-0" />
            <Moon v-else class="size-4 shrink-0" />
            <span>{{ themeStore.isDark ? '浅色模式' : '暗黑模式' }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <!-- Edge Rail for expanding / resizing / toggling -->
    <SidebarRail />
  </Sidebar>
</template>
