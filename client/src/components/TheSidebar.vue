<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { mapIcon } from '@/utils/icon-map';
import { useSiteStore } from '@/stores/site';
import { useThemeStore } from '@/stores/theme';

const siteStore = useSiteStore();
const themeStore = useThemeStore();

interface Category {
  id: number;
  name: string;
  icon: string;
  is_private: number;
  parent_id: number | null;
}

const props = defineProps<{
  collapsed: boolean;
  mobileOpen: boolean;
  categories: Category[];
  selectedCategoryId: number | null;
  currentView: 'home' | 'admin' | 'notes' | 'ai';
  isLoggedIn: boolean;
}>();

const emit = defineEmits<{
  selectCategory: [id: number];
  selectSubCategory: [topId: number, subId: number];
  changeView: [view: 'home' | 'admin' | 'notes' | 'ai'];
  login: [targetView?: string];
  closeMobile: [];
  toggleCollapse: [];
}>();

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
function onResize() {
  isMobile.value = window.innerWidth < 768;
}
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const isExpanded = computed(() => {
  if (isMobile.value) {
    return props.mobileOpen;
  }
  return !props.collapsed;
});

const topCats = computed(() =>
  props.categories
    .filter(c => !c.parent_id)
    .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
);

function getSubCats(parentId: number) {
  return props.categories
    .filter(c => c.parent_id === parentId)
    .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
}

