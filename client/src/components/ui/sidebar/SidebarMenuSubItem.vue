<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <li :class="class">
    <slot />
  </li>
</template>
