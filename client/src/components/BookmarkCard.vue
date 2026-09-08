<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { ChevronRight, Lock } from 'lucide-vue-next';
import { getAvatarChar, getAvatarColor } from '@/utils/avatar';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

export interface Bookmark {
  id: number;
  title: string;
  description: string;
  url: string;
  backup_url: string | null;
  favicon: string;
  is_private: number;
  status: string;
  category_id: number | null;
  sort_order: number;
}

const props = defineProps<{
  bookmark: Bookmark;
}>();

const emit = defineEmits<{
  click: [bm: Bookmark];
  openCurrent: [bm: Bookmark];
  contextmenu: [e: MouseEvent, bm: Bookmark];
  touchstart: [e: TouchEvent, bm: Bookmark];
  touchmove: [];
  touchend: [];
}>();

const imgFailed = ref(false);

watch(
  () => [props.bookmark.favicon, props.bookmark.url],
  () => {
    imgFailed.value = false;
  }
);

function getFaviconSrc(bm: Bookmark): string {
  if (bm.favicon && (bm.favicon.startsWith('data:') || bm.favicon.startsWith('/api/'))) {
    return bm.favicon;
  }
  const params = new URLSearchParams();
  if (bm.url) params.set('url', bm.url);
  if (bm.favicon) params.set('icon', bm.favicon);
  if (bm.title) params.set('title', bm.title);
  return `/api/favicon?${params.toString()}`;
}

function handleImgError() {
  imgFailed.value = true;
}

const tooltipText = computed(() => {
  return props.bookmark.description
    ? `${props.bookmark.title} — ${props.bookmark.description}`
    : (props.bookmark.title || props.bookmark.url);
});
</script>

<template>
  <Tooltip :delay-duration="0">
    <TooltipTrigger as-child>
      <div
        class="group relative flex items-center justify-between gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-2 sm:py-3 bg-white dark:bg-[#18181b] rounded-sm border border-border/80 hover:border-border dark:border-zinc-800/90 dark:hover:border-zinc-700 dark:hover:bg-[#1f1f23] shadow-xs hover:shadow-md dark:shadow-none hover:-translate-y-0.5 transition-all duration-200 ease-out cursor-pointer select-none overflow-hidden h-[58px] sm:h-[64px] outline-none ring-0"
        style="-webkit-tap-highlight-color: transparent;"
        @click="emit('click', bookmark)"
        @contextmenu="emit('contextmenu', $event, bookmark)"
        @touchstart="emit('touchstart', $event, bookmark)"
        @touchmove="emit('touchmove')"
        @touchend="emit('touchend')"
      >
        <!-- 左侧: 圆形组件包裹网站图标 -->
        <div class="size-6.5 sm:size-8 min-w-[26px] sm:min-w-[32px] min-h-[26px] sm:min-h-[32px] max-w-[26px] sm:max-w-[32px] max-h-[26px] sm:max-h-[32px] rounded-full bg-muted/60 flex items-center justify-center overflow-hidden shrink-0 p-1 group-hover:scale-105 transition-transform duration-200">
          <img
            v-if="!imgFailed"
            :src="getFaviconSrc(bookmark)"
            :alt="bookmark.title"
            class="size-3.5 sm:size-4 max-w-full max-h-full object-contain rounded-full"
            loading="lazy"
            @error="handleImgError"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-white text-[8px] sm:text-[10px] font-bold rounded-full uppercase"
            :style="{ backgroundColor: getAvatarColor(bookmark.title || bookmark.url) }"
          >
            {{ getAvatarChar(bookmark.title, bookmark.url) }}
          </div>
        </div>

        <!-- 中间: 标题与描述信息 -->
        <div class="flex-1 min-w-0 flex flex-col justify-center text-left">
          <div class="flex items-center gap-1 min-w-0">
            <span class="text-xs sm:text-[13px] font-semibold text-foreground/90 truncate group-hover:text-primary transition-colors leading-tight">
              {{ bookmark.title }}
            </span>
            <Lock v-if="bookmark.is_private" class="size-2.5 sm:size-3 text-amber-500 shrink-0" />
          </div>
          <div class="text-[10px] sm:text-[11px] text-muted-foreground/75 truncate leading-tight mt-0.5 sm:mt-1">
            {{ bookmark.description || bookmark.url }}
          </div>
        </div>

        <!-- 右侧: 轻量圆环右箭头按钮 (点击在当前标签页打开书签) -->
        <button
          type="button"
          class="size-4.5 sm:size-5.5 rounded-full border border-muted-foreground/20 hover:border-primary/60 hover:bg-primary/10 flex items-center justify-center text-muted-foreground/40 hover:text-primary shrink-0 transition-all cursor-pointer select-none outline-none"
          title="在当前标签页打开"
          @click.stop="emit('openCurrent', bookmark)"
          @touchstart.stop
        >
          <ChevronRight class="size-2 sm:size-3 stroke-[2]" />
        </button>
      </div>
    </TooltipTrigger>
    <TooltipContent side="bottom" :side-offset="6" class="max-w-[260px] break-words text-center leading-relaxed text-xs">
      {{ tooltipText }}
    </TooltipContent>
  </Tooltip>
</template>
