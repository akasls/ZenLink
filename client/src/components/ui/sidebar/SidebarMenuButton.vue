<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'radix-vue';
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { cn } from '@/utils/cn';
import { useSidebar } from './utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding,background-color] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 group-data-[collapsible=icon]:group-has-[[data-sidebar=menu-action]]/menu-item:!pr-0 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:mx-auto [&>span]:group-data-[collapsible=icon]:hidden [&>[data-sidebar=menu-badge]]:group-data-[collapsible=icon]:hidden [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        outline:
          'bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:!p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type SidebarMenuButtonVariants = VariantProps<typeof sidebarMenuButtonVariants>;

interface Props extends PrimitiveProps {
  variant?: SidebarMenuButtonVariants['variant'];
  size?: SidebarMenuButtonVariants['size'];
  isActive?: boolean;
  class?: HTMLAttributes['class'];
  tooltip?: string;
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  variant: 'default',
  size: 'default',
  isActive: false,
});

const { isMobile, state } = useSidebar();

const showTooltip = computed(() => {
  return !isMobile.value && state.value === 'collapsed' && !!props.tooltip;
});
</script>

<template>
  <template v-if="showTooltip">
    <Tooltip>
      <TooltipTrigger as-child>
        <Primitive
          data-sidebar="menu-button"
          :data-size="size"
          :data-active="isActive"
          :as="as"
          :as-child="asChild"
          :class="cn(sidebarMenuButtonVariants({ variant, size }), props.class)"
        >
          <slot />
        </Primitive>
      </TooltipTrigger>
      <TooltipContent side="right" align="center">
        {{ tooltip }}
      </TooltipContent>
    </Tooltip>
  </template>

  <Primitive
    v-else
    data-sidebar="menu-button"
    :data-size="size"
    :data-active="isActive"
    :as="as"
    :as-child="asChild"
    :class="cn(sidebarMenuButtonVariants({ variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
