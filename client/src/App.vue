<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';

const authStore = useAuthStore();
const siteStore = useSiteStore();

onMounted(async () => {
  await authStore.fetchUser();
  await siteStore.fetchSettings();
});
</script>

<template>
  <router-view />
</template>
