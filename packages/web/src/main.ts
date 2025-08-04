import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { MotionPlugin } from '@vueuse/motion';

import App from './App.vue';
import router from './router/index.js';
import { useAuthStore } from './stores/auth.js';
import { errorHandlerPlugin } from './plugins/errorHandler.js';

import './assets/main.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(MotionPlugin);
app.use(errorHandlerPlugin);

// Initialize authentication
const authStore = useAuthStore();
authStore.initializeAuth().then(() => {
  app.mount('#app');
}).catch((error) => {
  // eslint-disable-next-line no-console
  console.warn('Auth initialization failed:', error);
  app.mount('#app');
});