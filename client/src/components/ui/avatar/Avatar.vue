<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { AvatarRoot } from 'radix-vue';
import { cn } from '@/utils/cn';

const props = defineProps<{
  class?: HTMLAttributes['class'];
  size?: 'sm' | 'base' | 'lg';
}>();
</script>

<template>
  <AvatarRoot
    :class="
      cn(
        'relative flex h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted border border-border/70',
        props.size === 'sm' && 'h-7 w-7 rounded-md',
        props.size === 'lg' && 'h-11 w-11 rounded-xl',
        props.class
      )
    "
  >
    <slot />
  </AvatarRoot>
</template>
