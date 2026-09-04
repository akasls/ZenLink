<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { getAvatarChar, getAvatarColor } from '@/utils/avatar';
import { Lock } from 'lucide-vue-next';

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
  <div
    class="group relative flex items-center gap-3 p-3 bg-card rounded-xl border border-border/80 hover:border-primary/50 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer select-none overflow-hidden h-[66px]"
    :title="tooltipText"
    @click="emit('click', bookmark)"
    @contextmenu="emit('contextmenu', $event, bookmark)"
    @touchstart="emit('touchstart', $event, bookmark)"
    @touchmove="emit('touchmove')"
    @touchend="emit('touchend')"
  >
    <!-- 图标 (优雅微圆角，固定36px宽高，Hover微放大) -->
    <div class="w-9 h-9 min-w-[36px] min-h-[36px] max-w-[36px] max-h-[36px] rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center overflow-hidden shrink-0 p-1 group-hover:scale-105 transition-transform duration-200">
      <img
        v-if="!imgFailed"
        :src="getFaviconSrc(bookmark)"
        :alt="bookmark.title"
        class="w-5 h-5 max-w-full max-h-full object-contain"
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
      <div class="flex items-center justify-between gap-1">
        <span class="text-xs font-semibold text-foreground/90 truncate group-hover:text-primary transition-colors leading-tight">
          {{ bookmark.title }}
        </span>
        <Lock v-if="bookmark.is_private" class="h-3 w-3 text-amber-500/80 shrink-0" title="私有书签" />
      </div>
      <div class="text-[11px] text-muted-foreground truncate leading-tight mt-1">
        {{ bookmark.description || bookmark.url }}
      </div>
    </div>
  </div>
</template>
