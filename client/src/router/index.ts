import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/MainLayout.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/MainLayout.vue'),
      meta: { view: 'admin' },
    },
    {
      path: '/notes',
      name: 'notes',
      component: () => import('@/views/MainLayout.vue'),
      meta: { view: 'notes' },
    },
    {
      path: '/ai',
      name: 'ai',
      component: () => import('@/views/MainLayout.vue'),
      meta: { view: 'ai' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/share/:code',
      alias: ['/s/:code'],
      name: 'share',
      component: () => import('@/views/ShareView.vue'),
    },
  ],
});

export default router;
