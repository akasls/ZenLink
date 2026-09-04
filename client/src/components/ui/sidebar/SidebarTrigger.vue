<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { PanelLeft } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { useSidebar } from './utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

const { toggleSidebar } = useSidebar();
</script>

<template>
  <Button
    data-sidebar="trigger"
    variant="ghost"
    size="icon"
    :class="cn('h-7 w-7 text-muted-foreground hover:text-foreground', props.class)"
    @click="toggleSidebar"
  >
    <PanelLeft class="h-4 w-4" />
    <span class="sr-only">Toggle Sidebar</span>
  </Button>
</template>
