<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { getAvatarChar, getAvatarColor } from '@/utils/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
    : props.bookmark.url;
});
</script>

<template>
  <Tooltip :delay-duration="300">
    <TooltipTrigger as-child>
      <div
        class="group relative flex items-center gap-3 p-3 bg-card rounded-lg border border-border/70 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-border hover:shadow-sm transition-all duration-150 cursor-pointer select-none overflow-hidden"
        @click="emit('click', bookmark)"
        @contextmenu="emit('contextmenu', $event, bookmark)"
        @touchstart="emit('touchstart', $event, bookmark)"
        @touchmove="emit('touchmove')"
        @touchend="emit('touchend')"
      >
        <!-- 图标 (克制圆角，高品质渲染) -->
        <div class="w-8 h-8 rounded-md bg-muted/60 border border-border/50 flex items-center justify-center overflow-hidden shrink-0 p-1">
          <img
            v-if="!imgFailed"
            :src="getFaviconSrc(bookmark)"
            :alt="bookmark.title"
            class="w-full h-full object-contain"
            loading="lazy"
            @error="handleImgError"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-white text-[11px] font-bold rounded uppercase"
            :style="{ backgroundColor: getAvatarColor(bookmark.title || bookmark.url) }"
          >
            {{ getAvatarChar(bookmark.title, bookmark.url) }}
          </div>
        </div>

        <!-- 文本信息 -->
        <div class="flex-1 min-w-0 flex flex-col justify-center">
          <div class="text-xs font-semibold text-foreground/90 truncate group-hover:text-foreground transition-colors leading-tight">
            {{ bookmark.title }}
          </div>
          <div class="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
            {{ bookmark.description || bookmark.url }}
          </div>
        </div>
      </div>
    </TooltipTrigger>
    <TooltipContent side="bottom" class="max-w-xs text-xs">
      {{ tooltipText }}
    </TooltipContent>
  </Tooltip>
</template>
