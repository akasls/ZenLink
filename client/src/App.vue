<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import ConfirmDialog from '@/components/ui/confirm/ConfirmDialog.vue';

const authStore = useAuthStore();
const siteStore = useSiteStore();

onMounted(async () => {
  await authStore.fetchUser();
  await siteStore.fetchSettings();
});
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <router-view />
    <Toaster richColors position="top-center" />
    <ConfirmDialog />
  </TooltipProvider>
</template>
