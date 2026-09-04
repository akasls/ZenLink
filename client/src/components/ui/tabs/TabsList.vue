<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue';
import { TabsList, type TabsListProps } from 'radix-vue';
import { cn } from '@/utils/cn';

const props = defineProps<TabsListProps & { class?: HTMLAttributes['class'] }>();

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props;
  return delegated;
});
</script>

<template>
  <TabsList
    v-bind="delegatedProps"
    :class="
      cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-muted/80 p-1 text-muted-foreground border border-border/70',
        props.class
      )
    "
  >
    <slot />
  </TabsList>
</template>
