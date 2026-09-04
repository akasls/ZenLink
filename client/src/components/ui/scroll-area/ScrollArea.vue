<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue';
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  type ScrollAreaRootProps,
  ScrollAreaViewport,
} from 'radix-vue';
import ScrollBar from './ScrollBar.vue';
import { cn } from '@/utils/cn';

const props = withDefaults(
  defineProps<ScrollAreaRootProps & { class?: HTMLAttributes['class'] }>(),
  {
    type: 'hover',
    scrollHideDelay: 600,
  }
);

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props;
  return delegated;
});
</script>

<template>
  <ScrollAreaRoot
    v-bind="delegatedProps"
    :class="cn('relative overflow-hidden', props.class)"
  >
    <ScrollAreaViewport class="h-full w-full rounded-[inherit]">
      <slot />
    </ScrollAreaViewport>
    <ScrollBar />
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
