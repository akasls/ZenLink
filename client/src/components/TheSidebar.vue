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
  SidebarGroupAction,
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
import { Button } from '@/components/ui/button';
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
  Tag,
  Folder,
  FolderOpen,
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

function handleFilterNoteCategory(categoryId: number | null) {
  emit('filterNoteCategory', categoryId);
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
    <!-- Header: 网站品牌与展开/收起按钮 (整行紧凑排列，展开/收起靠右显示，无多余顶栏) -->
    <SidebarHeader class="border-b border-sidebar-border/60 p-2">
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
          class="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md cursor-pointer shrink-0 ml-1"
          title="收起侧边栏"
        />
      </div>

      <!-- 收起状态下 (图标模式)：居中只显示展开按钮 -->
      <div class="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full py-0.5">
        <SidebarTrigger
          class="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md cursor-pointer"
          title="展开侧边栏"
        />
      </div>
    </SidebarHeader>

    <!-- Content: 动态内容分组 (按当前所处功能模式展示) -->
    <SidebarContent class="px-2 py-2">
      <!-- ================= 模式 1：网址导航侧边栏 ================= -->
      <template v-if="currentView === 'home' || currentView === 'admin'">
        <SidebarGroup>
          <SidebarGroupLabel class="flex items-center justify-between">
            <span>书签分类</span>
          </SidebarGroupLabel>
          <SidebarGroupAction
            v-if="isLoggedIn"
            title="添加新书签"
            class="cursor-pointer"
            @click="emit('addBookmark')"
          >
            <Plus class="size-3.5" />
          </SidebarGroupAction>
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
            variant="outline"
            class="w-full h-8 text-xs font-medium gap-1.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 cursor-pointer shadow-xs border-sidebar-border"
            @click="handleCreateNote"
            title="新建空白笔记"
          >
            <Plus class="size-3.5 shrink-0" />
            <span class="group-data-[collapsible=icon]:hidden">新建笔记</span>
          </Button>
        </div>

        <!-- 笔记分类 (Categories) -->
        <SidebarGroup v-if="noteCategories && noteCategories.length > 0">
          <SidebarGroupLabel class="flex items-center justify-between">
            <span>笔记分类</span>
          </SidebarGroupLabel>
          <SidebarGroupAction
            title="新建分类"
            class="cursor-pointer"
            @click="emit('createNoteCategory')"
          >
            <Plus class="size-3.5" />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  :is-active="selectedNoteCategoryId === null"
                  tooltip="全部分类"
                  class="cursor-pointer"
                  @click="handleFilterNoteCategory(null)"
                >
                  <Folder class="size-4 shrink-0 text-muted-foreground" />
                  <span class="truncate">全部分类</span>
                  <SidebarMenuBadge>{{ totalNoteCount }}</SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem v-for="cat in noteCategories" :key="cat.id">
                <SidebarMenuButton
                  :is-active="selectedNoteCategoryId === cat.id"
                  :tooltip="cat.name"
                  class="cursor-pointer"
                  @click="handleFilterNoteCategory(cat.id)"
                >
                  <FolderOpen class="size-4 shrink-0 text-muted-foreground" />
                  <span class="truncate">{{ cat.name }}</span>
                  <SidebarMenuBadge v-if="cat.count !== undefined">{{ cat.count }}</SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <!-- 笔记标签 -->
        <SidebarGroup v-if="noteTags && noteTags.length > 0">
          <SidebarGroupLabel>标签</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  :is-active="selectedNoteTag === null"
                  tooltip="全部标签"
                  class="cursor-pointer"
                  @click="handleFilterNoteTag(null)"
                >
                  <Tag class="size-4 shrink-0 text-muted-foreground" />
                  <span class="truncate">全部标签</span>
                  <SidebarMenuBadge>{{ totalNoteCount }}</SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem v-for="tag in noteTags" :key="tag.name">
                <SidebarMenuButton
                  :is-active="selectedNoteTag === tag.name"
                  :tooltip="'#' + tag.name"
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

    <!-- Footer: NavUser (用户偏好与设置快捷卡片) -->
    <SidebarFooter class="border-t border-sidebar-border/60 pt-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                size="lg"
                class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
                tooltip="账户与系统设置"
              >
                <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted border text-foreground font-bold text-sm shadow-xs overflow-hidden shrink-0">
                  <User class="size-4 text-muted-foreground" />
                </div>
                <div class="grid flex-1 text-left text-xs leading-tight min-w-0">
                  <span class="truncate font-semibold text-foreground tracking-tight">{{ userDisplayName }}</span>
                  <span class="truncate text-[11px] text-muted-foreground">{{ userRoleDesc }}</span>
                </div>
                <ChevronsUpDown class="ml-auto size-4 shrink-0 text-muted-foreground" />
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
  </Sidebar>
</template>
