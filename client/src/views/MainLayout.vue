<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';
import { bookmarkApi, categoryApi } from '@/api';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  Loader2,
  FolderOpen,
  ArrowUp,
  Plus,
  MessageSquareQuote,
} from 'lucide-vue-next';

import TheSidebar from '@/components/TheSidebar.vue';
import SearchBar from '@/components/SearchBar.vue';
import BookmarkGrid from '@/components/BookmarkGrid.vue';
import CategorySection from '@/components/CategorySection.vue';
import AddBookmarkDialog from '@/components/AddBookmarkDialog.vue';
import EditBookmarkDialog from '@/components/EditBookmarkDialog.vue';
import LoginDialog from '@/components/LoginDialog.vue';
import AdminPanel from '@/components/AdminPanel.vue';
import NotesPanel from '@/components/NotesPanel.vue';
import AIChatPanel from '@/components/AIChatPanel.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const siteStore = useSiteStore();

const showLoginDialog = ref(false);
const pendingTargetView = ref<string>('');

const currentView = ref<'home' | 'admin' | 'notes' | 'ai'>(
  (route.meta.view as any) || 'home'
);

const dailyQuote = ref('');

async function fetchQuote() {
  try {
    const res = await fetch('https://v1.hitokoto.cn/?c=d&c=i&c=k&encode=json');
    const data = await res.json();
    dailyQuote.value = data.hitokoto || '';
  } catch {
    dailyQuote.value = '';
  }
}

function onOpenLogin(targetView?: string) {
  pendingTargetView.value = targetView || '';
  showLoginDialog.value = true;
}

function onLoginSuccess(targetView?: string) {
  showLoginDialog.value = false;
  const target = targetView || pendingTargetView.value;
  pendingTargetView.value = '';
  if (target && target !== 'home') {
    onChangeAppView(target);
  }
}

function onChangeAppView(v: string) {
  if (v !== 'home' && !authStore.token && v !== 'admin') {
    onOpenLogin(v);
    return;
  }
  if (v === 'admin' && !authStore.token) {
    onOpenLogin('admin');
    return;
  }
  currentView.value = v as any;
  selectedCategoryId.value = null;
  const routes: Record<string, string> = {
    home: '/',
    admin: '/admin',
    notes: '/notes',
    ai: '/ai',
  };
  router.push(routes[v] || '/');
}

// 监听快捷键 ⌘1/Ctrl+1 (导航), ⌘2/Ctrl+2 (笔记), ⌘3/Ctrl+3 (AI), ⌘,/Ctrl+, (设置)
function handleGlobalShortcuts(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
    if (e.key === '1') {
      e.preventDefault();
      onChangeAppView('home');
    } else if (e.key === '2' && siteStore.enableNotes) {
      e.preventDefault();
      onChangeAppView('notes');
    } else if (e.key === '3' && siteStore.enableAi) {
      e.preventDefault();
      onChangeAppView('ai');
    } else if (e.key === ',') {
      e.preventDefault();
      onChangeAppView('admin');
    }
  }
}

// 监听路由同步视图状态 (若无登录 Token 则拦截并提示登录)
watch(
  () => route.meta.view,
  (newView) => {
    if (newView && newView !== 'home' && !authStore.token) {
      currentView.value = 'home';
      router.replace('/');
      onOpenLogin(newView as string);
    } else {
      currentView.value = (newView as any) || 'home';
    }
  },
  { immediate: true }
);

const bookmarks = ref<any[]>([]);
const categories = ref<any[]>([]);
const searchQuery = ref('');
const loading = ref(false);
const activeSubCategory = ref<Record<number, number | null>>({});
const selectedCategoryId = ref<number | null>(null);

const showAddDialog = ref(false);
const showEditDialog = ref(false);
const editingBookmark = ref<any>(null);

const notesPanelRef = ref<any>(null);
const aiChatPanelRef = ref<any>(null);

