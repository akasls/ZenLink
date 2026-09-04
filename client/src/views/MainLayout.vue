<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';
import { bookmarkApi, categoryApi } from '@/api';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Loader2, FolderOpen, ArrowUp, Plus } from 'lucide-vue-next';

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

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
const sidebarCollapsed = ref(false);
const mobileSidebarOpen = ref(false);

const showLoginDialog = ref(false);
const pendingTargetView = ref<string>('');

const currentView = ref<'home' | 'admin' | 'notes' | 'ai'>(
  (route.meta.view as any) || 'home'
);

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
  if (v !== 'home' && !authStore.token) {
    onOpenLogin(v);
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

// 监听登录状态变化（登出或登录后立即刷新视图与数据，无需手动刷新网页）
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

function toggleSidebar() {
  if (isMobile.value) {
    mobileSidebarOpen.value = !mobileSidebarOpen.value;
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }
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

function onResize() {
  const mobile = window.innerWidth < 768;
  isMobile.value = mobile;
  if (!mobile) {
    mobileSidebarOpen.value = false;
  }
}

onMounted(() => {
  loadCategories();
  loadBookmarks();
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('scroll', onScroll);
});
</script>

<template>
  <div class="min-h-screen w-full bg-background text-foreground flex relative selection:bg-primary/10">
    <!-- 左侧侧边栏 (包含顶部应用入口与分类导航) -->
    <TheSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileSidebarOpen"
      :categories="categories"
      :selected-category-id="selectedCategoryId"
      :current-view="currentView"
      :is-logged-in="authStore.isLoggedIn"
      @select-category="onSelectTopCategory"
      @select-sub-category="onSelectSubCategory"
      @change-view="onChangeAppView"
      @login="onOpenLogin"
      @close-mobile="mobileSidebarOpen = false"
      @toggle-collapse="toggleSidebar"
    />

    <!-- 主工作区 -->
    <main
      class="flex-1 min-w-0 min-h-screen flex flex-col transition-all duration-200 ease-in-out"
      :class="sidebarCollapsed ? 'ml-12 md:ml-14' : 'ml-12 md:ml-52'"
    >
      <div v-show="currentView === 'home'" class="flex flex-col min-h-screen">
        <SearchBar
          v-model="searchQuery"
          :sidebar-collapsed="sidebarCollapsed"
          @toggle-sidebar="toggleSidebar"
          @open-login="onOpenLogin()"
        />

        <div class="flex-1 p-4 sm:p-5 max-w-[1600px] w-full mx-auto box-border">
          <div v-if="!loading">
            <div v-if="searchQuery.trim()">
              <div class="flex items-center gap-2 mb-3">
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
              <div v-else class="py-16 flex flex-col items-center justify-center text-muted-foreground">
                <FolderOpen class="h-10 w-10 mb-2 stroke-[1.5] text-muted-foreground/50" />
                <p class="text-xs text-muted-foreground m-0">未找到匹配书签</p>
              </div>
            </div>

            <div v-else class="space-y-6">
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

          <div v-else class="text-center py-20 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 class="h-7 w-7 animate-spin mb-2 text-primary" />
            <span class="text-xs text-muted-foreground">正在加载数据...</span>
          </div>
        </div>

        <!-- 站点底部版权 -->
        <footer class="mt-auto border-t border-border py-6 px-4 text-center">
          <p class="text-xs text-muted-foreground leading-relaxed m-0">
            Copyright &copy; 2026 <strong class="font-medium text-foreground">{{ siteStore.siteName || 'ZenLink' }}</strong> · {{ siteStore.siteDesc || '干净简洁的导航！' }}
          </p>
        </footer>
      </div>

      <!-- 视图无缝保活切换 -->
      <AdminPanel v-if="currentView === 'admin'" :categories="categories" @refresh="loadCategories(); loadBookmarks()" />
      <NotesPanel v-show="currentView === 'notes'" :active="currentView === 'notes'" />
      <AIChatPanel v-show="currentView === 'ai'" :active="currentView === 'ai'" />
    </main>

    <!-- 浮动操作按钮 (小巧紧凑) -->
    <div v-if="currentView === 'home'" class="fixed bottom-5 right-5 flex flex-col items-center gap-2 z-40">
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
</template>
