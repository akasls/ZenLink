<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';
import { bookmarkApi, categoryApi } from '@/api';
import { ElMessage } from 'element-plus';

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
  if (v !== 'home' && !authStore.isLoggedIn) {
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

// 监听路由同步视图状态 (如果未登录则拦截并以弹窗方式登录)
watch(
  () => route.meta.view,
  (newView) => {
    if (newView && newView !== 'home' && !authStore.isLoggedIn) {
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

const topCategories = computed(() => categories.value.filter(c => !c.parent_id));

function getSubCategories(parentId: number) {
  return categories.value.filter(c => c.parent_id === parentId);
}

function getSectionBookmarks(topCatId: number) {
  const subs = getSubCategories(topCatId);
  const activeId = activeSubCategory.value[topCatId];
  if (activeId) return bookmarks.value.filter(b => b.category_id === activeId);
  const allIds = [topCatId, ...subs.map(s => s.id)];
  return bookmarks.value.filter(b => allIds.includes(b.category_id));
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
  } catch (e) { console.error(e); }
}

async function loadBookmarks() {
  loading.value = true;
  try {
    const params: any = {};
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim();
    const { data } = await bookmarkApi.getAll(params);
    bookmarks.value = data.bookmarks;
  } catch (e) { console.error(e); }
  finally { loading.value = false; }
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
watch(searchQuery, () => { clearTimeout(timer); timer = setTimeout(loadBookmarks, 300); });

function onCopy(bm: any) { navigator.clipboard.writeText(bm.url); ElMessage.success('已复制'); }
function onEdit(bm: any) { editingBookmark.value = { ...bm }; showEditDialog.value = true; }
async function onDelete(bm: any) { try { await bookmarkApi.delete(bm.id); ElMessage.success('已删除'); loadBookmarks(); } catch { ElMessage.error('删除失败'); } }
function onSaved() {
  showAddDialog.value = false;
  showEditDialog.value = false;
  loadBookmarks();
  ElMessage.success('已保存');
}

async function onReorder(items: any[]) {
  try {
    await bookmarkApi.reorder(items.map(b => b.id));
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
  <div class="app-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
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

    <main class="main-content">
      <div v-show="currentView === 'home'">
        <SearchBar
          v-model="searchQuery"
          :sidebar-collapsed="sidebarCollapsed"
          @toggle-sidebar="toggleSidebar"
          @open-login="onOpenLogin()"
        />

        <div class="content-area">
          <div v-if="!loading">
            <div v-if="searchQuery.trim()">
              <p class="text-xs mb-3 font-medium" style="color: var(--zl-text-muted);">
                搜索结果 ({{ bookmarks.length }})
              </p>
              <BookmarkGrid
                v-if="bookmarks.length"
                :bookmarks="bookmarks"
                :is-logged-in="authStore.isLoggedIn"
                @copy="onCopy"
                @edit="onEdit"
                @delete="onDelete"
                @reorder="onReorder"
              />
              <el-empty v-else description="未找到匹配书签" />
            </div>

            <template v-else>
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
            </template>
          </div>
          <div v-else class="text-center py-16">
            <el-icon class="is-loading text-xl" style="color: var(--zl-text-muted);"><component is="Loading" /></el-icon>
          </div>
        </div>

        <!-- 站点底部版权 -->
        <footer class="site-footer">
          <div class="footer-inner">
            <p>Copyright &copy; 2026 <strong>{{ siteStore.siteName || 'ZenLink' }}</strong> · {{ siteStore.siteDesc || '干净简洁的导航！' }}</p>
          </div>
        </footer>
      </div>

      <!-- 视图无缝保活切换 (KeepAlive / v-show) -->
      <AdminPanel v-if="currentView === 'admin'" :categories="categories" @refresh="loadCategories(); loadBookmarks()" />
      
      <NotesPanel v-show="currentView === 'notes'" :active="currentView === 'notes'" />
      <AIChatPanel v-show="currentView === 'ai'" :active="currentView === 'ai'" />
    </main>

    <!-- 桌面/移动端浮动操作球 -->
    <div v-if="currentView === 'home'" class="fab-group">
      <!-- 回到顶部 (页面下滑超过一页才显示，带平滑渐入渐出动效) -->
      <transition name="fab-fade">
        <button v-if="showBackToTop" class="fab-btn" @click="scrollTop" title="返回顶部">
          <svg viewBox="0 0 24 24" class="fab-svg-icon" fill="currentColor">
            <path d="M12 3.5L4.5 19.8l7.5-3.6 7.5 3.6L12 3.5z"/>
          </svg>
        </button>
      </transition>

      <!-- 添加书签 (高对比清晰矢量加号，日夜模式自动适配) -->
      <button v-if="authStore.isLoggedIn" class="fab-btn" @click="showAddDialog = true" title="添加书签">
        <svg viewBox="0 0 24 24" class="fab-svg-icon" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      </div>

    <!-- 弹窗列表 (添加/编辑书签 + 全站统一登录弹窗) -->
    <AddBookmarkDialog v-model:visible="showAddDialog" :categories="categories" @saved="onSaved" />
    <EditBookmarkDialog v-model:visible="showEditDialog" :bookmark="editingBookmark" :categories="categories" @saved="onSaved" />
    <LoginDialog v-model:visible="showLoginDialog" :target-view="pendingTargetView" @success="onLoginSuccess" />
  </div>
</template>

