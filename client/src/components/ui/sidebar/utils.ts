import { type ComputedRef, type InjectionKey, type Ref, inject } from 'vue';

export const SIDEBAR_COOKIE_NAME = 'sidebar:state';
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_WIDTH = '260px';
export const SIDEBAR_WIDTH_MOBILE = '18rem';
export const SIDEBAR_WIDTH_ICON = '52px';
export const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

export interface SidebarContext {
  state: ComputedRef<'expanded' | 'collapsed'>;
  open: Ref<boolean>;
  setOpen: (value: boolean) => void;
  openMobile: Ref<boolean>;
  setOpenMobile: (value: boolean) => void;
  isMobile: Ref<boolean>;
  toggleSidebar: () => void;
}

export const SidebarContextKey: InjectionKey<SidebarContext> = Symbol('SidebarContext');

export function useSidebar(): SidebarContext {
  const context = inject(SidebarContextKey, null);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
