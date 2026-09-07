<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { mapIcon } from '@/utils/icon-map';
import { useSiteStore } from '@/stores/site';
import { useThemeStore } from '@/stores/theme';
import { useAuthStore } from '@/stores/auth';
import { useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { aiApi } from '@/api';
import { toast } from '@/components/ui/sonner';
import IconPicker from '@/components/IconPicker.vue';
import {
  ChevronRight,
  Compass,
  Sparkles,
  NotebookPen,
  FileText,
  Settings,
  Sun,
  Moon,
  Plus,
  Trash2,
  Pencil,
  MoreHorizontal,
  Folder,
  User,
  LogOut,
  LogIn,
  Bookmark,
  Cpu,
  ShieldCheck,
  Pin,
  PinOff,
  Search,
  X,
} from 'lucide-vue-next';

const siteStore = useSiteStore();
const themeStore = useThemeStore();
const authStore = useAuthStore();

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
  category_id?: number | null;
  tags?: string[];
  updated_at?: string;
}

interface NoteTag {
  name: string;
  count: number;
}

interface NoteCategoryItem {
  id: number;
  name: string;
  icon?: string;
  count?: number;
}

interface ProjectItem {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

interface ConversationItem {
  id: string;
  title: string;
  model?: string;
  role_id?: string;
  icon?: string;
  project_id?: string | null;
  is_pinned?: number;
  is_archived?: number;
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
    noteCategories?: NoteCategoryItem[];
    selectedNoteTag?: string | null;
    selectedNoteCategoryId?: number | null;
    selectedNoteId?: number | null;
    aiConversations?: ConversationItem[];
    activeAiConversationId?: string | null;
    aiProjects?: ProjectItem[];
    selectedAiProjectId?: string | null;
    selectedAdminTab?: string;
  }>(),
  {
    notes: () => [],
    noteTags: () => [],
    noteCategories: () => [],
    selectedNoteTag: null,
    selectedNoteCategoryId: null,
    selectedNoteId: null,
    aiConversations: () => [],
    activeAiConversationId: null,
    aiProjects: () => [],
    selectedAiProjectId: null,
    selectedAdminTab: 'bookmarks',
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
  filterNoteCategory: [categoryId: number | null];
  createNoteCategory: [];
  addBookmark: [];
  newAiChat: [];
  selectAiChat: [id: string];
  deleteAiChat: [id: string];
  renameAiChat: [id: string, title: string, icon?: string, projectId?: string | null];
  refreshAiChat: [];
  selectAiProject: [projectId: string | null];
  createAiProject: [];
  renameAiProject: [id: string, name: string, icon?: string];
  deleteAiProject: [id: string];
  selectAdminTab: [tab: string];
  searchNote: [query: string];
}>();

const { isMobile } = useSidebar();

// ===================== 抽屉与主侧边栏状态管理 =====================
const DRAWER_STORAGE_KEY = 'zenlink_sub_drawer_open';
const isDrawerOpen = ref<boolean>(true);

// 搜索栏展开控制
const showAiSearch = ref(false);
const showNoteSearch = ref(false);
const noteSearchQuery = ref('');

watch(noteSearchQuery, (q) => {
  emit('searchNote', q);
});

const searchedNotes = computed(() => {
  const q = noteSearchQuery.value.trim().toLowerCase();
  if (!q) return [];
  return (props.notes || []).filter(
    (n) =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q)) ||
      (Array.isArray(n.tags) && n.tags.some((t) => t.toLowerCase().includes(q)))
  );
});

function handleSelectNoteFromSearch(n: NoteItem) {
  emit('selectNote', n);
  if (isMobile.value) isDrawerOpen.value = false;
}

watch(isMobile, (mobile) => {
  if (mobile) {
    isDrawerOpen.value = false;
  } else {
    const savedState = localStorage.getItem(DRAWER_STORAGE_KEY);
    isDrawerOpen.value = savedState !== null ? savedState === 'true' : true;
  }
});

