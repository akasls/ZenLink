<script setup lang="ts">
import { ref, watch } from 'vue';
import { getAvatarChar, getAvatarColor } from '@/utils/avatar';

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

watch(() => [props.bookmark.favicon, props.bookmark.url], () => {
  imgFailed.value = false;
});

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
</script>

<template>
  <el-tooltip
    effect="dark"
    placement="bottom"
    :content="bookmark.description ? `${bookmark.title} — ${bookmark.description}` : bookmark.url"
    :show-after="180"
    :hide-after="0"
    popper-class="bookmark-dark-tooltip"
  >
    <div
      class="bookmark-card"
      @click="emit('click', bookmark)"
      @contextmenu="emit('contextmenu', $event, bookmark)"
      @touchstart="emit('touchstart', $event, bookmark)"
      @touchmove="emit('touchmove')"
      @touchend="emit('touchend')"
    >
      <div class="bk-icon">
        <img
          v-if="!imgFailed"
          :src="getFaviconSrc(bookmark)"
          :alt="bookmark.title"
          loading="lazy"
          @error="handleImgError"
        />
        <div
          v-else
          class="bk-avatar-fallback"
          :style="{ backgroundColor: getAvatarColor(bookmark.title || bookmark.url) }"
        >
          {{ getAvatarChar(bookmark.title, bookmark.url) }}
        </div>
      </div>
      <div class="bk-info">
        <div class="bk-title">{{ bookmark.title }}</div>
        <div class="bk-desc">{{ bookmark.description || bookmark.url }}</div>
      </div>
    </div>
  </el-tooltip>
</template>
