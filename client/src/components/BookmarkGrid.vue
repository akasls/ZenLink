<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import Sortable from 'sortablejs';
import BookmarkCard, { type Bookmark } from './BookmarkCard.vue';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Copy, Pencil, Trash2 } from 'lucide-vue-next';

const props = defineProps<{ bookmarks: Bookmark[]; isLoggedIn: boolean; }>();
const emit = defineEmits<{
  copy: [bookmark: Bookmark];
  edit: [bookmark: Bookmark];
  delete: [bookmark: Bookmark];
  reorder: [bookmarks: Bookmark[]];
}>();

const gridRef = ref<HTMLElement | null>(null);
let sortable: Sortable | null = null;
let isDragging = false;

function open(bm: Bookmark) {
  if (isDragging) return;
  window.open(bm.url, '_blank', 'noopener');
}

function initSort() {
  if (!gridRef.value || !props.isLoggedIn) return;
  if (sortable) sortable.destroy();
  sortable = Sortable.create(gridRef.value, {
    animation: 200,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    chosenClass: 'sortable-chosen',
    delay: 100,
    delayOnTouchOnly: true,
    touchStartThreshold: 5,
    onStart: () => {
      isDragging = true;
    },
    onEnd: (evt) => {
      setTimeout(() => { isDragging = false; }, 150);
      if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) return;
      const items = [...props.bookmarks];
      const [m] = items.splice(evt.oldIndex, 1);
      items.splice(evt.newIndex, 0, m);
      emit('reorder', items);
    },
  });
}

onMounted(() => {
  nextTick(initSort);
});

onUnmounted(() => {
  sortable?.destroy();
});

watch(() => props.bookmarks, () => nextTick(initSort), { deep: true });
</script>

<template>
  <div ref="gridRef" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
    <ContextMenu v-for="bm in bookmarks" :key="bm.id">
      <ContextMenuTrigger :disabled="!isLoggedIn" as-child>
        <BookmarkCard
          :bookmark="bm"
          @click="open(bm)"
        />
      </ContextMenuTrigger>

      <ContextMenuContent v-if="isLoggedIn" class="w-36">
        <ContextMenuItem class="gap-2 text-xs" @click="emit('copy', bm)">
          <Copy class="h-3.5 w-3.5 text-muted-foreground" />
          <span>复制链接</span>
        </ContextMenuItem>
        <ContextMenuItem class="gap-2 text-xs" @click="emit('edit', bm)">
          <Pencil class="h-3.5 w-3.5 text-muted-foreground" />
          <span>编辑书签</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          class="gap-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
          @click="emit('delete', bm)"
        >
          <Trash2 class="h-3.5 w-3.5 text-destructive" />
          <span>删除书签</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </div>
</template>
