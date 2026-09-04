<script setup lang="ts">
import { type HTMLAttributes } from 'vue';
import { cn } from '@/utils/cn';
import { useSidebar } from './utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';

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

const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
</script>

<template>
  <!-- Mobile Mode (Sheet) -->
  <Sheet v-if="isMobile" :open="openMobile" @update:open="setOpenMobile">
    <SheetContent
      :side="side"
      class="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
    >
      <div class="flex h-full w-full flex-col">
        <slot />
      </div>
    </SheetContent>
  </Sheet>

  <!-- Desktop Mode -->
  <div
    v-else
    class="group peer hidden md:block text-sidebar-foreground"
    :data-state="state"
    :data-collapsible="state === 'collapsed' ? collapsible : ''"
    :data-variant="variant"
    :data-side="side"
  >
    <!-- Gap placeholder for fixed sidebar -->
    <div
      :class="
        cn(
          'duration-200 relative h-svh w-[--sidebar-width] bg-transparent transition-[width] ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4))]'
            : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon]'
        )
      "
    />
    <div
      :class="
        cn(
          'duration-200 fixed inset-y-0 z-20 hidden h-svh w-[--sidebar-width] transition-[left,right,width] ease-linear md:flex flex-col',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4)+2px)]'
            : 'group-data-[collapsible=icon]:w-[--sidebar-width-icon] border-r border-sidebar-border',
          props.class
        )
      "
    >
      <div
        data-sidebar="sidebar"
        :class="
          cn(
            'flex h-full w-full flex-col bg-sidebar',
            variant === 'floating' ? 'rounded-lg border border-sidebar-border shadow' : ''
          )
        "
      >
        <slot />
      </div>
    </div>
  </div>
</template>