onMounted(() => {
  if (isMobile.value) {
    // 移动端默认收缩抽屉，保留主侧边栏
    isDrawerOpen.value = false;
  } else {
    const savedState = localStorage.getItem(DRAWER_STORAGE_KEY);
    isDrawerOpen.value = savedState !== null ? savedState === 'true' : true;
  }
});

function toggleSubDrawer() {
  isDrawerOpen.value = !isDrawerOpen.value;
  if (!isMobile.value) {
    localStorage.setItem(DRAWER_STORAGE_KEY, String(isDrawerOpen.value));
  }
}

// 供父组件占位计算 (移动端主侧边栏常驻 52px，抽屉滑出作为遮罩浮层)
const placeholderWidth = computed(() => {
  if (isMobile.value) {
    return '52px';
  }
  return isDrawerOpen.value ? '276px' : '52px';
});

defineExpose({
  isDrawerOpen,
  toggleSubDrawer,
  placeholderWidth,
});

// ===================== 分类与折叠处理 =====================
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

const userDisplayName = computed(() => {
  if (authStore.isLoggedIn) {
    return authStore.user?.username || '管理员';
  }
  return '访客';
});

const userRoleDesc = computed(() => {
  if (authStore.isLoggedIn) {
    return '已登录系统';
  }
  return '点击登录';
});

// 模式切换
function handleSwitchMode(mode: 'home' | 'notes' | 'ai' | 'admin') {
  if (mode !== 'home' && !props.isLoggedIn && mode !== 'admin') {
    emit('login', mode);
    return;
  }
  if (mode === 'admin') {
    handleSettings();
    return;
  }

  // 点击当前正在处于的模式，作为切换展开/收起抽屉的快捷手势
  if (props.currentView === mode) {
    toggleSubDrawer();
    return;
  }

  // 切换到新模式时：移动端默认收起副侧边栏直达内容，桌面端保持展开
  if (isMobile.value) {
    isDrawerOpen.value = false;
  } else {
    isDrawerOpen.value = true;
    localStorage.setItem(DRAWER_STORAGE_KEY, 'true');
  }

  emit('changeView', mode);
}

