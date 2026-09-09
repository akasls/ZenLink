<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/utils/cn';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <main
    :class="
      cn(
        'relative flex min-h-screen min-h-dvh flex-1 flex-col bg-background min-w-0 max-w-full w-full overflow-x-hidden',
        'peer-data-[variant=inset]:min-h-[calc(100dvh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow',
        props.class
      )
    "
  >
    <slot />
  </main>
</template>
