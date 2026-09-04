<script setup lang="ts">
import { ref, computed } from 'vue';
import { mapIcon } from '@/utils/icon-map';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, ChevronDown } from 'lucide-vue-next';

const modelValue = defineModel<string>({ default: 'pi pi-folder' });
const showPicker = ref(false);
const search = ref('');

// 可选图标列表（保持 pi pi-xxx 格式存储到数据库，显示时映射为 Lucide 图标）
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
  return icons.filter((i) => i.includes(q));
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
      <Button
        variant="outline"
        size="sm"
        class="h-8 px-2.5 text-xs font-medium gap-1.5"
        @click="showPicker = true"
      >
        <component :is="mapIcon(modelValue)" class="h-3.5 w-3.5 text-muted-foreground" />
        <span class="text-xs">{{ getIconLabel(modelValue) || '选择图标' }}</span>
        <ChevronDown class="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>

    <Dialog :open="showPicker" @update:open="showPicker = $event">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>选择分类图标</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 pt-1">
          <div class="relative">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="search"
              placeholder="搜索图标名称..."
              class="pl-9 text-xs"
              autofocus
            />
          </div>

          <div class="grid grid-cols-7 gap-1.5 max-h-[260px] overflow-y-auto p-1 rounded-md border border-border/60 bg-muted/20">
            <Tooltip
              v-for="icon in filteredIcons"
              :key="icon"
              :delay-duration="200"
            >
              <TooltipTrigger as-child>
                <Button
                  :variant="modelValue === icon ? 'default' : 'outline'"
                  size="icon-sm"
                  class="w-9 h-9"
                  @click="selectIcon(icon)"
                >
                  <component :is="mapIcon(icon)" class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" class="text-xs">
                {{ getIconLabel(icon) }}
              </TooltipContent>
            </Tooltip>
          </div>

          <div
            v-if="filteredIcons.length === 0"
            class="text-xs text-center py-6 text-muted-foreground"
          >
            未找到匹配图标
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
