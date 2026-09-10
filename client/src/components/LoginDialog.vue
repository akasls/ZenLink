<script setup lang="ts">
import { ref, reactive, watch, nextTick } from 'vue';
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
import { User, Lock, Key, Fingerprint, Loader2, AlertCircle } from 'lucide-vue-next';

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
const generalError = ref('');
const errors = reactive<Record<string, string>>({});
const usernameInputRef = ref<any>(null);
const passwordInputRef = ref<any>(null);
const totpInputRef = ref<any>(null);

function resetForm() {
  form.username = '';
  form.password = '';
  form.totpCode = '';
  generalError.value = '';
  Object.keys(errors).forEach((key) => delete errors[key]);
}

watch(
  () => props.visible,
  (val) => {
    if (!val) resetForm();
  }
);

// 账号密码登录
async function handleLogin(e?: Event) {
  if (e) e.preventDefault();
  if (loading.value) return;
  generalError.value = '';
  Object.keys(errors).forEach((key) => delete errors[key]);

  // 兜底读取原生 DOM input 值（防止部分移动端如 iOS Safari 自动填充钥匙串时未触发 Vue v-model 事件）
  const domUser = usernameInputRef.value?.$el?.querySelector('input')?.value ?? usernameInputRef.value?.value ?? '';
  const domPass = passwordInputRef.value?.$el?.querySelector('input')?.value ?? passwordInputRef.value?.value ?? '';
  const u = (form.username || domUser).trim();
  const p = form.password || domPass;
  form.username = u;
  form.password = p;

  if (!u) {
    errors.username = '请输入用户名';
    generalError.value = '请输入用户名';
    toast.error('请输入用户名');
    return;
  }
  if (!p) {
    errors.password = '请输入密码';
    generalError.value = '请输入密码';
    toast.error('请输入密码');
    return;
  }

  const cleanTotp = form.totpCode ? form.totpCode.replace(/\D/g, '').slice(0, 6) : undefined;

  loading.value = true;
  try {
    const result = await authStore.login(
      u,
      p,
      cleanTotp
    );

    if (result.requireTotp) {
      errors.totp = '该账户已开启两步验证，请输入 6 位 TOTP 动态码';
      generalError.value = '该账户已开启两步验证，请输入 6 位动态验证码';
      toast.warning('该账户已开启两步验证，请输入 6 位动态验证码');
      nextTick(() => {
        const el = totpInputRef.value?.$el || totpInputRef.value;
        if (el?.focus) el.focus();
        else if (el?.querySelector) el.querySelector('input')?.focus();
      });
    } else {
      toast.success('登录成功，欢迎回来');
      await authStore.fetchUser();
      emit('update:visible', false);
      emit('success', props.targetView);
    }
  } catch (err: any) {
    const message = err.response?.data?.error || err.message || '登录失败，请检查网络或账号密码';
    generalError.value = message;
    toast.error(message);
  } finally {
    loading.value = false;
  }
}

// Passkey 免密登录
async function handlePasskeyLogin() {
  generalError.value = '';
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
    generalError.value = message;
    toast.error(message);
  } finally {
    passkeyLoading.value = false;
  }
}
</script>

<template>
  <Dialog :open="visible" @update:open="emit('update:visible', $event)">
    <DialogContent class="w-[calc(100%-2.5rem)] max-w-[380px] sm:w-full sm:max-w-[380px]">
      <DialogHeader>
        <DialogTitle>登录后台</DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground leading-relaxed">
          {{ targetView ? '该功能需要管理员权限，请先登录' : '登录以管理书签、在线笔记与 AI 助手' }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col pt-1">
        <!-- 错误提示横幅 (确保移动端或无 Toast 情况下清晰可见) -->
        <div
          v-if="generalError"
          class="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 mb-3.5 animate-in fade-in duration-200"
        >
          <AlertCircle class="h-4 w-4 shrink-0" />
          <span class="leading-tight">{{ generalError }}</span>
        </div>

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
                ref="usernameInputRef"
                v-model="form.username"
                placeholder="请输入管理员用户名"
                class="pl-9"
                autofocus
                autocomplete="username"
                @input="generalError = ''"
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
                ref="passwordInputRef"
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                class="pl-9"
                autocomplete="current-password"
                @input="generalError = ''"
                @keyup.enter="handleLogin"
              />
            </div>
          </div>

          <!-- 2FA TOTP 动态码 -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground/80 flex justify-between">
              <span>两步验证码 (未启用可留空)</span>
              <span v-if="errors.totp" class="text-destructive text-xs font-medium">{{ errors.totp }}</span>
            </label>
            <div class="relative">
              <Key class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref="totpInputRef"
                v-model="form.totpCode"
                placeholder="6 位动态验证码"
                inputmode="numeric"
                autocomplete="one-time-code"
                class="pl-9 font-mono tracking-wider"
                @input="form.totpCode = form.totpCode.replace(/\D/g, '').slice(0, 6); generalError = ''"
              />
            </div>
          </div>

          <!-- 登录主按钮 -->
          <div class="pt-1">
            <Button
              type="submit"
              class="w-full gap-2 cursor-pointer touch-manipulation"
              :disabled="loading"
              @click="handleLogin"
            >
              <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
              <span>{{ loading ? '登录中...' : '立即登录' }}</span>
            </Button>
          </div>

          <!-- 分割线 -->
          <div class="relative my-3 text-center after:content-[''] after:absolute after:top-1/2 after:left-0 after:right-0 after:h-px after:bg-border">
            <span class="relative z-10 bg-background px-2 text-[11px] text-muted-foreground">
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
