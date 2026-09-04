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
import { noteCategoryApi } from '@/api';
import { toast } from '@/components/ui/sonner';
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
  MessageSquare,
  User,
  LogOut,
  LogIn,
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
    noteCategories?: NoteCategoryItem[];
    selectedNoteTag?: string | null;
    selectedNoteCategoryId?: number | null;
    selectedNoteId?: number | null;
    aiConversations?: ConversationItem[];
    activeAiConversationId?: string | null;
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

const activeModeTitle = computed(() => {
  if (props.currentView === 'notes') return '在线笔记';
  if (props.currentView === 'ai') return 'AI 助手';
  if (props.currentView === 'admin') return '系统管理';
  return siteStore.siteName || '网址导航';
});

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

function handleFilterNoteCategory(categoryId: number | null) {
  emit('filterNoteCategory', categoryId);
  if (isMobile.value) setOpenMobile(false);
}

function handleSelectAiChat(id: string) {
  emit('selectAiChat', id);
  if (isMobile.value) setOpenMobile(false);
}

function handleDeleteAiChat(id: string) {
  emit('deleteAiChat', id);
}

// 笔记分类管理状态与弹窗
const showCreateCategoryModal = ref(false);
const showEditCategoryModal = ref(false);
const newCategoryName = ref('');
const editingCategory = ref<any>(null);
const editCategoryName = ref('');

function openCreateCategory() {
  newCategoryName.value = '';
  showCreateCategoryModal.value = true;
}

