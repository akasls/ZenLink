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
  <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-8">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-5">
        <router-link to="/" class="inline-flex items-center gap-2 no-underline">
          <div class="w-9 h-9 bg-slate-900 dark:bg-slate-100 rounded-md flex items-center justify-center shadow-subtle text-white dark:text-slate-900 font-bold text-sm">
            <span>Z</span>
          </div>
        </router-link>
        <h1 class="text-base font-semibold text-slate-900 dark:text-slate-100 mt-3 m-0">登录 ZenLink</h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-0">管理你的个人书签、笔记与 AI 助手</p>
      </div>

      <!-- 登录表单卡片 -->
      <div class="bg-white dark:bg-slate-900 rounded-lg shadow-subtle border border-slate-200/80 dark:border-slate-800 p-5">
        <el-form @submit.prevent="handleLogin" class="space-y-3.5">
          <el-form-item :error="errors.username">
            <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">用户名</label>
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              :prefix-icon="'User' as any"
              autofocus
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

          <!-- TOTP 输入框 -->
          <el-form-item :error="errors.totp">
            <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">两步验证码 (未启用2FA可留空)</label>
            <el-input
              v-model="form.totpCode"
              placeholder="6 位动态验证码 (未开启 2FA 请留空)"
              maxlength="6"
              :prefix-icon="'Key' as any"
            />
          </el-form-item>

          <button
            type="submit"
            class="w-full h-8 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium text-xs hover:bg-slate-800 dark:hover:bg-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            :disabled="loading"
            @click.prevent="handleLogin"
          >
            <el-icon v-if="loading" class="is-loading mr-1.5"><component is="Loading" /></el-icon>
            <span>{{ loading ? '登录中...' : '立即登录' }}</span>
          </button>
        </el-form>

        <div class="relative my-3.5 text-center after:content-[''] after:absolute after:top-1/2 after:left-0 after:right-0 after:h-px after:bg-slate-200/80 dark:after:bg-slate-800">
          <span class="relative z-10 bg-white dark:bg-slate-900 px-2 text-[11px] text-slate-400">
            或使用生物识别
          </span>
        </div>

        <!-- Passkey 登录 -->
        <button
          type="button"
          class="w-full h-8 rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          :disabled="passkeyLoading"
          @click="handlePasskeyLogin"
        >
          <el-icon class="text-sm"><component :is="passkeyLoading ? 'Loading' : 'Key'" /></el-icon>
          <span>{{ passkeyLoading ? '验证中...' : '使用 Passkey 登录' }}</span>
        </button>

        <p class="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-2.5 mb-0">
          支持指纹、Face ID 或 Windows Hello 硬件密钥
        </p>
      </div>

      <!-- 返回首页 -->
      <div class="text-center mt-4">
        <router-link to="/" class="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 no-underline transition-colors">
          ← 返回导航主页
        </router-link>
      </div>
    </div>
  </div>
</template>

