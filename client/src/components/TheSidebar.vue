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
  (props.categories || [])
    .filter(c => c && !c.parent_id)
    .sort((a: any, b: any) => (a?.sort_order || 0) - (b?.sort_order || 0))
);

function getSubCats(parentId: number) {
  return (props.categories || [])
    .filter(c => c && c.parent_id === parentId)
    .sort((a: any, b: any) => (a?.sort_order || 0) - (b?.sort_order || 0));
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
  <transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="mobileOpen"
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
      @click="emit('closeMobile')"
    ></div>
  </transition>

  <aside
    class="fixed top-0 left-0 bottom-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col z-50 transition-all duration-200 ease-in-out select-none"
    :class="[
      isExpanded ? 'w-52' : 'w-12 md:w-14',
      mobileOpen ? 'w-52 shadow-xl' : ''
    ]"
  >
    <!-- Header: 展开显示 Logo + 标题 + 收起键；折叠显示居中切换键 -->
    <div class="h-12 px-2.5 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 flex-shrink-0">
      <!-- 展开状态 -->
      <template v-if="isExpanded">
        <div class="flex items-center gap-2 cursor-pointer flex-1 min-w-0 pr-1 group" @click="handleLogoClick" title="返回导航页顶部">
          <div class="w-6 h-6 rounded-md bg-slate-900 dark:bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden text-white dark:text-slate-900 font-bold text-xs">
            <img v-if="siteStore.siteLogo" :src="siteStore.siteLogo" class="w-full h-full object-cover rounded-md" alt="logo" />
            <span v-else>{{ (siteStore.siteName || 'Z').trim().charAt(0) }}</span>
          </div>
          <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-950 dark:group-hover:text-white transition-colors">
            {{ siteStore.siteName || 'ZenLink' }}
          </span>
        </div>
        <button
          class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          @click="handleToggleCollapse"
          title="收起侧边栏"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <path d="M9 3v18"/>
            <path d="m16 15-3-3 3-3"/>
          </svg>
        </button>
      </template>

      <!-- 折叠状态 -->
      <template v-else>
        <button
          class="w-full h-8 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          @click="handleToggleCollapse"
          title="展开侧边栏"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <path d="M9 3v18"/>
            <path d="m14 9 3 3-3 3"/>
          </svg>
        </button>
      </template>
    </div>

    <!-- 网址分类导航列表 -->
    <nav class="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5">
      <template v-for="cat in topCats" :key="cat.id">
        <!-- 1. 折叠状态且存在二级分类：悬浮展示二级弹层 -->
        <el-popover
          v-if="collapsed && !isMobile && getSubCats(cat.id).length > 0"
          placement="right-start"
          trigger="hover"
          :show-after="80"
          :hide-after="180"
          :width="160"
          popper-class="!p-1.5 !bg-white dark:!bg-slate-900 !border-slate-200/80 dark:!border-slate-800 !rounded-lg !shadow-lg"
          :show-arrow="false"
        >
          <template #reference>
            <button
              class="w-full h-8 rounded-md flex items-center justify-center transition-colors group relative"
              :class="[
                selectedCategoryId === cat.id && currentView === 'home'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              ]"
              @click="handleSelectCategory(cat.id)"
            >
              <el-icon class="text-sm"><component :is="mapIcon(cat?.icon)" /></el-icon>
            </button>
          </template>

          <div class="flex flex-col gap-0.5">
            <div
              class="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              @click="handleSelectCategory(cat.id)"
              title="跳转至该分类"
            >
              <el-icon class="text-xs"><component :is="mapIcon(cat?.icon)" /></el-icon>
              <span>{{ cat.name }}</span>
            </div>
            <div class="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
            <div class="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
              <div
                v-for="sub in getSubCats(cat.id)"
                :key="sub.id"
                class="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                @click="handleSelectSubCategory(cat.id, sub.id)"
              >
                <el-icon class="text-[10px] text-slate-400"><component is="ArrowRight" /></el-icon>
                <span class="truncate">{{ sub.name }}</span>
              </div>
            </div>
          </div>
        </el-popover>

        <!-- 2. 普通状态或展开状态 -->
        <el-tooltip
          v-else
          :content="cat.name"
          placement="right"
          :show-after="300"
          :disabled="isExpanded"
        >
          <button
            class="w-full h-8 rounded-md flex items-center transition-colors group"
            :class="[
              isExpanded ? 'px-2.5 gap-2 justify-start' : 'justify-center',
              selectedCategoryId === cat.id && currentView === 'home'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
            ]"
            @click="handleSelectCategory(cat.id)"
          >
            <el-icon class="text-sm flex-shrink-0"><component :is="mapIcon(cat?.icon)" /></el-icon>
            <span v-if="isExpanded" class="text-xs truncate flex-1 text-left">{{ cat.name }}</span>
            <el-icon v-if="isExpanded" class="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <component is="ArrowRight" />
            </el-icon>
          </button>
        </el-tooltip>
      </template>
    </nav>

    <!-- 底部上方的扩展应用 (AI对话 / 在线笔记) -->
    <div v-if="siteStore.enableAi || siteStore.enableNotes" class="p-1.5 border-t border-slate-200/80 dark:border-slate-800 space-y-0.5 flex-shrink-0">
      <el-tooltip v-if="siteStore.enableAi" content="AI 助手" placement="right" :show-after="300" :disabled="isExpanded">
        <button
          class="w-full h-8 rounded-md flex items-center transition-colors group"
          :class="[
            isExpanded ? 'px-2.5 gap-2 justify-start' : 'justify-center',
            currentView === 'ai'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
          ]"
          @click="handleChangeView('ai')"
        >
          <el-icon class="text-sm flex-shrink-0"><component is="ChatDotRound" /></el-icon>
          <span v-if="isExpanded" class="text-xs truncate flex-1 text-left">AI 助手</span>
        </button>
      </el-tooltip>

      <el-tooltip v-if="siteStore.enableNotes" content="在线笔记" placement="right" :show-after="300" :disabled="isExpanded">
        <button
          class="w-full h-8 rounded-md flex items-center transition-colors group"
          :class="[
            isExpanded ? 'px-2.5 gap-2 justify-start' : 'justify-center',
            currentView === 'notes'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
          ]"
          @click="handleChangeView('notes')"
        >
          <el-icon class="text-sm flex-shrink-0"><component is="Document" /></el-icon>
          <span v-if="isExpanded" class="text-xs truncate flex-1 text-left">在线笔记</span>
        </button>
      </el-tooltip>
    </div>

    <!-- Footer: 系统设置与主题切换 -->
    <div class="p-1.5 border-t border-slate-200/80 dark:border-slate-800 flex-shrink-0">
      <div v-if="isExpanded" class="flex items-center gap-1">
        <button
          class="flex-1 h-8 rounded-md px-2.5 flex items-center gap-2 text-xs font-medium transition-colors"
          :class="[
            currentView === 'admin'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
          ]"
          @click="handleSettings"
          title="系统设置"
        >
          <el-icon class="text-sm flex-shrink-0"><component is="Setting" /></el-icon>
          <span class="truncate">系统设置</span>
        </button>

        <button
          class="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
          @click="themeStore.toggle($event)"
          :title="themeStore.isDark ? '切换至浅色模式' : '切换至暗黑模式'"
        >
          <el-icon class="text-sm"><component :is="themeStore.isDark ? 'Sunny' : 'Moon'" /></el-icon>
        </button>
      </div>

      <div v-else class="flex flex-col items-center gap-1">
        <el-tooltip content="系统设置" placement="right" :show-after="300">
          <button
            class="w-full h-8 rounded-md flex items-center justify-center transition-colors"
            :class="[
              currentView === 'admin'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
            ]"
            @click="handleSettings"
          >
            <el-icon class="text-sm"><component is="Setting" /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>
  </aside>
</template>