async function handleCreateCategory() {
  const name = newCategoryName.value.trim();
  if (!name) return;
  try {
    await noteCategoryApi.create({ name });
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
  showEditCategoryModal.value = true;
}

async function handleSaveEditCategory() {
  if (!editingCategory.value) return;
  const name = editCategoryName.value.trim();
  if (!name) return;
  try {
    await noteCategoryApi.update(editingCategory.value.id, { name });
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
    <!-- Header: 网站品牌与展开/收起按钮 (整行紧凑排列，展开/收起靠右显示，无多余顶栏，无底部分割线) -->
    <SidebarHeader class="p-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-2">
      <!-- 展开状态下：网站图标 + 标题在左，展开/收起按钮靠右 -->
      <div class="flex items-center justify-between w-full min-w-0 group-data-[collapsible=icon]:hidden">
        <div
          class="flex items-center gap-2.5 min-w-0 flex-1 pl-1 cursor-pointer select-none"
          title="返回主页"
          @click="emit('changeView', 'home')"
        >
          <div class="flex aspect-square size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-xs shadow-xs shrink-0">
            <component :is="activeModeIcon" class="size-3.5" />
          </div>
          <div class="grid flex-1 text-left leading-tight min-w-0">
            <span class="truncate font-semibold text-xs text-foreground tracking-tight">{{ siteStore.siteName || 'ZenLink' }}</span>
            <span class="truncate text-[10px] text-muted-foreground">{{ activeModeTitle }}</span>
          </div>
        </div>

        <SidebarTrigger
          class="size-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md cursor-pointer shrink-0 ml-1"
          title="收起侧边栏"
        />
      </div>

      <!-- 收起状态下 (图标模式)：居中只显示展开按钮 -->
      <div class="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full">
        <SidebarTrigger
          class="size-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md cursor-pointer"
          title="展开侧边栏"
        />
      </div>
    </SidebarHeader>

    <!-- Content: 动态内容分组 (按当前所处功能模式展示) -->
    <SidebarContent class="px-2 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 scrollbar-none">
      <!-- ================= 模式 1：网址导航侧边栏 ================= -->
      <template v-if="currentView === 'home' || currentView === 'admin'">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="cat in topCats" :key="cat.id">
                <SidebarMenuButton
                  :is-active="selectedCategoryId === cat.id"
                  :tooltip="cat.name"
                  class="cursor-pointer"
                  @click="handleSelectCategory(cat.id)"
                >
                  <component
                    :is="mapIcon(cat?.icon)"
                    class="size-4 shrink-0 transition-colors"
                    :class="selectedCategoryId === cat.id ? 'text-sidebar-accent-foreground' : 'text-muted-foreground group-hover/menu-item:text-foreground'"
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

      <!-- ================= 模式 2：在线笔记侧边栏 (只要显示分类，支持编辑删除) ================= -->
      <template v-else-if="currentView === 'notes'">
        <!-- 笔记分类列表 -->
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <!-- 全部分类项 (右侧常驻放置新建分类图标) -->
              <SidebarMenuItem>
                <SidebarMenuButton
                  :is-active="selectedNoteCategoryId === null"
                  tooltip="全部分类"
                  class="cursor-pointer pr-14"
                  @click="handleFilterNoteCategory(null)"
                >
                  <Folder
                    class="size-4 shrink-0 transition-colors"
                    :class="selectedNoteCategoryId === null ? 'text-sidebar-accent-foreground' : 'text-muted-foreground group-hover/menu-item:text-foreground'"
                  />
                  <span class="truncate">全部分类</span>
                  <SidebarMenuBadge class="right-7">{{ totalNoteCount }}</SidebarMenuBadge>
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

              <!-- 各笔记分类项 (固定默认显示图标与操作菜单) -->
              <SidebarMenuItem v-for="cat in noteCategories" :key="cat.id">
                <SidebarMenuButton
                  :is-active="selectedNoteCategoryId === cat.id"
                  :tooltip="cat.name"
                  class="cursor-pointer pr-14"
                  @click="handleFilterNoteCategory(cat.id)"
                >
                  <component
                    :is="mapIcon(cat?.icon || '')"
                    class="size-4 shrink-0 transition-colors"
                    :class="selectedNoteCategoryId === cat.id ? 'text-sidebar-accent-foreground' : 'text-muted-foreground group-hover/menu-item:text-foreground'"
                  />
                  <span class="truncate">{{ cat.name }}</span>
                  <SidebarMenuBadge v-if="cat.count !== undefined" class="right-7">{{ cat.count }}</SidebarMenuBadge>
                </SidebarMenuButton>

                <!-- 分类管理操作 (编辑、删除) -->
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <SidebarMenuAction
                      class="cursor-pointer text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                      title="分类操作"
                      @click.stop.prevent
                      @pointerdown.stop
                    >
                      <MoreHorizontal class="size-3.5" />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" :side="isMobile ? 'top' : 'right'" class="w-28 p-1 shadow-md">
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

      <!-- ================= 模式 3：AI 助手侧边栏 ================= -->
      <template v-else-if="currentView === 'ai'">
        <!-- 历史对话列表 (无多余标签) -->
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu v-if="aiConversations.length > 0">
              <SidebarMenuItem v-for="conv in aiConversations" :key="conv.id">
                <SidebarMenuButton
                  :is-active="activeAiConversationId === conv.id"
                  :tooltip="conv.title || '新会话'"
                  class="cursor-pointer group/chat-item"
                  @click="handleSelectAiChat(conv.id)"
                >
                  <MessageSquare
                    class="size-3.5 shrink-0 transition-colors"
                    :class="activeAiConversationId === conv.id ? 'text-sidebar-accent-foreground' : 'text-muted-foreground group-hover/menu-item:text-foreground'"
                  />
                  <span class="truncate text-xs">{{ conv.title || '新会话' }}</span>
                </SidebarMenuButton>

                <!-- 删除对话按钮 (常驻显示) -->
                <SidebarMenuAction
                  class="cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="删除该对话"
                  @click.stop.prevent="handleDeleteAiChat(conv.id)"
                  @pointerdown.stop
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

    <!-- Footer: NavUser (用户偏好与设置快捷卡片，无顶部分割线) -->
    <SidebarFooter class="p-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                size="lg"
                class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:mx-auto"
                tooltip="账户与系统设置"
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
        <div class="py-2">
          <Input
            v-model="newCategoryName"
            placeholder="输入分类名称..."
            autofocus
            @keydown.enter.prevent="handleCreateCategory"
          />
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
        <div class="py-2">
          <Input
            v-model="editCategoryName"
            placeholder="输入新的分类名称..."
            autofocus
            @keydown.enter.prevent="handleSaveEditCategory"
          />
        </div>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showEditCategoryModal = false">取消</Button>
          <Button :disabled="!editCategoryName.trim()" @click="handleSaveEditCategory">保存修改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Sidebar>
</template>
