<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { mapIcon } from '@/utils/icon-map';
import { useSiteStore } from '@/stores/site';
import { useThemeStore } from '@/stores/theme';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  ChevronRight,
  Compass,
  Bot,
  SquarePen,
  Settings,
  Sun,
  Moon,
  Plus,
  Trash2,
  Pencil,
  MoreHorizontal,
  Folder,
  Bookmark,
  Cpu,
  ShieldCheck,
  Pin,
  PinOff,
  Lock,
  PanelLeft,
  Search,
  X,
  Sparkles,
  Loader2,
} from 'lucide-vue-next';

const siteStore = useSiteStore();
const themeStore = useThemeStore();
const { isMobile, setOpen, toggleSidebar, state } = useSidebar();

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
    bookmarks?: any[];
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
    bookmarks: () => [],
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
  searchBookmark: [query: string];
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

// ===================== 模式切换逻辑 =====================
function handleSwitchMode(mode: 'home' | 'notes' | 'ai' | 'admin') {
  if (mode !== 'home' && !props.isLoggedIn && mode !== 'admin') {
    emit('login', mode);
    return;
  }
  if (mode === 'admin' && !props.isLoggedIn) {
    emit('login', 'admin');
    return;
  }
  emit('changeView', mode);

  if (isMobile.value) {
    // 移动端切换功能页面：不要默认展开副侧边栏，保持收起或直接关闭抽屉
    setOpen(false);
  } else {
    // PC 桌面端：如果之前处于收起折叠状态，点击功能图标自动展开对应副侧边栏
    setOpen(true);
  }
}

// ===================== 抽屉搜索状态与展开控制 =====================
const searchInputQuery = ref('');

// 导航书签搜索在同一行展开/收起
const isBookmarkSearchOpen = ref(false);
const bookmarkSearchInputRef = ref<HTMLInputElement | null>(null);
const bookmarkSearchQuery = ref('');

function openBookmarkSearch() {
  isBookmarkSearchOpen.value = true;
  nextTick(() => {
    bookmarkSearchInputRef.value?.focus();
  });
}

function closeBookmarkSearch() {
  isBookmarkSearchOpen.value = false;
  bookmarkSearchQuery.value = '';
}

watch(bookmarkSearchQuery, (q) => {
  emit('searchBookmark', q);
});

// 笔记搜索在同一行展开/收起
const isNotesSearchOpen = ref(false);
const notesSearchInputRef = ref<HTMLInputElement | null>(null);

function openNotesSearch() {
  isNotesSearchOpen.value = true;
  nextTick(() => {
    notesSearchInputRef.value?.focus();
  });
}

function closeNotesSearch() {
  isNotesSearchOpen.value = false;
  searchInputQuery.value = '';
}

// AI 会话搜索在同一行展开/收起
const isAiSearchOpen = ref(false);
const aiSearchInputRef = ref<HTMLInputElement | null>(null);

function openAiSearch() {
  isAiSearchOpen.value = true;
  nextTick(() => {
    aiSearchInputRef.value?.focus();
  });
}

function closeAiSearch() {
  isAiSearchOpen.value = false;
  searchInputQuery.value = '';
}

watch(searchInputQuery, (q) => {
  if (props.currentView === 'notes') {
    emit('searchNote', q);
  }
});

watch(
  () => props.currentView,
  () => {
    searchInputQuery.value = '';
    isNotesSearchOpen.value = false;
    isAiSearchOpen.value = false;
    bookmarkSearchQuery.value = '';
    isBookmarkSearchOpen.value = false;
    emit('searchBookmark', '');
  }
);

// ===================== 导航书签分类逻辑 =====================
const expandedCatIds = ref<Set<number>>(new Set());

