<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';
import { bookmarkApi, categoryApi } from '@/api';
import { toast } from '@/components/ui/sonner';
import {
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  Loader2,
  FolderOpen,
} from 'lucide-vue-next';

import TheSidebar from '@/components/TheSidebar.vue';
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
const currentYear = new Date().getFullYear();
const showLoginDialog = ref(false);
const pendingTargetView = ref<string>('');

const currentView = ref<'home' | 'admin' | 'notes' | 'ai'>(
  (route.meta.view as any) || 'home'
);

function onOpenLogin(targetView?: string) {
  pendingTargetView.value = targetView || 'admin';
  showLoginDialog.value = true;
}

async function onLoginSuccess(targetView?: string) {
  showLoginDialog.value = false;
  const target = targetView || pendingTargetView.value || 'admin';
  pendingTargetView.value = '';
  await loadCategories();
  await loadBookmarks();
  notesPanelRef.value?.loadCategories?.();
  notesPanelRef.value?.loadNotes?.();
  aiChatPanelRef.value?.loadConversations?.();
  onChangeAppView(target);
}

const viewScrollPositions: Record<string, number> = {
  home: 0,
  notes: 0,
  ai: 0,
  admin: 0,
};

function onChangeAppView(v: string) {
  if (v !== 'home' && !authStore.token && v !== 'admin') {
    onOpenLogin(v);
    return;
  }
  if (v === 'admin' && !authStore.token) {
    onOpenLogin('admin');
    return;
  }
  if (currentView.value && typeof window !== 'undefined') {
    viewScrollPositions[currentView.value] = window.scrollY;
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

// 监听视图切换，独立隔离与恢复各模块的滚动位置，互不影响
watch(currentView, (newView, oldView) => {
  if (oldView && typeof window !== 'undefined') {
    viewScrollPositions[oldView] = window.scrollY;
  }
  nextTick(() => {
    const targetY = viewScrollPositions[newView] ?? 0;
    window.scrollTo({ top: targetY, behavior: 'instant' });
    requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'instant' });
    });
  });
});

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
  projects: any[];
  selectedProjectId: string | null;
  isPrivateMode: boolean;
}>({
  conversations: [],
  activeConversationId: null,
  projects: [],
  selectedProjectId: null,
  isPrivateMode: false,
});

const selectedAdminTab = ref<'bookmarks' | 'categories' | 'note_categories' | 'ai' | 'security' | 'site'>('bookmarks');

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

function onScroll() {
  if (currentView.value && typeof window !== 'undefined') {
    viewScrollPositions[currentView.value] = window.scrollY;
  }
}

onMounted(() => {
  loadCategories();
  loadBookmarks();
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
  <SidebarProvider :style="{ '--sidebar-width': '260px', '--sidebar-width-icon': '52px' }">
    <TheSidebar
      :categories="categories"
      :selected-category-id="selectedCategoryId"
      :current-view="currentView"
      :is-logged-in="authStore.isLoggedIn"
      :bookmarks="bookmarks"
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
      @rename-ai-chat="(id, title, icon) => { const c = aiData.conversations.find((x: any) => x.id === id); if (c) { c.title = title; if (icon !== undefined) c.icon = icon; } }"
      @refresh-ai-chat="aiChatPanelRef?.loadConversations()"
      @select-admin-tab="(tab) => selectedAdminTab = (tab as any)"
      @add-bookmark="showAddDialog = true"
      @search-bookmark="(q) => searchQuery = q"
      @search-note="(q) => notesPanelRef?.setSearchQuery(q)"
    />

    <!-- Canonical Shadcn Vue Inset Main Content -->
    <SidebarInset :class="{ 'h-screen max-h-screen overflow-hidden': currentView === 'ai' || (currentView === 'notes' && notesData.selectedNoteId) }">
      <div
        class="flex-1 flex flex-col min-h-0 w-full min-w-0 max-w-full overflow-x-hidden"
        :class="{ 'h-screen max-h-screen overflow-hidden': currentView === 'ai' || (currentView === 'notes' && notesData.selectedNoteId) }"
      >
        <!-- 1. 网址导航功能主视图 -->
        <div v-show="currentView === 'home'" class="flex flex-col min-h-screen min-h-dvh w-full min-w-0 max-w-full overflow-x-hidden bg-background">
            <!-- Bookmarks & Categories Container -->
            <div
              class="flex-1 p-3 sm:p-5 md:p-6 max-w-[1600px] w-full min-w-0 max-w-full overflow-x-hidden mx-auto box-border"
              style="padding-top: max(1.5rem, calc(0.75rem + env(safe-area-inset-top, 0px)));"
            >
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
            <footer
              class="mt-auto py-8 px-4 text-center select-none"
              style="padding-bottom: max(2rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)));"
            >
              <p class="m-0 flex items-center justify-center gap-1.5 flex-wrap text-xs text-muted-foreground/75">
                <span>Copyright &copy; {{ currentYear }}</span>
                <span class="font-medium text-foreground/90">{{ siteStore.siteName || 'ZenLink' }}</span>
                <span v-if="siteStore.siteDesc" class="text-muted-foreground/40">-</span>
                <span v-if="siteStore.siteDesc" class="text-muted-foreground/70">{{ siteStore.siteDesc }}</span>
                <span class="text-muted-foreground/50">by</span>
                <a
                  href="https://github.com/akasls/ZenLink"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-muted-foreground/80 hover:text-foreground transition-colors group underline-offset-2 hover:underline font-medium"
                  title="访问 GitHub 开源项目仓库"
                >
                  <svg class="w-3.5 h-3.5 fill-current shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  <span>GitHub</span>
                </a>
              </p>
            </footer>
          </div>

          <!-- 2. 在线笔记、AI助手与系统设置面板 (无缝保活) -->
          <AdminPanel
            v-if="currentView === 'admin'"
            :categories="categories"
            :active-tab="selectedAdminTab"
            @update:active-tab="(tab) => selectedAdminTab = tab"
            @refresh="loadCategories(); loadBookmarks(); notesPanelRef?.loadCategories()"
          />
          <NotesPanel ref="notesPanelRef" v-show="currentView === 'notes'" :active="currentView === 'notes'" @state-change="onNotesStateChange" />
          <AIChatPanel ref="aiChatPanelRef" v-show="currentView === 'ai'" :active="currentView === 'ai'" @state-change="onAiStateChange" />
        </div>
      </SidebarInset>

      <!-- 弹窗列表 -->
      <AddBookmarkDialog v-model:visible="showAddDialog" :categories="categories" @saved="onSaved" />
      <EditBookmarkDialog v-model:visible="showEditDialog" :bookmark="editingBookmark" :categories="categories" @saved="onSaved" />
      <LoginDialog v-model:visible="showLoginDialog" :target-view="pendingTargetView" @success="onLoginSuccess" />
  </SidebarProvider>
</template>
