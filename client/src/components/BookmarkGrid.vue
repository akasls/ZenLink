<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import Sortable from 'sortablejs';
import BookmarkCard, { type Bookmark } from './BookmarkCard.vue';

const props = defineProps<{ bookmarks: Bookmark[]; isLoggedIn: boolean; }>();
const emit = defineEmits<{ copy: [bookmark: Bookmark]; edit: [bookmark: Bookmark]; delete: [bookmark: Bookmark]; reorder: [bookmarks: Bookmark[]]; }>();

const gridRef = ref<HTMLElement | null>(null);
let sortable: Sortable | null = null;

// 右键 / 长按菜单
const contextMenuVisible = ref(false);
const contextMenuStyle = ref({ left: '0px', top: '0px' });
const ctxTarget = ref<Bookmark | null>(null);

let touchTimer: ReturnType<typeof setTimeout> | null = null;
let touchMoved = false;

function showContextMenuAt(clientX: number, clientY: number, bm: Bookmark) {
  if (!props.isLoggedIn) return;
  ctxTarget.value = bm;
  const menuWidth = 150;
  const menuHeight = 130;
  const x = Math.min(clientX, window.innerWidth - menuWidth - 10);
  const y = Math.min(clientY, window.innerHeight - menuHeight - 10);
  contextMenuStyle.value = { left: `${Math.max(10, x)}px`, top: `${Math.max(10, y)}px` };
  contextMenuVisible.value = true;
}

function onCtx(e: MouseEvent, bm: Bookmark) {
  if (!props.isLoggedIn) return;
  e.preventDefault();
  showContextMenuAt(e.clientX, e.clientY, bm);
}

function onTouchStart(e: TouchEvent, bm: Bookmark) {
  if (!props.isLoggedIn) return;
  touchMoved = false;
  const touch = e.touches[0];
  if (!touch) return;
  touchTimer = setTimeout(() => {
    if (!touchMoved) {
      showContextMenuAt(touch.clientX, touch.clientY, bm);
    }
  }, 500);
}

function onTouchMove() {
  touchMoved = true;
  if (touchTimer) clearTimeout(touchTimer);
}

function onTouchEnd() {
  if (touchTimer) clearTimeout(touchTimer);
}

function closeCtx() { contextMenuVisible.value = false; }
function doCopy() { if (ctxTarget.value) emit('copy', ctxTarget.value); closeCtx(); }
function doEdit() { if (ctxTarget.value) emit('edit', ctxTarget.value); closeCtx(); }
function doDelete() { if (ctxTarget.value) emit('delete', ctxTarget.value); closeCtx(); }

let isDragging = false;

function open(bm: Bookmark) {
  if (isDragging || contextMenuVisible.value) {
    closeCtx();
    return;
  }
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

function onDoc() { closeCtx(); }
onMounted(() => {
  document.addEventListener('click', onDoc);
  window.addEventListener('scroll', onDoc, { passive: true });
  nextTick(initSort);
});
onUnmounted(() => {
  document.removeEventListener('click', onDoc);
  window.removeEventListener('scroll', onDoc);
  sortable?.destroy();
});
watch(() => props.bookmarks, () => nextTick(initSort), { deep: true });
</script>

<template>
  <div ref="gridRef" class="bookmark-grid">
    <BookmarkCard
      v-for="bm in bookmarks"
      :key="bm.id"
      :bookmark="bm"
      @click="open(bm)"
      @contextmenu="onCtx($event, bm)"
      @touchstart="onTouchStart($event, bm)"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    />
  </div>

  <Teleport to="body">
    <div v-if="contextMenuVisible" class="fixed ctx-menu" :style="{ ...contextMenuStyle, zIndex: 9999 }" @click.stop>
      <button class="ctx-item" @click="doCopy"><el-icon class="mr-1"><component is="CopyDocument" /></el-icon> 复制</button>
      <button class="ctx-item" @click="doEdit"><el-icon class="mr-1"><component is="Edit" /></el-icon> 编辑</button>
      <button class="ctx-item danger" @click="doDelete"><el-icon class="mr-1"><component is="Delete" /></el-icon> 删除</button>
    </div>
  </Teleport>
</template>