function toggleSubCats(catId: number) {
  if (!getSubCats(catId).length) {
    handleSelectCategory(catId);
    return;
  }
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
  if (isMobile.value) setOpen(false);
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
  if (isMobile.value) setOpen(false);
  nextTick(() => {
    const el = document.getElementById(`sec-${topId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// ===================== 笔记与分类逻辑 =====================
const totalNoteCount = computed(() => props.notes?.length || 0);

function handleFilterNoteCategory(categoryId: number | null) {
  emit('filterNoteCategory', categoryId);
  if (isMobile.value) setOpen(false);
}

function handleCreateNote() {
  emit('createNote');
  if (isMobile.value) setOpen(false);
}

// ===================== AI 对话逻辑 =====================
const filteredAiConversations = computed(() => {
  const q = searchInputQuery.value.trim().toLowerCase();
  let list = (props.aiConversations || []).filter((c) => !c.is_archived);
  if (q) {
    list = list.filter((c) => (c.title || '').toLowerCase().includes(q));
  }
  return [...list].sort((a, b) => (b.is_pinned || 0) - (a.is_pinned || 0));
});

function handleNewAiChatDirect() {
  emit('selectAiProject', null);
  emit('newAiChat');
  if (isMobile.value) setOpen(false);
}

function handleSelectAiChat(id: string) {
  emit('selectAiChat', id);
  if (isMobile.value) setOpen(false);
}

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
const editConversationProjectId = ref<string | null>(null);
const generatingTitle = ref(false);

function isEmoji(str?: string): boolean {
  if (!str) return false;
  if (str.startsWith('pi ') || str.includes('fa-') || str.includes('http')) return false;
  return /\p{Extended_Pictographic}/u.test(str);
}

function openEditConversation(conv: ConversationItem) {
  editingConversation.value = conv;
  editConversationTitle.value = conv.title || '';
  editConversationProjectId.value = conv.project_id || null;
  showEditConversationModal.value = true;
}

async function handleAiGenerateTitle() {
  if (!editingConversation.value) return;
  generatingTitle.value = true;
  try {
    const { data } = await aiApi.generateConversationTitle(editingConversation.value.id);
    if (data?.title) {
      editConversationTitle.value = data.title;
      toast.success('AI 标题生成成功');
    }
  } catch (err: any) {
    toast.error('AI 生成标题失败，请检查模型配置');
  } finally {
    generatingTitle.value = false;
  }
}

async function handleSaveEditConversation() {
  if (!editingConversation.value) return;
  const title = editConversationTitle.value.trim() || '新对话';
  const projectId = editConversationProjectId.value;
  try {
    await aiApi.updateConversation(editingConversation.value.id, {
      title,
      project_id: projectId || null,
    });
    toast.success('已更新会话名称');
    editingConversation.value.title = title;
    editingConversation.value.project_id = projectId || null;
    showEditConversationModal.value = false;
    emit('renameAiChat', editingConversation.value.id, title, undefined, projectId || null);
  } catch (err: any) {
    toast.error(err.response?.data?.error || '更新会话失败');
  }
}

// ===================== 系统设置 Tabs =====================
const adminTabs = [
  { value: 'bookmarks', label: '书签管理', icon: Bookmark },
  { value: 'categories', label: '书签分类', icon: Folder },
  { value: 'note_categories', label: '笔记分类', icon: SquarePen },
  { value: 'ai', label: 'AI 模型配置', icon: Cpu },
  { value: 'security', label: '安全与认证', icon: ShieldCheck },
  { value: 'site', label: '系统常规设置', icon: Settings },
];

function handleSelectAdminTab(tab: string) {
  emit('selectAdminTab', tab);
  if (isMobile.value) setOpen(false);
}
</script>

<template>
  <!-- ========================================================================= -->
  <!-- 官方 Shadcn sidebar-09 架构: 双嵌套侧边栏，折叠时平滑收缩为 52px 图标轨      -->
  <!-- ========================================================================= -->
  <Sidebar
    collapsible="icon"
    class="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
  >
    <!-- 第一轨: 固定 52px 图标轨 (Icon Rail) -->
    <Sidebar
      collapsible="none"
      class="!w-[52px] h-full min-h-full border-r border-sidebar-border shrink-0 flex flex-col items-center justify-between group-data-[collapsible=icon]:border-r-0 select-none bg-sidebar"
      style="padding-top: max(0.75rem, env(safe-area-inset-top, 0px)); padding-bottom: max(1rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)));"
    >
      <!-- 上半部: 展开收起副侧边栏按钮 & 核心导航图标列 -->
      <div class="flex flex-col items-center gap-3.5 w-full">
        <!-- 展开/收缩副侧边栏按钮 (替换原网站图标) -->
        <Tooltip :delay-duration="0">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="size-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer touch-manipulation hover:bg-muted/70 active:scale-95"
              :class="state === 'expanded' ? 'text-foreground bg-muted/40' : 'text-muted-foreground'"
              @click="toggleSidebar"
            >
              <PanelLeft :size="19" :stroke-width="1.8" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {{ state === 'expanded' ? '收起侧边栏' : '展开侧边栏' }}
          </TooltipContent>
        </Tooltip>

        <!-- 核心模式导航列 (图标统一 size-9 rounded-xl，无变形、无文字外溢) -->
        <div class="flex flex-col items-center gap-2 w-full px-1.5">
          <!-- 网址导航 -->
          <Tooltip :delay-duration="0">
            <TooltipTrigger as-child>
              <button
                type="button"
                class="size-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer touch-manipulation"
                :class="
                  currentView === 'home'
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95'
                "
                @click="handleSwitchMode('home')"
              >
                <Compass :size="19" :stroke-width="1.8" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">网址导航</TooltipContent>
          </Tooltip>

          <!-- 在线笔记 -->
          <Tooltip v-if="siteStore.enableNotes" :delay-duration="0">
            <TooltipTrigger as-child>
              <button
                type="button"
                class="size-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer touch-manipulation"
                :class="
                  currentView === 'notes'
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95'
                "
                @click="handleSwitchMode('notes')"
              >
                <SquarePen :size="19" :stroke-width="1.8" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">在线笔记</TooltipContent>
          </Tooltip>

          <!-- AI 对话 -->
          <Tooltip v-if="siteStore.enableAi" :delay-duration="0">
            <TooltipTrigger as-child>
              <button
                type="button"
                class="size-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer touch-manipulation"
                :class="
                  currentView === 'ai'
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95'
                "
                @click="handleSwitchMode('ai')"
              >
                <Bot :size="19" :stroke-width="1.8" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">AI 助手</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <!-- 下半部: 主题切换 & 系统设置 (统一为 size-9 rounded-xl，移除用户图标) -->
      <div class="flex flex-col items-center gap-2 w-full px-1.5 pt-2 border-t border-sidebar-border/50">
        <!-- 主题切换按钮 -->
        <Tooltip :delay-duration="0">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all duration-150 cursor-pointer touch-manipulation"
              @click="themeStore.toggle()"
            >
              <Sun v-if="themeStore.isDark" :size="19" :stroke-width="1.8" />
              <Moon v-else :size="19" :stroke-width="1.8" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{{ themeStore.isDark ? '浅色模式' : '深色模式' }}</TooltipContent>
        </Tooltip>

        <!-- 系统设置按钮 (放到底部) -->
        <Tooltip :delay-duration="0">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="size-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer touch-manipulation"
              :class="
                currentView === 'admin'
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95'
              "
              @click="handleSwitchMode('admin')"
            >
              <Settings :size="19" :stroke-width="1.8" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">系统设置</TooltipContent>
        </Tooltip>
      </div>
    </Sidebar>

    <!-- 第二轨: 弹性内容抽屉 (Content Drawer) -->
    <Sidebar
      collapsible="none"
      class="flex flex-1 md:flex overflow-hidden transition-opacity duration-150 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:pointer-events-none bg-sidebar"
    >
      <div
        class="w-[208px] min-w-[208px] h-full flex flex-col shrink-0 overflow-hidden select-none bg-sidebar"
        style="padding-bottom: env(safe-area-inset-bottom, 0px);"
      >
        <!-- 抽屉头部: 标题与快捷操作 (书签无搜索；笔记和AI在右上角有搜索图标，点击同一行展开) -->
        <SidebarHeader
          class="border-b border-sidebar-border bg-sidebar px-3 flex flex-col justify-center shrink-0"
          style="min-height: calc(2.75rem + env(safe-area-inset-top, 0px)); padding-top: max(0.375rem, env(safe-area-inset-top, 0px)); padding-bottom: 0.375rem;"
        >
          <!-- 1. 网址导航模式：平时显示 导航书签 + 搜索与添加；点击搜索在同一行展开输入框 -->
          <div v-if="currentView === 'home'" class="w-full">
            <!-- 展开的搜索框行 -->
            <div v-if="isBookmarkSearchOpen" class="flex w-full items-center gap-1 animate-in fade-in-0 duration-150">
              <div class="relative flex-1 flex items-center">
                <Search class="absolute left-2.5 size-3.5 text-muted-foreground/60 pointer-events-none" />
                <input
                  ref="bookmarkSearchInputRef"
                  v-model="bookmarkSearchQuery"
                  type="text"
                  placeholder="搜索书签..."
                  class="w-full h-7 pl-8 pr-2.5 text-xs bg-muted/50 focus:bg-background border border-border/50 focus:border-border rounded-md outline-none transition-colors placeholder:text-muted-foreground/60 text-foreground"
                  @keydown.esc="closeBookmarkSearch"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                title="关闭搜索"
                @click="closeBookmarkSearch"
              >
                <X class="h-3.5 w-3.5" />
              </Button>
            </div>

            <!-- 常规标题行 -->
            <div v-else class="flex w-full items-center justify-between">
              <div class="text-sm font-semibold tracking-tight text-foreground truncate whitespace-nowrap">
                导航书签
              </div>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                title="搜索书签"
                @click="openBookmarkSearch"
              >
                <Search class="h-3.5 w-3.5" />
              </Button>
              <Button
                v-if="isLoggedIn"
                variant="ghost"
                size="icon"
                class="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                title="添加书签"
                @click="emit('addBookmark')"
              >
                <Plus class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- 2. 在线笔记模式：平时显示 标题 + 搜索与新建；点击搜索在同一行展开输入框 -->
        <div v-else-if="currentView === 'notes'" class="w-full">
          <!-- 展开的搜索框行 -->
          <div v-if="isNotesSearchOpen" class="flex w-full items-center gap-1 animate-in fade-in-0 duration-150">
            <div class="relative flex-1 flex items-center">
              <Search class="absolute left-2.5 size-3.5 text-muted-foreground/60 pointer-events-none" />
              <input
                ref="notesSearchInputRef"
                v-model="searchInputQuery"
                type="text"
                placeholder="搜索笔记..."
                class="w-full h-7 pl-8 pr-2.5 text-xs bg-muted/50 focus:bg-background border border-border/50 focus:border-border rounded-md outline-none transition-colors placeholder:text-muted-foreground/60 text-foreground"
                @keydown.esc="closeNotesSearch"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
              title="关闭搜索"
              @click="closeNotesSearch"
            >
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>

          <!-- 常规标题行 -->
          <div v-else class="flex w-full items-center justify-between">
            <div class="text-sm font-semibold tracking-tight text-foreground truncate whitespace-nowrap">
              我的笔记
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                title="搜索笔记"
                @click="openNotesSearch"
              >
                <Search class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                title="新建笔记"
                @click="handleCreateNote"
              >
                <Plus class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- 3. AI 对话模式：平时显示 标题 + 搜索与新建；点击搜索在同一行展开输入框 -->
        <div v-else-if="currentView === 'ai'" class="w-full">
          <!-- 展开的搜索框行 -->
          <div v-if="isAiSearchOpen" class="flex w-full items-center gap-1 animate-in fade-in-0 duration-150">
            <div class="relative flex-1 flex items-center">
              <Search class="absolute left-2.5 size-3.5 text-muted-foreground/60 pointer-events-none" />
              <input
                ref="aiSearchInputRef"
                v-model="searchInputQuery"
                type="text"
                placeholder="搜索会话..."
                class="w-full h-7 pl-8 pr-2.5 text-xs bg-muted/50 focus:bg-background border border-border/50 focus:border-border rounded-md outline-none transition-colors placeholder:text-muted-foreground/60 text-foreground"
                @keydown.esc="closeAiSearch"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
              title="关闭搜索"
              @click="closeAiSearch"
            >
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>

          <!-- 常规标题行 -->
          <div v-else class="flex w-full items-center justify-between">
            <div class="text-sm font-semibold tracking-tight text-foreground truncate whitespace-nowrap">
              AI 对话
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                title="搜索会话"
                @click="openAiSearch"
              >
                <Search class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                title="新建会话"
                @click="handleNewAiChatDirect"
              >
                <Plus class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- 4. 系统管理模式：仅标题 -->
        <div v-else-if="currentView === 'admin'" class="flex w-full items-center justify-between">
          <div class="text-sm font-semibold tracking-tight text-foreground truncate whitespace-nowrap">
            系统管理
          </div>
        </div>
      </SidebarHeader>

      <!-- 抽屉内容区: 隐藏原生滚动条，平滑浏览 -->
      <SidebarContent class="p-0 overflow-y-auto no-scrollbar">
        <!-- 1. 网址导航模式：书签分类树 (始终展示分类树，搜索结果在页面呈现) -->
        <SidebarGroup v-if="currentView === 'home'" class="p-1.5 space-y-1">
          <div
            v-for="cat in topCats"
            :key="cat.id"
            class="space-y-1"
          >
            <!-- 顶级分类条目 (所有一级分类均显示箭头) -->
            <div
              class="group/cat flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
              :class="
                selectedCategoryId === cat.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground'
              "
              @click="handleSelectCategory(cat.id)"
            >
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span v-if="isEmoji(cat.icon)" class="text-sm shrink-0 leading-none">{{ cat.icon }}</span>
                <component v-else :is="mapIcon(cat.icon)" class="size-4 shrink-0 text-muted-foreground" />
                <span class="truncate">{{ cat.name }}</span>
                <Lock v-if="cat.is_private" class="h-3 w-3 shrink-0 text-amber-500" />
              </div>
              <button
                type="button"
                class="p-0.5 rounded text-muted-foreground hover:text-foreground transition-transform"
                :class="expandedCatIds.has(cat.id) && getSubCats(cat.id).length ? 'rotate-90' : ''"
                @click.stop="toggleSubCats(cat.id)"
              >
                <ChevronRight class="h-3.5 w-3.5" />
              </button>
            </div>

            <!-- 子分类列表 -->
            <div
              v-if="expandedCatIds.has(cat.id) && getSubCats(cat.id).length"
              class="pl-6 pr-1 space-y-1 border-l border-sidebar-border/40 ml-3.5 my-1"
            >
              <div
                v-for="sub in getSubCats(cat.id)"
                :key="sub.id"
                class="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 cursor-pointer transition-colors"
                @click="handleSelectSubCategory(cat.id, sub.id)"
              >
                <span v-if="isEmoji(sub.icon)" class="text-xs shrink-0 leading-none">{{ sub.icon }}</span>
                <component v-else :is="mapIcon(sub.icon)" class="size-3.5 shrink-0 text-muted-foreground" />
                <span class="truncate">{{ sub.name }}</span>
                <Lock v-if="sub.is_private" class="h-2.5 w-2.5 shrink-0 text-amber-500 ml-auto" />
              </div>
            </div>
          </div>
          <div
            v-if="!topCats.length"
            class="py-10 text-center text-xs text-muted-foreground"
          >
            暂无分类
          </div>
        </SidebarGroup>

        <!-- 2. 在线笔记模式：笔记分类列表 (始终展示分类列表，搜索结果在页面呈现) -->
        <SidebarGroup v-else-if="currentView === 'notes'" class="p-1.5 space-y-1">
          <!-- 全部分类 -->
          <button
            type="button"
            class="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left select-none"
            :class="
              selectedNoteCategoryId === null
                ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
            "
            @click="handleFilterNoteCategory(null)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <Folder class="size-4 shrink-0 text-primary" />
              <span class="truncate font-medium">全部分类</span>
            </div>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {{ totalNoteCount }}
            </span>
          </button>

          <!-- 各具体分类项 -->
          <button
            v-for="cat in noteCategories"
            :key="cat.id"
            type="button"
            class="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left select-none"
            :class="
              selectedNoteCategoryId === cat.id
                ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
            "
            @click="handleFilterNoteCategory(cat.id)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span v-if="isEmoji(cat?.icon)" class="text-sm shrink-0 leading-none">{{ cat.icon }}</span>
              <component v-else :is="mapIcon(cat?.icon || '')" class="size-4 shrink-0 text-muted-foreground" />
              <span class="truncate">{{ cat.name }}</span>
            </div>
            <span v-if="cat.count !== undefined" class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {{ cat.count }}
            </span>
          </button>

          <div v-if="!noteCategories?.length" class="py-6 text-center text-xs text-muted-foreground">
            暂无笔记分类
          </div>
        </SidebarGroup>

        <!-- 3. AI 对话模式：会话列表 -->
        <SidebarGroup v-else-if="currentView === 'ai'" class="p-1.5 space-y-0.5">
          <div
            v-for="conv in filteredAiConversations"
            :key="conv.id"
            class="group/conv flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors"
            :class="
              activeAiConversationId === conv.id
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                : 'text-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground'
            "
            @click="handleSelectAiChat(conv.id)"
          >
            <div class="flex items-center gap-1.5 min-w-0 flex-1">
              <span class="truncate">{{ conv.title || '新对话' }}</span>
              <Pin v-if="conv.is_pinned" class="h-3 w-3 shrink-0 text-primary ml-auto mr-1" />
            </div>

            <!-- 操作下拉菜单 -->
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  class="opacity-0 group-hover/conv:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-opacity"
                  @click.stop
                >
                  <MoreHorizontal class="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-36">
                <DropdownMenuItem
                  class="cursor-pointer text-xs"
                  @click.stop="handleTogglePin(conv.id, !conv.is_pinned)"
                >
                  <PinOff v-if="conv.is_pinned" class="mr-2 h-3.5 w-3.5" />
                  <Pin v-else class="mr-2 h-3.5 w-3.5" />
                  <span>{{ conv.is_pinned ? '取消置顶' : '置顶会话' }}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="cursor-pointer text-xs"
                  @click.stop="openEditConversation(conv)"
                >
                  <Pencil class="mr-2 h-3.5 w-3.5" />
                  <span>重命名</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="cursor-pointer text-xs text-destructive focus:text-destructive"
                  @click.stop="emit('deleteAiChat', conv.id)"
                >
                  <Trash2 class="mr-2 h-3.5 w-3.5" />
                  <span>删除会话</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div
            v-if="!filteredAiConversations.length"
            class="py-10 text-center text-xs text-muted-foreground"
          >
            暂无对话记录
          </div>
        </SidebarGroup>

        <!-- 4. 系统管理模式：Tab 列表 -->
        <SidebarGroup v-else-if="currentView === 'admin'" class="p-1.5 space-y-1">
          <button
            v-for="tab in adminTabs"
            :key="tab.value"
            type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer text-left"
            :class="
              selectedAdminTab === tab.value
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                : 'text-muted-foreground'
            "
            @click="handleSelectAdminTab(tab.value)"
          >
            <component :is="tab.icon" class="h-4 w-4 shrink-0" />
            <span>{{ tab.label }}</span>
          </button>
        </SidebarGroup>
      </SidebarContent>
      </div>
    </Sidebar>

    <!-- 编辑 AI 对话信息弹窗 -->
    <Dialog v-model:open="showEditConversationModal">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>编辑会话</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-foreground">会话标题</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-6 px-2 text-xs text-primary gap-1 cursor-pointer hover:bg-primary/10 transition-colors"
                :disabled="generatingTitle"
                @click="handleAiGenerateTitle"
              >
                <Loader2 v-if="generatingTitle" class="size-3 animate-spin" />
                <Sparkles v-else class="size-3" />
                <span>{{ generatingTitle ? 'AI 正在提炼...' : 'AI 生成标题' }}</span>
              </Button>
            </div>
            <Input
              v-model="editConversationTitle"
              placeholder="输入会话标题..."
              class="text-xs"
              @keyup.enter="handleSaveEditConversation"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEditConversationModal = false">取消</Button>
          <Button @click="handleSaveEditConversation">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Sidebar>
</template>
