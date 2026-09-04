<script lang="ts" setup>
import { Primitive, type PrimitiveProps } from 'radix-vue';
import type { HTMLAttributes } from 'vue';
import { cn } from '@/utils/cn';

interface Props extends PrimitiveProps {
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  as: 'a',
});
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="cn('transition-colors hover:text-foreground cursor-pointer', props.class)"
  >
    <slot />
  </Primitive>
</template>
