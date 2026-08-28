<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api';
import { ElMessage } from 'element-plus';
import { startAuthentication } from '@simplewebauthn/browser';

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  username: '',
  password: '',
  totpCode: '',
});

const loading = ref(false);
const passkeyLoading = ref(false);
const errors = reactive<Record<string, string>>({});

// 密码登录
async function handleLogin() {
  Object.keys(errors).forEach((key) => delete errors[key]);

  if (!form.username) errors.username = '请输入用户名';
  if (!form.password) errors.password = '请输入密码';
  if (Object.keys(errors).length > 0) return;

  loading.value = true;
  try {
    const result = await authStore.login(
      form.username,
      form.password,
      form.totpCode ? form.totpCode.trim() : undefined
    );

    if (result.requireTotp) {
      errors.totp = '该账户已开启两步验证，请输入 6 位 TOTP 动态码';
      ElMessage.warning('该账户已开启两步验证，请输入 6 位动态验证码');
    } else {
      ElMessage.success('登录成功，欢迎回来');
      router.push('/');
    }
  } catch (err: any) {
    const message = err.response?.data?.error || '登录失败';
    ElMessage.error(message);
  } finally {
    loading.value = false;
  }
}

// Passkey 登录
async function handlePasskeyLogin() {
  passkeyLoading.value = true;
  try {
    const { data: options } = await authApi.getWebAuthnLoginOptions();
    const credential = await startAuthentication(options);
    await authStore.loginWithPasskey(credential);
    ElMessage.success('通过 Passkey 验证登录成功');
    router.push('/');
  } catch (err: any) {
    const message = err.response?.data?.error || err.message || 'Passkey 登录失败';
    ElMessage.error(message);
  } finally {
    passkeyLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0b0f19] px-4">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-6">
        <router-link to="/" class="inline-flex items-center gap-2 no-underline">
          <div class="w-10 h-10 bg-indigo-600 rounded-md flex items-center justify-center shadow-sm">
            <span class="text-white font-bold text-lg">Z</span>
          </div>
        </router-link>
        <h1 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-3">登录 ZenLink</h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">管理你的个人书签与导航系统</p>
      </div>

      <!-- 登录表单 -->
      <div class="bg-white dark:bg-[#131b2e] rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <el-form @submit.prevent="handleLogin" class="space-y-4">
          <el-form-item :error="errors.username">
            <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">用户名</label>
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              :prefix-icon="'User' as any"
            />
          </el-form-item>

          <el-form-item :error="errors.password">
            <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">密码</label>
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              show-password
              :prefix-icon="'Lock' as any"
            />
          </el-form-item>

          <!-- TOTP 输入框（默认展示，未开启留空） -->
          <el-form-item :error="errors.totp">
            <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">两步验证码 (未启用2FA可留空)</label>
            <el-input
              v-model="form.totpCode"
              placeholder="6 位动态验证码 (未开启 2FA 请留空)"
              maxlength="6"
              :prefix-icon="'Key' as any"
            />
          </el-form-item>

          <el-button
            type="primary"
            native-type="submit"
            class="w-full"
            :loading="loading"
          >
            <el-icon class="mr-1"><component is="Right" /></el-icon>
            登录
          </el-button>
        </el-form>

        <el-divider>
          <span class="text-xs text-slate-400">或</span>
        </el-divider>

        <!-- Passkey 登录 -->
        <el-button
          class="w-full"
          :loading="passkeyLoading"
          @click="handlePasskeyLogin"
        >
          <el-icon class="mr-1"><component is="Key" /></el-icon>
          使用 Passkey 登录
        </el-button>
        <p class="text-[11px] text-slate-400 text-center mt-2">
          支持指纹、Face ID 或 USB 安全硬件密钥
        </p>
      </div>

      <!-- 返回首页 -->
      <div class="text-center mt-4">
        <router-link to="/" class="text-xs text-indigo-500 hover:text-indigo-400">
          ← 返回首页
        </router-link>
      </div>
    </div>
  </div>
</template>
