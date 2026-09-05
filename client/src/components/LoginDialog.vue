<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api';
import { toast } from '@/components/ui/sonner';
import { startAuthentication } from '@simplewebauthn/browser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Lock, Key, Fingerprint, Loader2 } from 'lucide-vue-next';

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

watch(
  () => props.visible,
  (val) => {
    if (!val) resetForm();
  }
);

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
      toast.warning('该账户已开启两步验证，请输入 6 位动态验证码');
    } else {
      toast.success('登录成功，欢迎回来');
      emit('update:visible', false);
      emit('success', props.targetView);
    }
  } catch (err: any) {
    const message = err.response?.data?.error || '用户名或密码错误';
    toast.error(message);
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
    toast.success('通过 Passkey 验证登录成功');
    emit('update:visible', false);
    emit('success', props.targetView);
  } catch (err: any) {
    const message = err.response?.data?.error || err.message || 'Passkey 验证未完成';
    toast.error(message);
  } finally {
    passkeyLoading.value = false;
  }
}
</script>

<template>
  <Dialog :open="visible" @update:open="emit('update:visible', $event)">
    <DialogContent class="sm:max-w-[380px]">
      <DialogHeader>
        <DialogTitle>登录后台</DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground leading-relaxed">
          {{ targetView ? '该功能需要管理员权限，请先登录' : '登录以管理书签、在线笔记与 AI 助手' }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col">
        <form class="space-y-3.5" @submit.prevent="handleLogin">
          <!-- 用户名 -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground/80 flex justify-between">
              <span>用户名</span>
              <span v-if="errors.username" class="text-destructive text-xs">{{ errors.username }}</span>
            </label>
            <div class="relative">
              <User class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="form.username"
                placeholder="请输入管理员用户名"
                class="pl-9"
                autofocus
                @keyup.enter="handleLogin"
              />
            </div>
          </div>

          <!-- 密码 -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground/80 flex justify-between">
              <span>密码</span>
              <span v-if="errors.password" class="text-destructive text-xs">{{ errors.password }}</span>
            </label>
            <div class="relative">
              <Lock class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                class="pl-9"
                @keyup.enter="handleLogin"
              />
            </div>
          </div>

          <!-- 2FA TOTP 动态码 -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground/80 flex justify-between">
              <span>两步验证码 (未启用可留空)</span>
              <span v-if="errors.totp" class="text-destructive text-xs">{{ errors.totp }}</span>
            </label>
            <div class="relative">
              <Key class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="form.totpCode"
                placeholder="6 位动态验证码"
                class="pl-9"
                maxlength="6"
                @keyup.enter="handleLogin"
              />
            </div>
          </div>

          <!-- 登录主按钮 -->
          <div class="pt-1">
            <Button
              type="submit"
              class="w-full gap-2"
              :disabled="loading"
              @click.prevent="handleLogin"
            >
              <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
              <span>{{ loading ? '登录中...' : '立即登录' }}</span>
            </Button>
          </div>

          <!-- 分割线 -->
          <div class="relative my-3 text-center after:content-[''] after:absolute after:top-1/2 after:left-0 after:right-0 after:h-px after:bg-border">
            <span class="relative z-10 bg-card px-2 text-[11px] text-muted-foreground">
              或使用生物识别
            </span>
          </div>

          <!-- Passkey 登录按钮 -->
          <div>
            <Button
              type="button"
              variant="outline"
              class="w-full gap-2"
              :disabled="passkeyLoading"
              @click="handlePasskeyLogin"
            >
              <Loader2 v-if="passkeyLoading" class="h-4 w-4 animate-spin" />
              <Fingerprint v-else class="h-4 w-4" />
              <span>{{ passkeyLoading ? '验证中...' : 'Passkey 免密登录' }}</span>
            </Button>
          </div>
        </form>
      </div>
    </DialogContent>
  </Dialog>
</template>