const notesData = ref<{
  notes: any[];
  tags: any[];
  categories: any[];
  selectedTag: string | null;
  selectedCategoryId: number | null;
  selectedNoteId: number | null;
}>({
  notes: [],
  tags: [],
  categories: [],
  selectedTag: null,
  selectedCategoryId: null,
  selectedNoteId: null,
});

const aiData = ref<{
  conversations: any[];
  activeConversationId: string | null;
}>({
  conversations: [],
  activeConversationId: null,
});

const selectedAdminTab = ref<'bookmarks' | 'categories' | 'ai' | 'security' | 'site'>('bookmarks');

function onNotesStateChange(state: any) {
  notesData.value = state;
}

function onAiStateChange(state: any) {
  aiData.value = state;
}

const topCategories = computed(() => categories.value.filter((c) => !c.parent_id));

function getSubCategories(parentId: number) {
  return categories.value.filter((c) => c.parent_id === parentId);
}

function getSectionBookmarks(topCatId: number) {
  const subs = getSubCategories(topCatId);
  const activeId = activeSubCategory.value[topCatId];
  if (activeId) return bookmarks.value.filter((b) => b.category_id === activeId);
  const allIds = [topCatId, ...subs.map((s) => s.id)];
  return bookmarks.value.filter((b) => allIds.includes(b.category_id));
}

