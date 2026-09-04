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
  SidebarMenuBadge,
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
  Bot,
  FileText,
  Settings,
  Sun,
  Moon,
  X,
  Plus,
  Trash2,
  Tag,
  MessageSquare,
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

interface NoteItem {
  id: number;
  title: string;
  content: string;
  tags?: string[];
  updated_at?: string;
}

interface NoteTag {
  name: string;
  count: number;
}

interface ConversationItem {
  id: string;
  title: string;
  model?: string;
  role_id?: string;
  updated_at?: string;
}

const props = withDefaults(
  defineProps<{
    categories: Category[];
    selectedCategoryId: number | null;
    currentView: 'home' | 'admin' | 'notes' | 'ai';
    isLoggedIn: boolean;
    notes?: NoteItem[];
    noteTags?: NoteTag[];
    selectedNoteTag?: string | null;
    selectedNoteId?: number | null;
    aiConversations?: ConversationItem[];
    activeAiConversationId?: string | null;
  }>(),
  {
    notes: () => [],
    noteTags: () => [],
    selectedNoteTag: null,
    selectedNoteId: null,
    aiConversations: () => [],
    activeAiConversationId: null,
  }
);

const emit = defineEmits<{
  selectCategory: [id: number];
  selectSubCategory: [topId: number, subId: number];
  changeView: [view: 'home' | 'admin' | 'notes' | 'ai'];
  login: [targetView?: string];
  createNote: [];
  selectNote: [note: NoteItem];
  filterNoteTag: [tag: string | null];
  newAiChat: [];
  selectAiChat: [id: string];
  deleteAiChat: [id: string];
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

const totalNoteCount = computed(() => props.notes?.length || 0);

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

function handleSettings() {
  if (props.isLoggedIn) {
    emit('changeView', 'admin');
  } else {
    emit('login', 'admin');
  }
  if (isMobile.value) setOpenMobile(false);
}

function handleCreateNote() {
  emit('createNote');
  if (isMobile.value) setOpenMobile(false);
}

function handleSelectNote(n: NoteItem) {
  emit('selectNote', n);
  if (isMobile.value) setOpenMobile(false);
}

function handleFilterNoteTag(tag: string | null) {
  emit('filterNoteTag', tag);
  if (isMobile.value) setOpenMobile(false);
}

function handleNewAiChat() {
  emit('newAiChat');
  if (isMobile.value) setOpenMobile(false);
}

function handleSelectAiChat(id: string) {
  emit('selectAiChat', id);
  if (isMobile.value) setOpenMobile(false);
}

function handleDeleteAiChat(id: string) {
  emit('deleteAiChat', id);
}
</script>

<template>
  <Sidebar collapsible="icon" variant="sidebar">
    <!-- Header: Workspace Header (动态根据模式展示) -->
    <SidebarHeader class="border-b border-sidebar-border/60 pb-2.5">
      <div class="flex items-center justify-between">
        <SidebarMenu class="flex-1 min-w-0">
          <SidebarMenuItem>
            <!-- 模式 1: 导航页 Header -->
            <SidebarMenuButton
              v-if="currentView === 'home' || currentView === 'admin'"
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
                <span class="truncate text-[11px] text-muted-foreground">{{ siteStore.siteDesc || '网址导航' }}</span>
              </div>
            </SidebarMenuButton>

            <!-- 模式 2: 笔记页 Header -->
            <SidebarMenuButton
              v-else-if="currentView === 'notes'"
              size="lg"
              tooltip="在线笔记工作台"
              class="cursor-pointer"
              @click="handleFilterNoteTag(null)"
            >
              <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-sm shadow-xs overflow-hidden shrink-0 border border-amber-500/20">
                <FileText class="size-4" />
              </div>
              <div class="grid flex-1 text-left text-xs leading-tight min-w-0">
                <span class="truncate font-semibold text-foreground tracking-tight">在线笔记</span>
                <span class="truncate text-[11px] text-muted-foreground">共 {{ totalNoteCount }} 篇笔记</span>
              </div>
            </SidebarMenuButton>

            <!-- 模式 3: AI 对话 Header -->
            <SidebarMenuButton
              v-else-if="currentView === 'ai'"
              size="lg"
              tooltip="AI 对话助手"
              class="cursor-pointer"
              @click="handleNewAiChat"
            >
              <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-sm shadow-xs overflow-hidden shrink-0 border border-indigo-500/20">
                <Bot class="size-4" />
              </div>
              <div class="grid flex-1 text-left text-xs leading-tight min-w-0">
                <span class="truncate font-semibold text-foreground tracking-tight">AI 对话助手</span>
                <span class="truncate text-[11px] text-muted-foreground">智能多模型对话</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <!-- 移动端抽屉关闭按钮 -->
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

    <!-- Content: 动态内容分组 (按三大功能页面自适应) -->
    <SidebarContent class="px-2 py-2">
      <!-- ================= 模式 1：网址导航侧边栏 ================= -->
      <template v-if="currentView === 'home' || currentView === 'admin'">
        <SidebarGroup>
          <SidebarGroupLabel>书签分类</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="cat in topCats" :key="cat.id">
                <SidebarMenuButton
                  :is-active="selectedCategoryId === cat.id"
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

                <!-- 二级子分类列表 -->
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
      </template>

      <!-- ================= 模式 2：在线笔记侧边栏 ================= -->
      <template v-else-if="currentView === 'notes'">
        <!-- 快捷操作：新建笔记 -->
        <div class="px-2 pb-1.5 group-data-[collapsible=icon]:p-0">
          <Button
            size="sm"
            class="w-full h-8 text-xs font-medium gap-1.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 cursor-pointer shadow-xs"
            @click="handleCreateNote"
            title="新建空白笔记"
          >
            <Plus class="size-3.5 shrink-0" />
            <span class="group-data-[collapsible=icon]:hidden">新建笔记</span>
          </Button>
        </div>

        <!-- 笔记分类与标签 -->
        <SidebarGroup>
          <SidebarGroupLabel>标签分类</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  :is-active="selectedNoteTag === null"
                  tooltip="全部笔记"
                  class="cursor-pointer"
                  @click="handleFilterNoteTag(null)"
                >
                  <FileText class="size-4 shrink-0 text-muted-foreground" />
                  <span>全部笔记</span>
                  <SidebarMenuBadge v-if="totalNoteCount">{{ totalNoteCount }}</SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem v-for="tag in noteTags" :key="tag.name">
                <SidebarMenuButton
                  :is-active="selectedNoteTag === tag.name"
                  :tooltip="`#${tag.name}`"
                  class="cursor-pointer"
                  @click="handleFilterNoteTag(tag.name)"
                >
                  <Tag class="size-4 shrink-0 text-muted-foreground" />
                  <span class="truncate">#{{ tag.name }}</span>
                  <SidebarMenuBadge>{{ tag.count }}</SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <!-- 近期笔记列表 -->
        <SidebarGroup v-if="notes.length > 0" class="mt-1">
          <SidebarGroupLabel>近期笔记 ({{ notes.length }})</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="note in notes.slice(0, 15)" :key="note.id">
                <SidebarMenuButton
                  :is-active="selectedNoteId === note.id"
                  :tooltip="note.title || '未命名笔记'"
                  class="cursor-pointer"
                  @click="handleSelectNote(note)"
                >
                  <span class="truncate text-xs">{{ note.title || '未命名笔记' }}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </template>

      <!-- ================= 模式 3：AI 助手侧边栏 ================= -->
      <template v-else-if="currentView === 'ai'">
        <!-- 快捷操作：发起新对话 -->
        <div class="px-2 pb-1.5 group-data-[collapsible=icon]:p-0">
          <Button
            size="sm"
            class="w-full h-8 text-xs font-medium gap-1.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 cursor-pointer shadow-xs"
            @click="handleNewAiChat"
            title="开启新会话"
          >
            <Plus class="size-3.5 shrink-0" />
            <span class="group-data-[collapsible=icon]:hidden">新对话</span>
          </Button>
        </div>

        <!-- 历史对话列表 -->
        <SidebarGroup>
          <SidebarGroupLabel>历史对话 ({{ aiConversations.length }})</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu v-if="aiConversations.length > 0">
              <SidebarMenuItem v-for="conv in aiConversations" :key="conv.id">
                <SidebarMenuButton
                  :is-active="activeAiConversationId === conv.id"
                  :tooltip="conv.title || '新会话'"
                  class="cursor-pointer group/chat-item"
                  @click="handleSelectAiChat(conv.id)"
                >
                  <MessageSquare class="size-3.5 shrink-0 text-muted-foreground" />
                  <span class="truncate text-xs">{{ conv.title || '新会话' }}</span>
                </SidebarMenuButton>

                <!-- 删除对话按钮 (悬停显示) -->
                <SidebarMenuAction
                  class="cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/menu-item:opacity-100 transition-opacity"
                  title="删除该对话"
                  @click.stop="handleDeleteAiChat(conv.id)"
                >
                  <Trash2 class="size-3.5" />
                </SidebarMenuAction>
              </SidebarMenuItem>
            </SidebarMenu>

            <div v-else class="py-6 text-center text-xs text-muted-foreground/70">
              暂无历史对话
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </template>
    </SidebarContent>

    <!-- Footer: 系统设置与主题模式 (全模式常驻) -->
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
