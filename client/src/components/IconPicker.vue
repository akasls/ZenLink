<script setup lang="ts">
import { ref, computed } from 'vue';
import { mapIcon } from '@/utils/icon-map';

const modelValue = defineModel<string>({ default: 'pi pi-folder' });
const showPicker = ref(false);
const search = ref('');

// 可选图标列表（保持 pi pi-xxx 格式存储到数据库，显示时映射为 Element Plus 图标）
const icons = [
  'pi pi-folder', 'pi pi-folder-open', 'pi pi-bookmark', 'pi pi-book',
  'pi pi-code', 'pi pi-desktop', 'pi pi-mobile', 'pi pi-tablet',
  'pi pi-globe', 'pi pi-link', 'pi pi-external-link', 'pi pi-home',
  'pi pi-wrench', 'pi pi-cog', 'pi pi-bolt', 'pi pi-shield',
  'pi pi-lock', 'pi pi-unlock', 'pi pi-key', 'pi pi-user',
  'pi pi-users', 'pi pi-heart', 'pi pi-star', 'pi pi-star-fill',
  'pi pi-sun', 'pi pi-moon', 'pi pi-cloud', 'pi pi-cloud-upload',
  'pi pi-cloud-download', 'pi pi-database', 'pi pi-server', 'pi pi-wifi',
  'pi pi-chart-bar', 'pi pi-chart-line', 'pi pi-chart-pie', 'pi pi-table',
  'pi pi-list', 'pi pi-th-large', 'pi pi-palette', 'pi pi-image',
  'pi pi-images', 'pi pi-camera', 'pi pi-video', 'pi pi-play',
  'pi pi-microphone', 'pi pi-volume-up', 'pi pi-headphones', 'pi pi-music',
  'pi pi-file', 'pi pi-file-edit', 'pi pi-file-pdf', 'pi pi-file-excel',
  'pi pi-inbox', 'pi pi-send', 'pi pi-envelope', 'pi pi-comment',
  'pi pi-comments', 'pi pi-phone', 'pi pi-map', 'pi pi-map-marker',
  'pi pi-car', 'pi pi-shopping-cart', 'pi pi-shopping-bag', 'pi pi-wallet',
  'pi pi-money-bill', 'pi pi-credit-card', 'pi pi-gift', 'pi pi-tag',
  'pi pi-tags', 'pi pi-flag', 'pi pi-flag-fill', 'pi pi-megaphone',
  'pi pi-bell', 'pi pi-calendar', 'pi pi-clock', 'pi pi-stopwatch',
  'pi pi-graduation-cap', 'pi pi-building', 'pi pi-briefcase', 'pi pi-hammer',
  'pi pi-microchip', 'pi pi-box', 'pi pi-truck', 'pi pi-receipt',
  'pi pi-sparkles', 'pi pi-verified', 'pi pi-trophy', 'pi pi-thumbs-up',
  'pi pi-eye', 'pi pi-search', 'pi pi-filter', 'pi pi-sort',
  'pi pi-download', 'pi pi-upload', 'pi pi-share-alt', 'pi pi-sync',
  'pi pi-refresh', 'pi pi-undo', 'pi pi-history', 'pi pi-trash',
  'pi pi-pencil', 'pi pi-plus', 'pi pi-minus', 'pi pi-check',
  'pi pi-times', 'pi pi-info-circle', 'pi pi-question-circle', 'pi pi-exclamation-triangle',
];

const filteredIcons = computed(() => {
  if (!search.value) return icons;
  const q = search.value.toLowerCase();
  return icons.filter(i => i.includes(q));
});

function selectIcon(icon: string) {
  modelValue.value = icon;
  showPicker.value = false;
}

function getIconLabel(icon: string): string {
  return icon.replace('pi pi-', '');
}
</script>

<template>
  <div>
    <div class="flex items-center gap-2">
      <el-button @click="showPicker = true">
        <el-icon class="mr-2 text-gray-600"><component :is="mapIcon(modelValue)" /></el-icon>
        <span class="text-xs text-gray-500">选择图标</span>
        <el-icon class="ml-1"><component is="ArrowDown" /></el-icon>
      </el-button>
    </div>

    <el-dialog v-model="showPicker" title="选择图标" width="420px" destroy-on-close>
      <div class="mb-3">
        <el-input v-model="search" placeholder="搜索图标名称..." clearable size="small">
          <template #prefix>
            <el-icon><component is="Search" /></el-icon>
          </template>
        </el-input>
      </div>
      <div class="grid grid-cols-8 gap-1 max-h-[300px] overflow-y-auto">
        <el-tooltip
          v-for="icon in filteredIcons"
          :key="icon"
          :content="getIconLabel(icon)"
          placement="top"
          :show-after="400"
        >
          <button
            type="button"
            class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-indigo-50 transition-colors"
            :class="modelValue === icon ? 'bg-indigo-100 ring-2 ring-indigo-300' : 'bg-gray-50'"
            @click="selectIcon(icon)"
          >
            <el-icon class="text-base text-gray-700"><component :is="mapIcon(icon)" /></el-icon>
          </button>
        </el-tooltip>
      </div>
      <el-empty v-if="filteredIcons.length === 0" description="未找到匹配图标" />
    </el-dialog>
  </div>
</template>