async function loadCategories() {
  try {
    const { data } = await categoryApi.getAll();
    categories.value = data.categories;
    for (const top of data.categories.filter((c: any) => !c.parent_id)) {
      const subs = data.categories.filter((c: any) => c.parent_id === top.id);
      if (subs.length > 0) {
        if (!activeSubCategory.value[top.id]) {
          activeSubCategory.value[top.id] = subs[0].id;
        }
      } else {
        activeSubCategory.value[top.id] = null;
      }
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadBookmarks() {
  loading.value = true;
  try {
    const params: any = {};
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim();
    const { data } = await bookmarkApi.getAll(params);
    bookmarks.value = data.bookmarks;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

// 监听登录状态变化
watch(
  () => authStore.isLoggedIn,
  (isLogged) => {
    if (!isLogged && currentView.value !== 'home') {
      currentView.value = 'home';
      router.push('/');
    }
    loadCategories();
    loadBookmarks();
    siteStore.fetchSettings();
  }
);

function onSelectTopCategory(id: number) {
  selectedCategoryId.value = id;
  currentView.value = 'home';
  if (route.path !== '/') router.push('/');
  nextTick(() => {
    const firstCat = topCategories.value[0];
    if (firstCat && firstCat.id === id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function onSelectSubCategory(topId: number, subId: number) {
  selectedCategoryId.value = topId;
  activeSubCategory.value[topId] = subId;
  currentView.value = 'home';
  if (route.path !== '/') router.push('/');
  nextTick(() => {
    const firstCat = topCategories.value[0];
    if (firstCat && firstCat.id === topId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.getElementById(`sec-${topId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function onSelectSub(topId: number, subId: number) {
  activeSubCategory.value[topId] = subId;
}

let timer: ReturnType<typeof setTimeout>;
watch(searchQuery, () => {
  clearTimeout(timer);
  timer = setTimeout(loadBookmarks, 300);
});

function onCopy(bm: any) {
  navigator.clipboard.writeText(bm.url);
  toast.success('已复制');
}
function onEdit(bm: any) {
  editingBookmark.value = { ...bm };
  showEditDialog.value = true;
}
async function onDelete(bm: any) {
  try {
    await bookmarkApi.delete(bm.id);
    toast.success('已删除');
    loadBookmarks();
  } catch {
    toast.error('删除失败');
  }
}
function onSaved() {
  showAddDialog.value = false;
  showEditDialog.value = false;
  loadBookmarks();
  toast.success('已保存');
}

async function onReorder(items: any[]) {
  try {
    await bookmarkApi.reorder(items.map((b) => b.id));
    for (let i = 0; i < items.length; i++) {
      items[i].sort_order = i + 1;
    }
  } catch (e) {
    console.error(e);
  }
}

const showBackToTop = ref(false);

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onScroll() {
  showBackToTop.value = window.scrollY > window.innerHeight * 0.8;
}

onMounted(() => {
  loadCategories();
  loadBookmarks();
  fetchQuote();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('keydown', handleGlobalShortcuts);
  onScroll();
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('keydown', handleGlobalShortcuts);
});
</script>

<template>
  <SidebarProvider>
    <div class="flex min-h-svh w-full min-w-0 max-w-full overflow-x-hidden bg-background text-foreground selection:bg-primary/10">
      <!-- Canonical Shadcn Vue Sidebar (动态自适应三大模式 + 展开收起 + NavUser) -->
      <TheSidebar
        :categories="categories"
        :selected-category-id="selectedCategoryId"
        :current-view="currentView"
        :is-logged-in="authStore.isLoggedIn"
        :notes="notesData.notes"
        :note-tags="notesData.tags"
        :note-categories="notesData.categories"
        :selected-note-tag="notesData.selectedTag"
        :selected-note-category-id="notesData.selectedCategoryId"
        :selected-note-id="notesData.selectedNoteId"
        :ai-conversations="aiData.conversations"
        :active-ai-conversation-id="aiData.activeConversationId"
        :selected-admin-tab="selectedAdminTab"
        @select-category="onSelectTopCategory"
        @select-sub-category="onSelectSubCategory"
        @change-view="onChangeAppView"
        @login="onOpenLogin"
        @create-note="notesPanelRef?.createNote()"
        @select-note="(n) => notesPanelRef?.selectNote(n)"
        @filter-note-tag="(t) => notesPanelRef?.filterByTag(t)"
        @filter-note-category="(catId) => notesPanelRef?.filterByCategory(catId)"
        @create-note-category="notesPanelRef?.loadCategories(); notesPanelRef?.loadNotes()"
        @new-ai-chat="aiChatPanelRef?.createNewConversation()"
        @select-ai-chat="(id) => aiChatPanelRef?.selectConversation(id)"
        @delete-ai-chat="(id) => aiChatPanelRef?.deleteConversation(id)"
        @rename-ai-chat="(id, title) => { const c = aiData.conversations.find((x: any) => x.id === id); if (c) c.title = title; }"
        @select-admin-tab="(tab) => selectedAdminTab = (tab as any)"
        @add-bookmark="showAddDialog = true"
      />

      <!-- Canonical Shadcn Vue Inset Main Content (无顶栏，极致沉浸画布) -->
      <SidebarInset>
        <div class="flex-1 flex flex-col min-h-0 w-full min-w-0 max-w-full overflow-x-hidden">
          <!-- 1. 网址导航功能主视图 -->
          <div v-show="currentView === 'home'" class="flex flex-col min-h-screen w-full min-w-0 max-w-full overflow-x-hidden">
            <!-- 搜索框组件 -->
            <SearchBar v-model="searchQuery" />

            <!-- 每日一言灵感条 (优雅融入搜索栏下方) -->
            <div v-if="dailyQuote" class="py-2 px-4 text-center border-b border-border/40 bg-muted/20">
              <div class="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80 max-w-lg mx-auto">
                <MessageSquareQuote class="h-3.5 w-3.5 shrink-0 text-primary/60" />
                <span class="truncate font-serif italic text-[11px]">{{ dailyQuote }}</span>
              </div>
            </div>

            <!-- Bookmarks & Categories Container -->
            <div class="flex-1 p-3 sm:p-5 md:p-6 max-w-[1600px] w-full min-w-0 max-w-full overflow-x-hidden mx-auto box-border">
              <div v-if="!loading">
                <!-- 搜索状态结果 -->
                <div v-if="searchQuery.trim()">
                  <div class="flex items-center gap-2 mb-4">
                    <span class="text-xs font-semibold text-foreground/80">搜索结果</span>
                    <span class="text-[11px] font-mono text-muted-foreground">({{ bookmarks.length }})</span>
                  </div>
                  <BookmarkGrid
                    v-if="bookmarks.length"
                    :bookmarks="bookmarks"
                    :is-logged-in="authStore.isLoggedIn"
                    @copy="onCopy"
                    @edit="onEdit"
                    @delete="onDelete"
                    @reorder="onReorder"
                  />
                  <div v-else class="py-20 flex flex-col items-center justify-center text-muted-foreground">
                    <FolderOpen class="h-10 w-10 mb-2 stroke-[1.5] text-muted-foreground/50" />
                    <p class="text-xs text-muted-foreground m-0">未找到匹配书签</p>
                  </div>
                </div>

                <!-- 分类区块列表 -->
                <div v-else class="space-y-8">
                  <CategorySection
                    v-for="cat in topCategories"
                    :key="cat.id"
                    :category="cat"
                    :sub-categories="getSubCategories(cat.id)"
                    :active-sub-id="activeSubCategory[cat.id]"
                    :bookmarks="getSectionBookmarks(cat.id)"
                    :is-logged-in="authStore.isLoggedIn"
                    @select-sub="onSelectSub"
                    @copy="onCopy"
                    @edit="onEdit"
                    @delete="onDelete"
                    @reorder="onReorder"
                  />
                </div>
              </div>

              <div v-else class="text-center py-24 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 class="h-7 w-7 animate-spin mb-2 text-primary" />
                <span class="text-xs text-muted-foreground">正在加载数据...</span>
              </div>
            </div>

            <!-- Footer -->
            <footer class="mt-auto border-t border-border py-6 px-4 text-center">
              <p class="text-xs text-muted-foreground leading-relaxed m-0">
                Copyright &copy; 2026 <strong class="font-medium text-foreground">{{ siteStore.siteName || 'ZenLink' }}</strong> · {{ siteStore.siteDesc || '干净简洁的导航！' }}
              </p>
            </footer>
          </div>

          <!-- 2. 在线笔记、AI助手与系统设置面板 (无缝保活) -->
          <AdminPanel
            v-if="currentView === 'admin'"
            :categories="categories"
            :active-tab="selectedAdminTab"
            @update:active-tab="(tab) => selectedAdminTab = tab"
            @refresh="loadCategories(); loadBookmarks()"
          />
          <NotesPanel ref="notesPanelRef" v-show="currentView === 'notes'" :active="currentView === 'notes'" @state-change="onNotesStateChange" />
          <AIChatPanel ref="aiChatPanelRef" v-show="currentView === 'ai'" :active="currentView === 'ai'" @state-change="onAiStateChange" />
        </div>
      </SidebarInset>

      <!-- 浮动操作按钮 (小巧紧凑) -->
      <div v-if="currentView === 'home'" class="fixed bottom-6 right-6 flex flex-col items-center gap-2 z-40">
        <!-- 回到顶部 -->
        <transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 translate-y-2 scale-90"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 translate-y-2 scale-90"
        >
          <Button
            v-if="showBackToTop"
            variant="outline"
            size="icon"
            class="shadow-sm cursor-pointer"
            @click="scrollTop"
            title="返回顶部"
          >
            <ArrowUp class="h-4 w-4" />
          </Button>
        </transition>

        <!-- 添加书签 -->
        <Button
          v-if="authStore.isLoggedIn"
          size="icon"
          class="shadow-sm cursor-pointer"
          @click="showAddDialog = true"
          title="添加书签"
        >
          <Plus class="h-4 w-4" />
        </Button>
      </div>

      <!-- 弹窗列表 -->
      <AddBookmarkDialog v-model:visible="showAddDialog" :categories="categories" @saved="onSaved" />
      <EditBookmarkDialog v-model:visible="showEditDialog" :bookmark="editingBookmark" :categories="categories" @saved="onSaved" />
      <LoginDialog v-model:visible="showLoginDialog" :target-view="pendingTargetView" @success="onLoginSuccess" />
    </div>
  </SidebarProvider>
</template>
