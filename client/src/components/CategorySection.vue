<script setup lang="ts">
import { mapIcon } from '@/utils/icon-map';
import CategoryCapsule from './CategoryCapsule.vue';
import BookmarkGrid from './BookmarkGrid.vue';
import type { Bookmark } from './BookmarkCard.vue';

interface Category {
  id: number;
  name: string;
  icon: string;
  is_private: number;
  parent_id: number | null;
  sort_order?: number;
}

const props = defineProps<{
  category: Category;
  subCategories: Category[];
  activeSubId?: number | null;
  bookmarks: Bookmark[];
  isLoggedIn: boolean;
}>();

const emit = defineEmits<{
  'update:activeSubId': [id: number | null];
  selectSub: [categoryId: number, subId: number];
  copy: [bookmark: Bookmark];
  edit: [bookmark: Bookmark];
  delete: [bookmark: Bookmark];
  reorder: [bookmarks: Bookmark[]];
}>();

function onSelectSub(subId: number) {
  emit('update:activeSubId', subId);
  emit('selectSub', props.category.id, subId);
}
</script>

<template>
  <section :id="`sec-${category.id}`" class="category-section scroll-mt-4">
    <div class="category-header">
      <el-icon class="category-header-icon"><component :is="mapIcon(category.icon)" /></el-icon>
      <h2>{{ category.name }}</h2>
    </div>

    <!-- 二级分类圆角胶囊组件 (单行可水平滑动) -->
    <CategoryCapsule
      :sub-categories="subCategories"
      :model-value="activeSubId"
      @select="onSelectSub"
    />

    <!-- 书签网格卡片流 -->
    <BookmarkGrid
      v-if="bookmarks.length"
      :bookmarks="bookmarks"
      :is-logged-in="isLoggedIn"
      @copy="emit('copy', $event)"
      @edit="emit('edit', $event)"
      @delete="emit('delete', $event)"
      @reorder="emit('reorder', $event)"
    />
    <p v-else class="text-xs text-center py-4" style="color: var(--zl-text-muted);">暂无书签</p>
  </section>
</template>
