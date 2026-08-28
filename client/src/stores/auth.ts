import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api';

export interface User {
  id: number;
  username: string;
  totp_enabled?: boolean;
  webauthn_enabled?: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(localStorage.getItem('zenlink_token'));

  const isLoggedIn = computed(() => !!token.value && !!user.value);

  async function login(username: string, password: string, totpCode?: string) {
    const { data } = await authApi.login({ username, password, totpCode });

    if (data.requireTotp) {
      return { requireTotp: true };
    }

    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('zenlink_token', data.token);
    return { success: true };
  }

  async function loginWithPasskey(credential: any) {
    const { data } = await authApi.verifyWebAuthnLogin(credential);
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('zenlink_token', data.token);
    return { success: true };
  }

  async function fetchUser() {
    if (!token.value) return;
    try {
      const { data } = await authApi.getMe();
      user.value = data.user;
    } catch {
      logout();
    }
  }

  function logout() {
    user.value = null;
    token.value = null;
    localStorage.removeItem('zenlink_token');
  }

  return { user, token, isLoggedIn, login, loginWithPasskey, fetchUser, logout };
});
