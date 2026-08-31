<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api';
import { ElMessage } from 'element-plus';
import { startAuthentication } from '@simplewebauthn/browser';

const props = defineProps<{
  visible: boolean;
  targetView?: string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  success: [targetView?: string];
}>();

const authStore = useAuthStore();

const form = reactive({
  username: '',
  password: '',
  totpCode: '',
});

const loading = ref(false);
const passkeyLoading = ref(false);
const errors = reactive<Record<string, string>>({});

function resetForm() {
  form.username = '';
  form.password = '';
  form.totpCode = '';
  Object.keys(errors).forEach((key) => delete errors[key]);
}

watch(() => props.visible, (val) => {
  if (!val) resetForm();
});

// 账号密码登录
async function handleLogin() {
  Object.keys(errors).forEach((key) => delete errors[key]);

  if (!form.username.trim()) errors.username = '请输入用户名';
  if (!form.password) errors.password = '请输入密码';
  if (Object.keys(errors).length > 0) return;

  loading.value = true;
  try {
    const result = await authStore.login(
      form.username.trim(),
      form.password,
      form.totpCode.trim() || undefined
    );

    if (result.requireTotp) {
      errors.totp = '该账户已开启两步验证，请输入 6 位 TOTP 动态码';
      ElMessage.warning('该账户已开启两步验证，请输入 6 位动态验证码');
    } else {
      ElMessage.success('登录成功，欢迎回来');
      emit('update:visible', false);
      emit('success', props.targetView);
    }
  } catch (err: any) {
    const message = err.response?.data?.error || '用户名或密码错误';
    ElMessage.error(message);
  } finally {
    loading.value = false;
  }
}

// Passkey 免密登录
async function handlePasskeyLogin() {
  passkeyLoading.value = true;
  try {
    const { data: options } = await authApi.getWebAuthnLoginOptions();
    const credential = await startAuthentication(options);
    await authStore.loginWithPasskey(credential);
    ElMessage.success('通过 Passkey 验证登录成功');
    emit('update:visible', false);
    emit('success', props.targetView);
  } catch (err: any) {
    const message = err.response?.data?.error || err.message || 'Passkey 验证未完成';
    ElMessage.error(message);
  } finally {
    passkeyLoading.value = false;
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="登录后台"
    width="380px"
    align-center
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="flex flex-col">
      <!-- 提示文案 -->
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
        {{ targetView ? '该功能需要管理员权限，请先登录' : '登录以管理书签、在线笔记与 AI 助手' }}
      </p>

      <el-form label-position="top" class="space-y-3 mt-1" @submit.prevent="handleLogin">
        <!-- 用户名 -->
        <el-form-item label="用户名" :error="errors.username">
          <el-input
            v-model="form.username"
            placeholder="请输入管理员用户名"
            prefix-icon="User"
            autofocus
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <!-- 密码 -->
        <el-form-item label="密码" :error="errors.password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入密码"
            prefix-icon="Lock"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <!-- 2FA TOTP 动态码 -->
        <el-form-item label="两步验证码 (未启用可留空)" :error="errors.totp">
          <el-input
            v-model="form.totpCode"
            placeholder="6 位动态验证码 (未开启 2FA 请留空)"
            prefix-icon="Key"
            maxlength="6"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <!-- 登录主按钮 -->
        <div class="pt-1">
          <button
            type="submit"
            class="w-full h-8 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium text-xs hover:bg-slate-800 dark:hover:bg-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            :disabled="loading"
            @click.prevent="handleLogin"
          >
            <el-icon v-if="loading" class="is-loading mr-1.5"><component is="Loading" /></el-icon>
            <span>{{ loading ? '登录中...' : '立即登录' }}</span>
          </button>
        </div>

        <!-- 分割线 -->
        <div class="relative my-3 text-center after:content-[''] after:absolute after:top-1/2 after:left-0 after:right-0 after:h-px after:bg-slate-200/80 dark:after:bg-slate-800">
          <span class="relative z-10 bg-white dark:bg-slate-900 px-2 text-[11px] text-slate-400">
            或使用生物识别
          </span>
        </div>

        <!-- Passkey 登录按钮 -->
        <div>
          <button
            type="button"
            class="w-full h-8 rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            :disabled="passkeyLoading"
            @click="handlePasskeyLogin"
          >
            <el-icon class="text-sm"><component :is="passkeyLoading ? 'Loading' : 'Key'" /></el-icon>
            <span>{{ passkeyLoading ? '验证中...' : 'Passkey 免密登录' }}</span>
          </button>
        </div>
      </el-form>
    </div>
  </el-dialog>
</template>

