<script setup lang="ts">
import { type HTMLAttributes } from 'vue';
import { cn } from '@/utils/cn';
import { useSidebar } from './utils';

interface Props {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  side: 'left',
  variant: 'sidebar',
  collapsible: 'icon',
});

const { isMobile, state, setOpen } = useSidebar();
</script>

<template>
  <!-- Non-collapsible regular sidebar branch (e.g. inner nested sidebars in sidebar-09) -->
  <div
    v-if="collapsible === 'none'"
    :class="
      cn(
        'flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground',
        props.class
      )
    "
  >
    <slot />
  </div>

  <div
    v-else
    class="group peer text-sidebar-foreground"
    :data-state="state"
    :data-collapsible="state === 'collapsed' ? collapsible : ''"
    :data-variant="variant"
    :data-side="side"
  >
    <!-- Mobile Backdrop when expanded -->
    <div
      v-if="isMobile && state === 'expanded'"
      class="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity md:hidden"
      @click="setOpen(false)"
    />

    <!-- Gap placeholder for fixed sidebar -->
    <div
      :class="
        cn(
          'duration-200 relative h-svh bg-transparent transition-[width] ease-linear shrink-0',
          'w-[--sidebar-width-icon] md:w-[--sidebar-width]',
          'group-data-[collapsible=icon]:w-[--sidebar-width-icon]',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4))]'
            : ''
        )
      "
    />

    <!-- Fixed Sidebar Container -->
    <div
      :class="
        cn(
          'duration-200 fixed inset-y-0 z-40 md:z-30 h-svh transition-[left,right,width] ease-linear flex flex-col',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          'w-[--sidebar-width] group-data-[collapsible=icon]:w-[--sidebar-width-icon] border-r border-sidebar-border bg-sidebar',
          state === 'expanded' && isMobile ? 'shadow-2xl' : '',
          props.class
        )
      "
    >
      <div
        data-sidebar="sidebar"
        :class="
          cn(
            'flex h-full w-full flex-col bg-sidebar overflow-hidden',
            variant === 'floating' ? 'rounded-lg border border-sidebar-border shadow' : ''
          )
        "
      >
        <slot />
      </div>
    </div>
  </div>
</template>