function handleSelectCategory(id: number) {
  emit('selectCategory', id);
  emit('changeView', 'home');
  emit('closeMobile');
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
  emit('closeMobile');
  nextTick(() => {
    const el = document.getElementById(`sec-${topId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function handleLogoClick() {
  emit('changeView', 'home');
  emit('closeMobile');
  nextTick(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function handleChangeView(view: 'home' | 'admin' | 'notes' | 'ai') {
  if (view !== 'home' && !props.isLoggedIn) {
    emit('login', view);
    emit('closeMobile');
    return;
  }
  emit('changeView', view);
  emit('closeMobile');
}

function handleSettings() {
  if (props.isLoggedIn) {
    emit('changeView', 'admin');
  } else {
    emit('login', 'admin');
  }
  emit('closeMobile');
}

function handleToggleCollapse() {
  if (props.mobileOpen) {
    emit('closeMobile');
  } else {
    emit('toggleCollapse');
  }
}
</script>

<template>
  <!-- 移动端遮罩层 -->
  <div
    class="sidebar-backdrop"
    :class="{ active: mobileOpen }"
    @click="emit('closeMobile')"
  ></div>

  <aside
    class="sidebar"
    :class="{ collapsed, 'mobile-open': mobileOpen }"
  >
    <!-- Header: 展开时显示 Logo + 标题 + 右上角收起键；折叠时直接显示展开按键 -->
    <div class="sidebar-header">
      <!-- 展开状态 -->
      <template v-if="isExpanded">
        <div class="sidebar-header-left" @click="handleLogoClick" title="返回导航页顶部">
          <div class="sidebar-logo">
            <img v-if="siteStore.siteLogo" :src="siteStore.siteLogo" class="sidebar-logo-img" alt="logo" />
            <img v-else src="/favicon.svg" class="sidebar-logo-img" alt="logo" />
          </div>
          <span class="sidebar-brand">{{ siteStore.siteName || 'ZenLink' }}</span>
        </div>
        <button
          class="sidebar-header-toggle"
          @click="handleToggleCollapse"
          title="收起侧边栏"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <path d="M9 3v18"/>
            <path d="m16 15-3-3 3-3"/>
          </svg>
        </button>
      </template>

      <!-- 折叠状态（桌面端与移动端收起时一律显示展开按键） -->
      <template v-else>
        <button
          class="sidebar-header-toggle toggle-expand-btn"
          @click="handleToggleCollapse"
          title="展开侧边栏"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <path d="M9 3v18"/>
            <path d="m14 9 3 3-3 3"/>
          </svg>
        </button>
      </template>
    </div>

    <!-- 网址导航下的分类树 (置顶展示) -->
    <nav class="sidebar-nav">
      <template v-for="cat in topCats" :key="cat.id">
        <!-- 1. 折叠状态且存在二级分类：鼠标悬浮展开二级分类浮层 (支持精准点击跳转) -->
        <el-popover
          v-if="collapsed && !isMobile && getSubCats(cat.id).length > 0"
          placement="right-start"
          trigger="hover"
          :show-after="80"
          :hide-after="180"
          :width="170"
          popper-class="sidebar-flyout-popover"
          :show-arrow="false"
        >
          <template #reference>
            <button
              class="sidebar-item"
              :class="{ active: selectedCategoryId === cat.id && currentView === 'home' }"
              @click="handleSelectCategory(cat.id)"
            >
              <el-icon class="sidebar-icon">
                <component :is="mapIcon(cat.icon)" />
              </el-icon>
            </button>
          </template>

          <div class="flyout-menu-container">
            <div class="flyout-menu-header" @click="handleSelectCategory(cat.id)" title="跳转至该分类">
              <el-icon class="mr-1.5"><component :is="mapIcon(cat.icon)" /></el-icon>
              <span>{{ cat.name }}</span>
            </div>
            <div class="flyout-menu-divider"></div>
            <div class="flyout-sub-list">
              <div
                v-for="sub in getSubCats(cat.id)"
                :key="sub.id"
                class="flyout-sub-item"
                @click="handleSelectSubCategory(cat.id, sub.id)"
              >
                <el-icon class="mr-1.5 text-xs"><component is="ArrowRight" /></el-icon>
                <span class="sub-name">{{ sub.name }}</span>
              </div>
            </div>
          </div>
        </el-popover>

        <!-- 2. 无二级分类或展开状态 -->
        <el-tooltip
          v-else
          :content="cat.name"
          placement="right"
          :show-after="300"
          :disabled="!collapsed"
        >
          <button
            class="sidebar-item"
            :class="{ active: selectedCategoryId === cat.id && currentView === 'home' }"
            @click="handleSelectCategory(cat.id)"
          >
            <el-icon class="sidebar-icon">
              <component :is="mapIcon(cat.icon)" />
            </el-icon>
            <span v-if="!collapsed" class="sidebar-label">{{ cat.name }}</span>
            <el-icon v-if="!collapsed" class="sidebar-arrow">
              <component is="ArrowRight" />
            </el-icon>
          </button>
        </el-tooltip>
      </template>
    </nav>

    <!-- 底部上方的 3 大扩展应用 (AI对话 / 在线笔记 / 传输助手) -->
    <div class="sidebar-app-bottom-dock">
      <el-tooltip content="AI 助手" placement="right" :show-after="300" :disabled="!collapsed">
        <button
          class="sidebar-item app-dock-item ai-dock-btn"
          :class="{ active: currentView === 'ai' }"
          @click="handleChangeView('ai')"
        >
          <el-icon class="sidebar-icon"><component is="ChatDotRound" /></el-icon>
          <span v-if="!collapsed" class="sidebar-label">AI 助手</span>
        </button>
      </el-tooltip>

      <el-tooltip content="在线笔记" placement="right" :show-after="300" :disabled="!collapsed">
        <button
          class="sidebar-item app-dock-item"
          :class="{ active: currentView === 'notes' }"
          @click="handleChangeView('notes')"
        >
          <el-icon class="sidebar-icon"><component is="Document" /></el-icon>
          <span v-if="!collapsed" class="sidebar-label">在线笔记</span>
        </button>
      </el-tooltip>
    </div>

    <!-- Footer: 系统设置与主题切换 (移动端收起时不显示切换主题) -->
    <div class="sidebar-footer">
      <!-- 展开状态（桌面展开 或 移动端抽屉打开）：系统设置 + 右侧切换主题图标并排 -->
      <div v-if="isExpanded" class="sidebar-footer-controls">
        <button
          class="sidebar-item footer-ctrl-item settings-btn"
          :class="{ active: currentView === 'admin' }"
          @click="handleSettings"
          title="系统设置"
        >
          <el-icon class="sidebar-icon"><component is="Setting" /></el-icon>
          <span class="sidebar-label">系统设置</span>
        </button>

        <button
          class="sidebar-item footer-ctrl-item theme-toggle-btn icon-only"
          @click="themeStore.toggle($event)"
          :title="themeStore.isDark ? '切换至明亮模式' : '切换至暗黑模式'"
        >
          <el-icon class="sidebar-icon"><component :is="themeStore.isDark ? 'Sunny' : 'Moon'" /></el-icon>
        </button>
      </div>

      <!-- 折叠状态：仅展示系统设置单图标，完全隐藏切换主题 -->
      <div v-else class="sidebar-footer-collapsed">
        <el-tooltip content="系统设置" placement="right" :show-after="300" :disabled="isExpanded">
          <button
            class="sidebar-item footer-ctrl-item settings-btn"
            :class="{ active: currentView === 'admin' }"
            @click="handleSettings"
          >
            <el-icon class="sidebar-icon"><component is="Setting" /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>
  </aside>
</template>
