<script setup lang="ts">
import { computed, provide, ref, onMounted, onUnmounted, type HTMLAttributes } from 'vue';
import { cn } from '@/utils/cn';
import {
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SidebarContextKey,
  type SidebarContext,
} from './utils';
import { TooltipProvider } from '@/components/ui/tooltip';

interface Props {
  defaultOpen?: boolean;
  open?: boolean;
  class?: HTMLAttributes['class'];
  style?: HTMLAttributes['style'];
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpen: undefined,
  open: undefined,
});

const emit = defineEmits<{
  'update:open': [open: boolean];
}>();

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
function updateIsMobile() {
  isMobile.value = window.innerWidth < 768;
}

const internalOpen = ref(
  props.defaultOpen !== undefined
    ? props.defaultOpen
    : (typeof window !== 'undefined' ? window.innerWidth >= 768 : true)
);
const open = computed({
  get: () => props.open !== undefined ? props.open : internalOpen.value,
  set: (val: boolean) => {
    internalOpen.value = val;
    emit('update:open', val);
  },
});

const openMobile = ref(false);

function setOpen(value: boolean) {
  open.value = value;
}

function setOpenMobile(value: boolean) {
  openMobile.value = value;
}

function toggleSidebar() {
  open.value = !open.value;
}

const state = computed<'expanded' | 'collapsed'>(() => (open.value ? 'expanded' : 'collapsed'));

const contextValue: SidebarContext = {
  state,
  open,
  setOpen,
  openMobile,
  setOpenMobile,
  isMobile,
  toggleSidebar,
};

provide(SidebarContextKey, contextValue);

function handleKeyDown(event: KeyboardEvent) {
  if (
    event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT &&
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    !event.altKey
  ) {
    event.preventDefault();
    toggleSidebar();
  }
}

onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <div
      :style="[
        {
          '--sidebar-width': SIDEBAR_WIDTH,
          '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
        },
        props.style as any,
      ]"
      :class="
        cn(
          'group/sidebar-wrapper flex min-h-screen min-h-dvh w-full min-w-0 max-w-full overflow-x-hidden bg-sidebar',
          props.class
        )
      "
    >
      <slot />
    </div>
  </TooltipProvider>
</template>
