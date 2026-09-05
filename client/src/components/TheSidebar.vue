<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { mapIcon } from '@/utils/icon-map';
import { useSiteStore } from '@/stores/site';
import { useThemeStore } from '@/stores/theme';
import { useAuthStore } from '@/stores/auth';
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
  SidebarTrigger,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
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
import { noteCategoryApi, aiApi } from '@/api';
import { toast } from '@/components/ui/sonner';
import IconPicker from '@/components/IconPicker.vue';
import { confirmBox } from '@/utils/confirm';
import {
  ChevronsUpDown,
  ChevronRight,
  Compass,
  Bot,
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
  Archive,
  ArchiveRestore,
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


const activeModeIcon = computed(() => {
  if (props.currentView === 'notes') return FileText;
  if (props.currentView === 'ai') return Bot;
  if (props.currentView === 'admin') return Settings;
  return Compass;
});

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

function handleSwitchMode(mode: 'home' | 'notes' | 'ai' | 'admin') {
  if (mode !== 'home' && !props.isLoggedIn && mode !== 'admin') {
    emit('login', mode);
    if (isMobile.value) setOpenMobile(false);
    return;
  }
  if (mode === 'admin') {
    handleSettings();
    return;
  }
  emit('changeView', mode);
  if (isMobile.value) setOpenMobile(false);
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

function handleSettings() {
  if (props.isLoggedIn) {
    emit('changeView', 'admin');
  } else {
    emit('login', 'admin');
  }
  if (isMobile.value) setOpenMobile(false);
}

function handleLogout() {
  authStore.logout();
  emit('changeView', 'home');
  if (isMobile.value) setOpenMobile(false);
}

function handleCreateNoteDirect() {
  handleSwitchMode('notes');
  emit('createNote');
  if (isMobile.value) setOpenMobile(false);
}

function handleNewAiChatDirect() {
  handleSwitchMode('ai');
  emit('selectAiProject', null);
  emit('newAiChat');
  if (isMobile.value) setOpenMobile(false);
}

function handleFilterNoteCategory(categoryId: number | null) {
  if (props.currentView !== 'notes') {
    handleSwitchMode('notes');
  }
  emit('filterNoteCategory', categoryId);
  if (isMobile.value) setOpenMobile(false);
}

function handleSelectAiChat(id: string) {
  if (props.currentView !== 'ai') {
    handleSwitchMode('ai');
  }
  emit('selectAiChat', id);
  if (isMobile.value) setOpenMobile(false);
}

function handleDeleteAiChat(id: string) {
  emit('deleteAiChat', id);
}

// 会话与归档折叠状态
const isChatExpanded = ref(true);
const isArchivedExpanded = ref(false);

const activeConversations = computed(() => {
  return (props.aiConversations || []).filter(c => !c.is_archived);
});

const archivedConversations = computed(() => {
  return (props.aiConversations || []).filter(c => !!c.is_archived);
});

async function handleTogglePin(id: string, isPinned: boolean) {
  try {
    await aiApi.updateConversation(id, { is_pinned: isPinned ? 1 : 0 });
    toast.success(isPinned ? '已置顶会话' : '已取消置顶');
    emit('refreshAiChat');
  } catch (err: any) {
    toast.error('操作失败');
  }
}

async function handleToggleArchive(id: string, isArchived: boolean) {
  try {
    await aiApi.updateConversation(id, { is_archived: isArchived ? 1 : 0 });
    toast.success(isArchived ? '已归档会话' : '已恢复会话');
    emit('refreshAiChat');
  } catch (err: any) {
    toast.error('操作失败');
  }
}

// AI 会话编辑状态与弹窗
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

// 系统设置管理 Tab 项
const adminTabs = [
  { value: 'bookmarks', label: '书签管理', icon: Bookmark },
  { value: 'categories', label: '分类管理', icon: Folder },
  { value: 'ai', label: 'AI 模型配置', icon: Cpu },
  { value: 'security', label: '安全与认证', icon: ShieldCheck },
  { value: 'site', label: '系统常规设置', icon: Settings },
];

function handleSelectAdminTab(tab: string) {
  emit('selectAdminTab', tab);
  if (isMobile.value) setOpenMobile(false);
}

// 笔记分类管理状态与弹窗
const showCreateCategoryModal = ref(false);
const showEditCategoryModal = ref(false);
const newCategoryName = ref('');
const newCategoryIcon = ref('pi pi-folder');
const editingCategory = ref<any>(null);
const editCategoryName = ref('');
const editCategoryIcon = ref('pi pi-folder');

function openCreateCategory() {
  newCategoryName.value = '';
  newCategoryIcon.value = 'pi pi-folder';
  showCreateCategoryModal.value = true;
}

async function handleCreateCategory() {
  const name = newCategoryName.value.trim();
  if (!name) return;
  try {
    await noteCategoryApi.create({ name, icon: newCategoryIcon.value });
    toast.success('分类创建成功');
    newCategoryName.value = '';
    showCreateCategoryModal.value = false;
    emit('createNoteCategory');
  } catch (err: any) {
    toast.error(err.response?.data?.error || '创建分类失败');
  }
}

function openEditCategory(cat: any) {
  editingCategory.value = cat;
  editCategoryName.value = cat.name;
  editCategoryIcon.value = cat.icon || 'pi pi-folder';
  showEditCategoryModal.value = true;
}

async function handleSaveEditCategory() {
  if (!editingCategory.value) return;
  const name = editCategoryName.value.trim();
  if (!name) return;
  try {
    await noteCategoryApi.update(editingCategory.value.id, { name, icon: editCategoryIcon.value });
    toast.success('分类已修改');
    showEditCategoryModal.value = false;
    emit('createNoteCategory');
  } catch (err: any) {
    toast.error(err.response?.data?.error || '修改分类失败');
  }
}

async function handleDeleteCategory(cat: any) {
  try {
    await confirmBox(
      `确定要删除分类 "${cat.name}" 吗？该分类下的笔记将变为未分类。`,
      '确定删除分类？'
    );
    await noteCategoryApi.delete(cat.id);
    toast.success('分类已删除');
    if (props.selectedNoteCategoryId === cat.id) {
      emit('filterNoteCategory', null);
    }
    emit('createNoteCategory');
  } catch (err: any) {
    if (err?.message === 'cancel') return;
    toast.error(err.response?.data?.error || '删除分类失败');
  }
}
</script>

<template>
  <Sidebar collapsible="icon" variant="sidebar">
    <!-- Header: Grok 风格极简品牌与折叠开关 -->
    <SidebarHeader class="p-3 pb-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:py-2.5 border-b border-border/40">
      <div class="flex items-center justify-between w-full min-w-0 group-data-[collapsible=icon]:hidden">
        <div
          class="flex items-center gap-2.5 min-w-0 cursor-pointer select-none group/logo"
          title="返回主页"
          @click="handleSwitchMode('home')"
        >
          <div class="flex aspect-square size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow-xs shrink-0 group-hover/logo:scale-105 transition-transform">
            <component :is="activeModeIcon" class="size-3.5" />
          </div>
          <span class="truncate font-semibold text-sm text-foreground tracking-tight">{{ siteStore.siteName || 'ZenLink' }}</span>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <SidebarTrigger
            class="size-7 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md cursor-pointer"
            title="收起侧边栏"
          />
        </div>
      </div>

      <!-- 收起状态下 (图标模式)：居中只显示展开按钮 -->
      <div class="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full">
        <SidebarTrigger
          class="size-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md cursor-pointer"
          title="展开侧边栏"
        />
      </div>
    </SidebarHeader>

    <!-- Content: 专属上下文 (根据当前激活模式精准呈现) -->
    <SidebarContent class="px-2 py-2 scrollbar-none">
      <!-- ================= 模式 A：AI 对话专属列表 (Grok 风格：置顶新聊天 + 聊天列表（带置顶且可折叠） + 默认折叠的归档) ================= -->
      <template v-if="currentView === 'ai'">
        <!-- 1. 置顶主入口：聊天 (默认开启新聊天) -->
        <div class="px-1 mb-2">
          <SidebarMenuButton
            :is-active="!activeAiConversationId || activeAiConversationId === ''"
            tooltip="新聊天"
            class="h-9 px-2.5 rounded-xl cursor-pointer text-[13.5px] font-medium transition-all"
            :class="!activeAiConversationId || activeAiConversationId === '' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-2xs' : 'text-foreground/90 hover:text-foreground hover:bg-sidebar-accent/50'"
            @click="handleNewAiChatDirect"
          >
            <Pencil class="size-4 shrink-0" :class="!activeAiConversationId || activeAiConversationId === '' ? 'text-primary' : 'text-muted-foreground'" />
            <span class="truncate text-[13.5px] font-medium">聊天</span>
          </SidebarMenuButton>
        </div>

        <!-- 2. 聊天列表 (可展开收缩，箭头紧跟文字右侧) -->
        <SidebarGroup class="p-0">
          <div class="px-1 mb-0.5">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/60 hover:text-foreground/80 px-2 py-1 rounded-md select-none cursor-pointer transition-colors"
              @click="isChatExpanded = !isChatExpanded"
            >
              <span>聊天</span>
              <ChevronRight class="size-3 text-muted-foreground/50 transition-transform duration-200" :class="{ 'rotate-90': isChatExpanded }" />
            </button>
          </div>

          <SidebarGroupContent v-show="isChatExpanded">
            <SidebarMenu v-if="activeConversations.length > 0">
              <SidebarMenuItem v-for="conv in activeConversations" :key="conv.id">
                <SidebarMenuButton
                  :is-active="activeAiConversationId === conv.id"
                  :tooltip="conv.title || '新会话'"
                  class="h-8 px-2 rounded-lg cursor-pointer text-[13px] font-normal group/chat-item flex items-center gap-1.5 transition-colors"
                  :class="activeAiConversationId === conv.id ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-2xs' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40'"
                  @click="handleSelectAiChat(conv.id)"
                >
                  <Pin v-if="conv.is_pinned" class="size-3 shrink-0 text-primary" />
                  <span class="truncate">{{ conv.title || '新会话' }}</span>
                </SidebarMenuButton>

                <!-- 对话管理操作 (置顶/取消置顶、归档、重命名、删除) -->
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <SidebarMenuAction
                      class="opacity-0 group-hover/menu-item:opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                      title="对话操作"
                      @click.stop.prevent
                      @pointerdown.stop
                    >
                      <MoreHorizontal class="size-3.5" />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom" :side-offset="4" class="w-32 p-1 shadow-md">
                    <DropdownMenuItem class="text-xs cursor-pointer gap-2" @click.stop="handleTogglePin(conv.id, !conv.is_pinned)">
                      <PinOff v-if="conv.is_pinned" class="size-3.5 shrink-0 text-muted-foreground" />
                      <Pin v-else class="size-3.5 shrink-0 text-muted-foreground" />
                      <span>{{ conv.is_pinned ? '取消置顶' : '置顶对话' }}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem class="text-xs cursor-pointer gap-2" @click.stop="handleToggleArchive(conv.id, true)">
                      <Archive class="size-3.5 shrink-0 text-muted-foreground" />
                      <span>归档对话</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem class="text-xs cursor-pointer gap-2" @click.stop="openEditConversation(conv)">
                      <Pencil class="size-3.5 shrink-0 text-muted-foreground" />
                      <span>重命名</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="text-xs cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                      @click.stop="handleDeleteAiChat(conv.id)"
                    >
                      <Trash2 class="size-3.5 shrink-0" />
                      <span>删除对话</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>

            <div v-else class="py-4 text-center text-xs text-muted-foreground/60">
              暂无对话记录
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <!-- 3. 归档对话折叠区块 (默认不展开，箭头紧跟文字右侧) -->
        <div v-if="archivedConversations.length > 0" class="mt-2.5 px-1">
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/60 hover:text-foreground/80 px-2 py-1 rounded-md select-none cursor-pointer transition-colors"
            @click="isArchivedExpanded = !isArchivedExpanded"
          >
            <span>归档对话 ({{ archivedConversations.length }})</span>
            <ChevronRight class="size-3 text-muted-foreground/50 transition-transform duration-200" :class="{ 'rotate-90': isArchivedExpanded }" />
          </button>

          <div v-show="isArchivedExpanded" class="mt-0.5 space-y-0.5">
            <SidebarMenu>
              <SidebarMenuItem v-for="conv in archivedConversations" :key="conv.id">
                <SidebarMenuButton
                  :is-active="activeAiConversationId === conv.id"
                  :tooltip="conv.title || '归档会话'"
                  class="h-8 px-2 rounded-lg cursor-pointer text-[13px] font-normal group/chat-item opacity-80 hover:opacity-100 flex items-center gap-1.5 transition-colors"
                  :class="activeAiConversationId === conv.id ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-2xs' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40'"
                  @click="handleSelectAiChat(conv.id)"
                >
                  <Archive class="size-3 shrink-0 text-muted-foreground" />
                  <span class="truncate">{{ conv.title || '归档会话' }}</span>
                </SidebarMenuButton>

                <!-- 归档对话操作菜单 (取消归档、重命名、删除) -->
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <SidebarMenuAction
                      class="opacity-0 group-hover/menu-item:opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                      title="操作"
                      @click.stop.prevent
                      @pointerdown.stop
                    >
                      <MoreHorizontal class="size-3.5" />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom" :side-offset="4" class="w-32 p-1 shadow-md">
                    <DropdownMenuItem class="text-xs cursor-pointer gap-2" @click.stop="handleToggleArchive(conv.id, false)">
                      <ArchiveRestore class="size-3.5 shrink-0 text-muted-foreground" />
                      <span>取消归档</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem class="text-xs cursor-pointer gap-2" @click.stop="openEditConversation(conv)">
                      <Pencil class="size-3.5 shrink-0 text-muted-foreground" />
                      <span>重命名</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="text-xs cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                      @click.stop="handleDeleteAiChat(conv.id)"
                    >
                      <Trash2 class="size-3.5 shrink-0" />
                      <span>删除</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </div>
      </template>

      <!-- ================= 模式 B：在线笔记专属列表 (笔记分类) ================= -->
      <template v-else-if="currentView === 'notes'">
        <!-- 新建笔记按钮 -->
        <div class="px-1 mb-2 group-data-[collapsible=icon]:hidden">
          <Button
            variant="outline"
            class="w-full justify-start gap-2 h-8 px-2.5 text-xs font-medium rounded-lg border-border/70 hover:border-primary/50 hover:text-primary hover:bg-primary/5 cursor-pointer shadow-none transition-all"
            @click="handleCreateNoteDirect"
          >
            <Plus class="size-3.5 text-primary" />
            <span>新建笔记</span>
          </Button>
        </div>

        <SidebarGroup class="p-0">
          <SidebarGroupLabel class="px-2 text-[11px] font-medium text-muted-foreground flex items-center justify-between">
            <span>笔记分类</span>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-sidebar-accent cursor-pointer transition-colors"
              title="新建分类"
              @click="openCreateCategory"
            >
              <Plus class="size-3.5" />
            </button>
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              <!-- 全部分类项 -->
              <SidebarMenuItem>
                <SidebarMenuButton
                  :is-active="selectedNoteCategoryId === null"
                  tooltip="全部分类"
                  class="h-8 px-2 rounded-lg cursor-pointer text-xs pr-14"
                  :class="selectedNoteCategoryId === null ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40'"
                  @click="handleFilterNoteCategory(null)"
                >
                  <Folder class="size-3.5 shrink-0 transition-colors" />
                  <span class="truncate">全部分类</span>
                  <SidebarMenuBadge class="right-2">{{ totalNoteCount }}</SidebarMenuBadge>
                </SidebarMenuButton>

                <SidebarMenuAction
                  class="cursor-pointer text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                  title="新建分类"
                  @click.stop.prevent="openCreateCategory"
                  @pointerdown.stop
                >
                  <Plus class="size-3.5" />
                </SidebarMenuAction>
              </SidebarMenuItem>

              <!-- 各笔记分类项 -->
              <SidebarMenuItem v-for="cat in noteCategories" :key="cat.id">
                <SidebarMenuButton
                  :is-active="selectedNoteCategoryId === cat.id"
                  :tooltip="cat.name"
                  class="h-8 px-2 rounded-lg cursor-pointer text-xs pr-14"
                  :class="selectedNoteCategoryId === cat.id ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40'"
                  @click="handleFilterNoteCategory(cat.id)"
                >
                  <component :is="mapIcon(cat?.icon || '')" class="size-3.5 shrink-0 transition-colors" />
                  <span class="truncate">{{ cat.name }}</span>
                  <SidebarMenuBadge v-if="cat.count !== undefined" class="right-2">{{ cat.count }}</SidebarMenuBadge>
                </SidebarMenuButton>

                <!-- 分类管理操作 (编辑、删除) -->
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <SidebarMenuAction
                      class="opacity-0 group-hover/menu-item:opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                      title="分类操作"
                      @click.stop.prevent
                      @pointerdown.stop
                    >
                      <MoreHorizontal class="size-3.5" />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom" :side-offset="4" class="w-28 p-1 shadow-md">
                    <DropdownMenuItem class="text-xs cursor-pointer gap-2" @click.stop="openEditCategory(cat)">
                      <Pencil class="size-3.5 shrink-0 text-muted-foreground" />
                      <span>编辑分类</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="text-xs cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                      @click.stop="handleDeleteCategory(cat)"
                    >
                      <Trash2 class="size-3.5 shrink-0" />
                      <span>删除分类</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </template>

      <!-- ================= 模式 C：网址导航专属列表 (书签分类树) ================= -->
      <template v-else-if="currentView === 'home'">
        <SidebarGroup class="p-0">
          <SidebarGroupLabel class="px-2 text-[11px] font-medium text-muted-foreground">
            <span>分类导航</span>
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="cat in topCats" :key="cat.id">
                <SidebarMenuButton
                  :is-active="selectedCategoryId === cat.id"
                  :tooltip="cat.name"
                  class="h-8 px-2 rounded-lg cursor-pointer text-xs"
                  :class="selectedCategoryId === cat.id ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40'"
                  @click="handleSelectCategory(cat.id)"
                >
                  <component
                    :is="mapIcon(cat?.icon)"
                    class="size-3.5 shrink-0 transition-colors"
                  />
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
                      class="cursor-pointer text-xs"
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

      <!-- ================= 模式 D：系统设置侧边栏 (显示各设置 Tab) ================= -->
      <template v-else-if="currentView === 'admin'">
        <SidebarGroup class="p-0">
          <SidebarGroupLabel class="px-2 text-[11px] font-medium text-muted-foreground">
            <span>系统管理</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="tab in adminTabs" :key="tab.value">
                <SidebarMenuButton
                  :is-active="selectedAdminTab === tab.value"
                  :tooltip="tab.label"
                  class="h-8 px-2 rounded-lg cursor-pointer text-xs"
                  :class="selectedAdminTab === tab.value ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40'"
                  @click="handleSelectAdminTab(tab.value)"
                >
                  <component :is="tab.icon" class="size-3.5 shrink-0" />
                  <span class="truncate">{{ tab.label }}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </template>
    </SidebarContent>

    <!-- Footer: 底部横向三功能切换栏 + NavUser 用户卡片 -->
    <SidebarFooter class="p-2 pt-1.5 gap-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:py-2">
      <!-- 底部横向三功能切换栏 (展开时横向等宽排布，收起折叠时垂直居中堆叠) -->
      <div class="flex items-center p-1 rounded-xl bg-muted/60 border border-border/40 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:p-0 gap-1 shrink-0">
        <!-- 网址导航 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer select-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:flex-none"
              :class="currentView === 'home' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
              @click="handleSwitchMode('home')"
            >
              <Compass class="size-3.5 shrink-0" :class="currentView === 'home' ? 'text-primary' : ''" />
              <span class="truncate group-data-[collapsible=icon]:hidden">导航</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">网址导航 (⌘1)</TooltipContent>
        </Tooltip>

        <!-- 在线笔记 -->
        <Tooltip v-if="siteStore.enableNotes">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer select-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:flex-none"
              :class="currentView === 'notes' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
              @click="handleSwitchMode('notes')"
            >
              <FileText class="size-3.5 shrink-0" :class="currentView === 'notes' ? 'text-primary' : ''" />
              <span class="truncate group-data-[collapsible=icon]:hidden">笔记</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">在线笔记 (⌘2)</TooltipContent>
        </Tooltip>

        <!-- AI 对话 -->
        <Tooltip v-if="siteStore.enableAi">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer select-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:flex-none"
              :class="currentView === 'ai' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
              @click="handleSwitchMode('ai')"
            >
              <Bot class="size-3.5 shrink-0" :class="currentView === 'ai' ? 'text-primary' : ''" />
              <span class="truncate group-data-[collapsible=icon]:hidden">AI</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">AI 对话 (⌘3)</TooltipContent>
        </Tooltip>
      </div>

      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                size="lg"
                class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:mx-auto"
                title="账户与系统设置"
              >
                <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted border text-foreground font-bold text-sm shadow-xs overflow-hidden shrink-0">
                  <User class="size-4 text-muted-foreground" />
                </div>
                <div class="grid flex-1 text-left text-xs leading-tight min-w-0 group-data-[collapsible=icon]:hidden">
                  <span class="truncate font-semibold text-foreground tracking-tight">{{ userDisplayName }}</span>
                  <span class="truncate text-[11px] text-muted-foreground">{{ userRoleDesc }}</span>
                </div>
                <ChevronsUpDown class="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              class="w-60 rounded-xl p-1.5 shadow-lg"
              align="end"
              :side="isMobile ? 'top' : 'right'"
              :side-offset="8"
            >
              <DropdownMenuLabel class="text-[11px] text-muted-foreground px-2 py-1 font-medium">
                工作空间与模式
              </DropdownMenuLabel>

              <DropdownMenuItem
                class="gap-2.5 p-2 rounded-lg cursor-pointer text-xs"
                :class="{ 'bg-sidebar-accent text-sidebar-accent-foreground font-medium': currentView === 'home' }"
                @click="handleSwitchMode('home')"
              >
                <div class="flex size-6 items-center justify-center rounded-sm border bg-background shrink-0">
                  <Compass class="size-3.5 text-foreground" />
                </div>
                <span class="truncate flex-1 font-medium">网址导航</span>
                <DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuItem
                v-if="siteStore.enableNotes"
                class="gap-2.5 p-2 rounded-lg cursor-pointer text-xs"
                :class="{ 'bg-sidebar-accent text-sidebar-accent-foreground font-medium': currentView === 'notes' }"
                @click="handleSwitchMode('notes')"
              >
                <div class="flex size-6 items-center justify-center rounded-sm border bg-background shrink-0">
                  <FileText class="size-3.5 text-foreground" />
                </div>
                <span class="truncate flex-1 font-medium">在线笔记</span>
                <DropdownMenuShortcut>⌘2</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuItem
                v-if="siteStore.enableAi"
                class="gap-2.5 p-2 rounded-lg cursor-pointer text-xs"
                :class="{ 'bg-sidebar-accent text-sidebar-accent-foreground font-medium': currentView === 'ai' }"
                @click="handleSwitchMode('ai')"
              >
                <div class="flex size-6 items-center justify-center rounded-sm border bg-background shrink-0">
                  <Bot class="size-3.5 text-foreground" />
                </div>
                <span class="truncate flex-1 font-medium">AI 对话助手</span>
                <DropdownMenuShortcut>⌘3</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuSeparator class="my-1" />

              <DropdownMenuLabel class="text-[11px] text-muted-foreground px-2 py-1 font-medium">
                偏好设置与账户
              </DropdownMenuLabel>

              <DropdownMenuItem class="gap-2.5 p-2 rounded-lg cursor-pointer text-xs" @click="themeStore.toggle($event)">
                <Sun v-if="themeStore.isDark" class="size-4" />
                <Moon v-else class="size-4" />
                <span>{{ themeStore.isDark ? '切换浅色模式' : '切换深色模式' }}</span>
              </DropdownMenuItem>

              <DropdownMenuItem class="gap-2.5 p-2 rounded-lg cursor-pointer text-xs" @click="handleSettings">
                <Settings class="size-4" />
                <span>系统管理设置</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator class="my-1" />

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
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <!-- Edge Rail for expanding / resizing / toggling -->
    <SidebarRail />

    <!-- 新建分类弹窗 -->
    <Dialog :open="showCreateCategoryModal" @update:open="showCreateCategoryModal = $event">
      <DialogContent class="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Folder class="size-4 text-primary" />
            新建笔记分类
          </DialogTitle>
        </DialogHeader>
        <div class="space-y-3 py-2 text-xs">
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">分类名称 <span class="text-destructive">*</span></label>
            <Input
              v-model="newCategoryName"
              placeholder="输入分类名称..."
              class="h-8 text-xs"
              autofocus
              @keydown.enter.prevent="handleCreateCategory"
            />
          </div>
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">分类图标</label>
            <IconPicker v-model="newCategoryIcon" title="选择分类图标" />
          </div>
        </div>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showCreateCategoryModal = false">取消</Button>
          <Button :disabled="!newCategoryName.trim()" @click="handleCreateCategory">确定创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 编辑分类弹窗 -->
    <Dialog :open="showEditCategoryModal" @update:open="showEditCategoryModal = $event">
      <DialogContent class="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Pencil class="size-4 text-primary" />
            编辑笔记分类
          </DialogTitle>
        </DialogHeader>
        <div class="space-y-3 py-2 text-xs">
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">分类名称 <span class="text-destructive">*</span></label>
            <Input
              v-model="editCategoryName"
              placeholder="输入新的分类名称..."
              class="h-8 text-xs"
              autofocus
              @keydown.enter.prevent="handleSaveEditCategory"
            />
          </div>
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">分类图标</label>
            <IconPicker v-model="editCategoryIcon" title="选择分类图标" />
          </div>
        </div>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showEditCategoryModal = false">取消</Button>
          <Button :disabled="!editCategoryName.trim()" @click="handleSaveEditCategory">保存修改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
  </Sidebar>
</template>
