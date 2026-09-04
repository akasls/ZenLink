import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { registerSW } from 'virtual:pwa-register';

import './style.css';

import App from './App.vue';
import router from './router';
import { useThemeStore } from './stores/theme';

registerSW({ immediate: true });

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// 初始化主题
const themeStore = useThemeStore();
themeStore.init();

app.mount('#app');
