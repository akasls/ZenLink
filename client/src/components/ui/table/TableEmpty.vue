<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import TableRow from './TableRow.vue';
import TableCell from './TableCell.vue';
import { cn } from '@/utils/cn';

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    colspan?: number;
  }>(),
  {
    colspan: 1,
  }
);
</script>

<template>
  <TableRow>
    <TableCell
      :class="
        cn(
          'p-8 text-center align-middle text-xs text-muted-foreground whitespace-nowrap',
          props.class
        )
      "
      :colspan="colspan"
    >
      <slot />
    </TableCell>
  </TableRow>
</template>
