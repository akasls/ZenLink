<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue';
import { DialogTitle, type DialogTitleProps } from 'radix-vue';
import { cn } from '@/utils/cn';

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes['class'] }>();

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props;
  return delegated;
});
</script>

<template>
  <DialogTitle
    v-bind="delegatedProps"
    :class="cn('text-base font-semibold text-foreground', props.class)"
  >
    <slot />
  </DialogTitle>
</template>
