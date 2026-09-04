<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue';
import { DialogTitle, type DialogTitleProps, useForwardProps } from 'radix-vue';
import { cn } from '@/utils/cn';

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes['class'] }>();

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props;
  return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <DialogTitle
    v-bind="forwardedProps"
    :class="cn('text-sm font-semibold leading-none tracking-tight text-foreground', props.class)"
  >
    <slot />
  </DialogTitle>
</template>