function handleSelectCategory(id: number) {
  emit('selectCategory', id);
  emit('changeView', 'home');
  if (isMobile.value) isDrawerOpen.value = false;
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
  if (isMobile.value) isDrawerOpen.value = false;
  nextTick(() => {
    const el = document.getElementById(`sec-${topId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function handleSettings() {
  if (props.isLoggedIn) {
    emit('changeView', 'admin');
    if (isMobile.value) {
      isDrawerOpen.value = false;
    } else {
      isDrawerOpen.value = true;
    }
  } else {
    emit('login', 'admin');
  }
}

function handleLogout() {
  authStore.logout();
  emit('changeView', 'home');
  if (isMobile.value) isDrawerOpen.value = false;
}

function handleCreateNoteDirect() {
  handleSwitchMode('notes');
  emit('createNote');
  if (isMobile.value) isDrawerOpen.value = false;
}

function handleNewAiChatDirect() {
  handleSwitchMode('ai');
  emit('selectAiProject', null);
  emit('newAiChat');
  if (isMobile.value) isDrawerOpen.value = false;
}

function handleFilterNoteCategory(categoryId: number | null) {
  if (props.currentView !== 'notes') {
    handleSwitchMode('notes');
  }
  emit('filterNoteCategory', categoryId);
  if (isMobile.value) isDrawerOpen.value = false;
}

function handleSelectAiChat(id: string) {
  if (props.currentView !== 'ai') {
    handleSwitchMode('ai');
  }
  emit('selectAiChat', id);
  if (isMobile.value) isDrawerOpen.value = false;
}

function handleDeleteAiChat(id: string) {
  emit('deleteAiChat', id);
}

// AI 对话列表状态
const aiConversationSearchQuery = ref('');

const activeConversations = computed(() => {
  const query = aiConversationSearchQuery.value.trim().toLowerCase();
  let list = (props.aiConversations || []).filter((c) => !c.is_archived);
  if (query) {
    list = list.filter((c) => (c.title || '').toLowerCase().includes(query));
  }
  return list;
});

async function handleTogglePin(id: string, isPinned: boolean) {
  const target = props.aiConversations?.find((c) => c.id === id);
  if (target) {
    target.is_pinned = isPinned ? 1 : 0;
  }
  try {
    await aiApi.updateConversation(id, { is_pinned: isPinned ? 1 : 0 });
    toast.success(isPinned ? '已置顶会话' : '已取消置顶');
    emit('refreshAiChat');
  } catch {
    if (target) {
      target.is_pinned = isPinned ? 0 : 1;
    }
    toast.error('操作失败');
  }
}

// AI 对话编辑
const showEditConversationModal = ref(false);
const editingConversation = ref<ConversationItem | null>(null);
const editConversationTitle = ref('');
const editConversationIcon = ref('pi pi-comment');
const editConversationProjectId = ref<string | null>(null);

function openEditConversation(conv: ConversationItem) {
  editingConversation.value = conv;
  editConversationTitle.value = conv.title || '';
  editConversationIcon.value = conv.icon || 'pi pi-comment';
  editConversationProjectId.value = conv.project_id || null;
  showEditConversationModal.value = true;
}

async function handleSaveEditConversation() {
  if (!editingConversation.value) return;
  const title = editConversationTitle.value.trim();
  if (!title) return;
  const icon = editConversationIcon.value || 'pi pi-comment';
  const projectId = editConversationProjectId.value;
  try {
    await aiApi.updateConversation(editingConversation.value.id, {
      title,
      icon,
      project_id: projectId || null,
    });
    toast.success('已更新会话信息');
    editingConversation.value.title = title;
    editingConversation.value.icon = icon;
    editingConversation.value.project_id = projectId || null;
    showEditConversationModal.value = false;
    emit('renameAiChat', editingConversation.value.id, title, icon, projectId || null);
  } catch (err: any) {
    toast.error(err.response?.data?.error || '更新会话失败');
  }
}

// 管理 Tabs
const adminTabs = [
  { value: 'bookmarks', label: '书签管理', icon: Bookmark },
  { value: 'categories', label: '书签分类', icon: Folder },
  { value: 'note_categories', label: '笔记分类', icon: NotebookPen },
  { value: 'ai', label: 'AI 模型配置', icon: Cpu },
  { value: 'security', label: '安全与认证', icon: ShieldCheck },
  { value: 'site', label: '系统常规设置', icon: Settings },
];

function handleSelectAdminTab(tab: string) {
  emit('selectAdminTab', tab);
  if (isMobile.value) isDrawerOpen.value = false;
}



// 抽屉顶部展示标题
const drawerHeaderTitle = computed(() => {
  if (props.currentView === 'home') return '书签分类';
  if (props.currentView === 'ai') return 'AI 对话';
  if (props.currentView === 'notes') return '笔记分类';
  if (props.currentView === 'admin') return '系统管理';
  return '工作区';
});
</script>

<template>
  <!-- ========================================================================= -->
  <!-- 双轨架构：移动端 & PC 端统一拥有 52px 极简主轨 + 224px 弹性抽屉           -->
  <!-- ========================================================================= -->
  <div class="flex shrink-0 relative select-none">
    <!-- 占位器 (桌面端平滑自适应推开画布；移动端固定 52px 占位，主画布始终完美对齐) -->
    <div
      class="transition-[width] duration-200 ease-in-out shrink-0"
      :style="{ width: placeholderWidth }"
    />

    <!-- 轨 1: 固定 52px 极简 Slim Dock (移动端与 PC 端全端常驻！) -->
    <aside
      class="fixed inset-y-0 left-0 z-50 w-[52px] border-r border-sidebar-border bg-sidebar/95 backdrop-blur-md flex flex-col items-center justify-between py-3 shrink-0"
    >
      <!-- 上半部：Logo & 核心模式主切换按键 -->
      <div class="flex flex-col items-center gap-3.5 w-full">
        <!-- 品牌 Logo (点击回主页) -->
        <button
          type="button"
          class="relative flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs hover:shadow transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer touch-manipulation group"
          title="返回网址导航主页"
          @click="handleSwitchMode('home')"
        >
          <span class="font-black text-sm tracking-tight leading-none select-none">Z</span>
        </button>

        <!-- 核心模式导航列 (带左侧垂直微胶囊指示条) -->
        <nav class="flex flex-col items-center gap-2 w-full">
          <!-- 网址导航 -->
          <div class="relative flex items-center justify-center w-full">
            <div
              v-if="currentView === 'home'"
              class="absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-4.5 rounded-full bg-primary transition-all duration-200"
            />
            <Tooltip :disabled="isMobile">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="size-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer touch-manipulation"
                  :class="
                    currentView === 'home'
                      ? 'bg-primary/12 text-primary dark:bg-primary/20 shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95'
                  "
                  @click="handleSwitchMode('home')"
                >
                  <Compass :size="19" :stroke-width="1.8" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">网址导航</TooltipContent>
            </Tooltip>
          </div>

          <!-- 在线笔记 -->
          <div v-if="siteStore.enableNotes" class="relative flex items-center justify-center w-full">
            <div
              v-if="currentView === 'notes'"
              class="absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-4.5 rounded-full bg-primary transition-all duration-200"
            />
            <Tooltip :disabled="isMobile">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="size-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer touch-manipulation"
                  :class="
                    currentView === 'notes'
                      ? 'bg-primary/12 text-primary dark:bg-primary/20 shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95'
                  "
                  @click="handleSwitchMode('notes')"
                >
                  <NotebookPen :size="19" :stroke-width="1.8" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">在线笔记</TooltipContent>
            </Tooltip>
          </div>

          <!-- AI 对话助手 -->
          <div v-if="siteStore.enableAi" class="relative flex items-center justify-center w-full">
            <div
              v-if="currentView === 'ai'"
              class="absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-4.5 rounded-full bg-primary transition-all duration-200"
            />
            <Tooltip :disabled="isMobile">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="size-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer touch-manipulation"
                  :class="
                    currentView === 'ai'
                      ? 'bg-primary/12 text-primary dark:bg-primary/20 shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95'
                  "
                  @click="handleSwitchMode('ai')"
                >
                  <Sparkles :size="19" :stroke-width="1.8" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">AI 助手</TooltipContent>
            </Tooltip>
          </div>
        </nav>
      </div>

      <!-- 下半部：仅保留主题切换与用户菜单 (统一为 size-9 rounded-xl) -->
      <div class="flex flex-col items-center gap-2 w-full px-1.5 pt-2 border-t border-sidebar-border/50">
        <!-- 主题切换按钮 -->
        <Tooltip :disabled="isMobile">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all duration-150 cursor-pointer touch-manipulation"
              @click="themeStore.toggle($event)"
            >
              <Sun v-if="themeStore.isDark" :size="19" :stroke-width="1.8" />
              <Moon v-else :size="19" :stroke-width="1.8" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{{ themeStore.isDark ? '浅色模式' : '深色模式' }}</TooltipContent>
        </Tooltip>

        <!-- 用户头像与系统设置下拉菜单 (统一为 size-9 rounded-xl 无突兀边框) -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all duration-150 cursor-pointer touch-manipulation"
              :class="currentView === 'admin' ? 'bg-primary/12 text-primary' : ''"
              title="账户与系统设置"
            >
              <div
                v-if="authStore.isLoggedIn"
                class="size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-semibold border border-primary/25"
              >
                {{ userDisplayName.slice(0, 1).toUpperCase() }}
              </div>
              <User v-else :size="19" :stroke-width="1.8" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent class="w-56 rounded-xl p-1.5 shadow-lg z-50" align="end" side="right" :side-offset="12">
            <DropdownMenuLabel class="text-[11px] text-muted-foreground px-2 py-1 font-medium flex items-center justify-between">
              <span>{{ userDisplayName }}</span>
              <span class="text-[10px] font-normal opacity-70">({{ userRoleDesc }})</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator class="my-1" />

            <DropdownMenuItem class="gap-2.5 p-2 rounded-lg cursor-pointer text-xs" @click="handleSettings">
              <Settings class="size-4" />
              <span class="flex-1">系统设置</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              v-if="props.isLoggedIn"
              class="gap-2.5 p-2 rounded-lg cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
              @click="handleLogout"
            >
              <LogOut class="size-4" />
              <span>退出登录</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              v-else
              class="gap-2.5 p-2 rounded-lg cursor-pointer text-xs text-primary"
              @click="emit('login')"
            >
              <LogIn class="size-4" />
              <span>管理员登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>

    <!-- 移动端副栏展开时的半透明遮罩背景 (位于 z-30，低于副栏 z-40，点击自动收缩抽屉) -->
    <transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobile && isDrawerOpen"
        class="fixed inset-0 left-[52px] z-30 bg-black/50 backdrop-blur-sm"
        @click="isDrawerOpen = false"
      />
    </transition>

    <!-- 轨 2: 224px 弹性内容抽屉 (紧贴 52px 主轨右侧，位于 z-40，高于遮罩 z-30) -->
    <aside
      class="fixed inset-y-0 left-[52px] z-40 w-56 border-r border-sidebar-border bg-sidebar/95 backdrop-blur-md flex flex-col transition-[transform,opacity] duration-200 ease-in-out overflow-hidden shadow-lg md:shadow-none"
      :class="isDrawerOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'"
    >
      <!-- 抽屉顶部 Header: 模块名称 + 专属操作区 (无收起按钮，完全按模式呈现专属功能) -->
      <div class="h-14 px-3.5 border-b border-sidebar-border/70 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <div class="size-6 rounded-md bg-muted flex items-center justify-center text-foreground/80 shrink-0">
            <Compass v-if="currentView === 'home'" :size="14" :stroke-width="1.8" />
            <NotebookPen v-else-if="currentView === 'notes'" :size="14" :stroke-width="1.8" />
            <Sparkles v-else-if="currentView === 'ai'" :size="14" :stroke-width="1.8" />
            <Settings v-else :size="14" :stroke-width="1.8" />
          </div>
          <span class="text-xs font-semibold tracking-tight text-foreground/90 truncate">
            {{ drawerHeaderTitle }}
          </span>
        </div>

        <!-- 专属操作区 (需求 1：根据页面呈现添加/搜索图标) -->
        <div class="flex items-center gap-1 shrink-0">
          <!-- 1. 导航模式：添加书签图标 -->
          <template v-if="currentView === 'home'">
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="size-7 rounded-lg hover:bg-muted active:scale-95 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  title="添加书签"
                  @click="emit('addBookmark')"
                >
                  <Plus class="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">添加书签</TooltipContent>
            </Tooltip>
          </template>

          <!-- 2. 在线笔记模式：搜索笔记 + 新建笔记 -->
          <template v-else-if="currentView === 'notes'">
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="size-7 rounded-lg hover:bg-muted active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                  :class="showNoteSearch ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'"
                  title="搜索笔记"
                  @click="showNoteSearch = !showNoteSearch"
                >
                  <Search class="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">搜索笔记</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="size-7 rounded-lg hover:bg-muted active:scale-95 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  title="新建笔记"
                  @click="handleCreateNoteDirect"
                >
                  <Plus class="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">新建笔记</TooltipContent>
            </Tooltip>
          </template>

          <!-- 3. AI 对话模式：搜索会话 + 新建会话 -->
          <template v-else-if="currentView === 'ai'">
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="size-7 rounded-lg hover:bg-muted active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                  :class="showAiSearch ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'"
                  title="搜索会话"
                  @click="showAiSearch = !showAiSearch"
                >
                  <Search class="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">搜索会话</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="size-7 rounded-lg hover:bg-muted active:scale-95 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  title="新建对话"
                  @click="handleNewAiChatDirect"
                >
                  <Plus class="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">新建对话</TooltipContent>
            </Tooltip>
          </template>
        </div>
      </div>

      <!-- 抽屉主体内容区 (无多余大按钮，视觉极致简洁) -->
      <div class="flex-1 overflow-y-auto px-2 py-2.5 scrollbar-none space-y-1">
        <!-- ================= 模式 A：AI 对话列表 ================= -->
        <template v-if="currentView === 'ai'">
          <!-- 点击放大镜后平滑展开的搜索框 -->
          <div v-if="showAiSearch || aiConversationSearchQuery" class="px-1 mb-2.5 animate-in fade-in-0 duration-150">
            <div class="relative flex items-center w-full">
              <Search class="absolute left-2.5 size-3.5 text-muted-foreground/60 pointer-events-none" />
              <input
                v-model="aiConversationSearchQuery"
                type="text"
                placeholder="搜索会话..."
                autofocus
                class="w-full h-8 pl-8 pr-7 text-xs bg-muted/50 hover:bg-muted/80 focus:bg-background border border-border/50 focus:border-border rounded-xl outline-none transition-all placeholder:text-muted-foreground/60 text-foreground"
              />
              <button
                v-if="aiConversationSearchQuery"
                type="button"
                class="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded-full cursor-pointer"
                @click="aiConversationSearchQuery = ''"
              >
                <X class="size-3" />
              </button>
            </div>
          </div>

          <!-- 对话列表 (单一平铺呈现，无多余折叠分类) -->
          <div class="space-y-1">
            <div
              v-for="conv in activeConversations"
              :key="conv.id"
              class="group/item relative flex items-center rounded-xl text-xs transition-all cursor-pointer select-none"
              :class="
                activeAiConversationId === conv.id
                  ? 'bg-accent font-semibold text-accent-foreground shadow-2xs ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              "
              @click="handleSelectAiChat(conv.id)"
            >
              <div class="flex-1 flex items-center gap-2 py-2 pl-2.5 pr-7 truncate min-w-0">
                <Pin v-if="conv.is_pinned" class="size-3 shrink-0 text-primary" />
                <span class="truncate">{{ conv.title || '新会话' }}</span>
              </div>

              <!-- 更多操作菜单 -->
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button
                    type="button"
                    class="absolute right-1 size-6 rounded-md hover:bg-muted flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer"
                    @click.stop.prevent
                  >
                    <MoreHorizontal class="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" class="w-32 p-1 shadow-md">
                  <DropdownMenuItem class="text-xs cursor-pointer gap-2" @click.stop="handleTogglePin(conv.id, !conv.is_pinned)">
                    <PinOff v-if="conv.is_pinned" class="size-3.5" />
                    <Pin v-else class="size-3.5" />
                    <span>{{ conv.is_pinned ? '取消置顶' : '置顶会话' }}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem class="text-xs cursor-pointer gap-2" @click.stop="openEditConversation(conv)">
                    <Pencil class="size-3.5" />
                    <span>重命名</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="text-xs cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                    @click.stop="handleDeleteAiChat(conv.id)"
                  >
                    <Trash2 class="size-3.5" />
                    <span>删除会话</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div v-if="activeConversations.length === 0" class="py-6 text-center text-[11px] text-muted-foreground/60">
              暂无对话记录
            </div>
          </div>
        </template>

        <!-- ================= 模式 B：在线笔记分类列表 ================= -->
        <template v-else-if="currentView === 'notes'">
          <!-- 点击搜索后平滑展开的笔记搜索框 -->
          <div v-if="showNoteSearch || noteSearchQuery" class="px-1 mb-2 animate-in fade-in-0 duration-150">
            <div class="relative flex items-center w-full">
              <Search class="absolute left-2.5 size-3.5 text-muted-foreground/60 pointer-events-none" />
              <input
                v-model="noteSearchQuery"
                type="text"
                placeholder="搜索笔记..."
                autofocus
                class="w-full h-8 pl-8 pr-7 text-xs bg-muted/50 hover:bg-muted/80 focus:bg-background border border-border/50 focus:border-border rounded-xl outline-none transition-all placeholder:text-muted-foreground/60 text-foreground"
              />
              <button
                v-if="noteSearchQuery"
                type="button"
                class="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded-full cursor-pointer"
                @click="noteSearchQuery = ''"
              >
                <X class="size-3" />
              </button>
            </div>
          </div>

          <!-- 搜索命中笔记列表展示 -->
          <template v-if="noteSearchQuery.trim()">
            <div class="px-2 py-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
              <span>匹配笔记</span>
              <span class="font-mono text-[10px]">{{ searchedNotes.length }}</span>
            </div>
            <div class="space-y-0.5">
              <div
                v-for="n in searchedNotes"
                :key="n.id"
                class="px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer select-none flex items-center gap-2 hover:bg-muted/60"
                :class="selectedNoteId === n.id ? 'bg-accent font-semibold text-accent-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'"
                @click="handleSelectNoteFromSearch(n)"
              >
                <FileText class="size-3.5 shrink-0 text-primary" />
                <span class="truncate flex-1">{{ n.title || '未命名笔记' }}</span>
              </div>
              <div v-if="searchedNotes.length === 0" class="py-4 text-center text-[11px] text-muted-foreground/60">
                未找到匹配笔记
              </div>
            </div>
          </template>

          <!-- 常规笔记分类列表 (去除多余的“笔记分类”小标题，直接顶格呈现) -->
          <template v-else>
            <div class="space-y-1">
              <!-- 全部分类项 -->
              <button
                type="button"
                class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer text-left select-none"
                :class="
                  selectedNoteCategoryId === null
                    ? 'bg-accent font-semibold text-accent-foreground shadow-2xs ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                "
                @click="handleFilterNoteCategory(null)"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div
                    class="size-6 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    :class="selectedNoteCategoryId === null ? 'bg-primary/10 text-primary' : 'bg-muted/70 text-muted-foreground'"
                  >
                    <Folder class="size-3.5 shrink-0" />
                  </div>
                  <span class="truncate">全部分类</span>
                </div>
                <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{{ totalNoteCount }}</span>
              </button>

              <!-- 各具体分类项 (纯净过滤筛选) -->
              <div
                v-for="cat in noteCategories"
                :key="cat.id"
                class="group/note-cat relative flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer select-none"
                :class="
                  selectedNoteCategoryId === cat.id
                    ? 'bg-accent font-semibold text-accent-foreground shadow-2xs ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                "
                @click="handleFilterNoteCategory(cat.id)"
              >
                <div class="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div
                    class="size-6 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    :class="selectedNoteCategoryId === cat.id ? 'bg-primary/10 text-primary' : 'bg-muted/70 text-muted-foreground group-hover/note-cat:text-foreground'"
                  >
                    <component :is="mapIcon(cat?.icon || '')" class="size-3.5 shrink-0" />
                  </div>
                  <span class="truncate">{{ cat.name }}</span>
                </div>
                <span v-if="cat.count !== undefined" class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {{ cat.count }}
                </span>
              </div>
            </div>
          </template>
        </template>

        <!-- ================= 模式 C：网址导航书签分类树 ================= -->
        <template v-else-if="currentView === 'home'">
          <div class="space-y-1">
            <div v-for="cat in topCats" :key="cat.id" class="space-y-0.5">
              <div
                class="group/nav-cat flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer select-none"
                :class="
                  selectedCategoryId === cat.id
                    ? 'bg-accent font-semibold text-accent-foreground shadow-2xs ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                "
                @click="handleSelectCategory(cat.id)"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div
                    class="size-6 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    :class="selectedCategoryId === cat.id ? 'bg-primary/10 text-primary' : 'bg-muted/70 text-muted-foreground group-hover/nav-cat:text-foreground group-hover/nav-cat:bg-muted'"
                  >
                    <component :is="mapIcon(cat?.icon)" class="size-3.5" />
                  </div>
                  <span class="truncate">{{ cat.name }}</span>
                </div>

                <!-- 二级分类折叠箭头 -->
                <button
                  v-if="getSubCats(cat.id).length > 0"
                  type="button"
                  class="size-6 rounded-md hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-transform"
                  :class="{ 'rotate-90': expandedCatIds.has(cat.id) }"
                  @click.stop="toggleSubCats(cat.id)"
                >
                  <ChevronRight class="size-3" />
                </button>
              </div>

              <!-- 二级子分类列表 (树形缩进带微连线) -->
              <div
                v-if="getSubCats(cat.id).length > 0 && expandedCatIds.has(cat.id)"
                class="ml-5 pl-3 border-l-2 border-border/50 my-1 space-y-0.5"
              >
                <button
                  v-for="sub in getSubCats(cat.id)"
                  :key="sub.id"
                  type="button"
                  class="w-full flex items-center gap-1.5 text-left py-1.5 px-2 rounded-lg text-[11.5px] text-muted-foreground hover:text-foreground hover:bg-muted/60 truncate cursor-pointer transition-all active:scale-[0.98]"
                  @click="handleSelectSubCategory(cat.id, sub.id)"
                >
                  <span class="size-1 rounded-full bg-muted-foreground/40 shrink-0"></span>
                  <span class="truncate">{{ sub.name }}</span>
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- ================= 模式 D：系统管理 Tab 列表 ================= -->
        <template v-else-if="currentView === 'admin'">
          <div class="px-2 py-1 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
            <span>管理功能</span>
          </div>
          <div class="space-y-1">
            <button
              v-for="tab in adminTabs"
              :key="tab.value"
              type="button"
              class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left"
              :class="
                selectedAdminTab === tab.value
                  ? 'bg-accent text-accent-foreground font-semibold shadow-2xs ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              "
              @click="handleSelectAdminTab(tab.value)"
            >
              <component :is="tab.icon" class="size-4 shrink-0" />
              <span class="truncate">{{ tab.label }}</span>
            </button>
          </div>
        </template>
      </div>
    </aside>
  </div>

  <!-- ========================================================================= -->
  <!-- 对话框组 (编辑会话)                                                      -->
  <!-- ========================================================================= -->

  <!-- 编辑会话弹窗 -->
  <Dialog :open="showEditConversationModal" @update:open="showEditConversationModal = $event">
    <DialogContent class="sm:max-w-[380px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Pencil class="size-4 text-primary" />
          编辑对话信息
        </DialogTitle>
      </DialogHeader>
      <div class="space-y-3 py-2 text-xs">
        <div class="space-y-1.5">
          <label class="font-medium text-foreground/90">会话标题 <span class="text-destructive">*</span></label>
          <Input
            v-model="editConversationTitle"
            placeholder="输入新的会话标题..."
            class="h-8 text-xs"
            autofocus
            @keydown.enter.prevent="handleSaveEditConversation"
          />
        </div>
        <div class="space-y-1.5">
          <label class="font-medium text-foreground/90">会话图标</label>
          <IconPicker v-model="editConversationIcon" title="选择对话图标" />
        </div>
      </div>
      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" @click="showEditConversationModal = false">取消</Button>
        <Button :disabled="!editConversationTitle.trim()" @click="handleSaveEditConversation">保存修改</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
