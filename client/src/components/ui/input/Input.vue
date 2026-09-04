<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/utils/cn';

const modelValue = defineModel<string | number>();

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <input
    v-model="modelValue"
    :class="
      cn(
        'flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground',
        props.class
      )
    "
  />
</template>
