<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api';
import { toast } from '@/components/ui/sonner';
import { startAuthentication } from '@simplewebauthn/browser';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { User, Lock, Key, Fingerprint, Loader2, AlertCircle } from 'lucide-vue-next';

const router = useRouter();
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

// 密码登录
async function handleLogin(e?: Event) {
  if (e) e.preventDefault();
  if (loading.value) return;
  generalError.value = '';
  Object.keys(errors).forEach((key) => delete errors[key]);

  // 兜底读取原生 DOM input 值（防止部分移动端如 iOS Safari 自动填充钥匙串未触发 Vue v-model 事件）
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
      router.push('/');
    }
  } catch (err: any) {
    const message = err.response?.data?.error || err.message || '登录失败，请检查网络或账号密码';
    generalError.value = message;
    toast.error(message);
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
    toast.success('通过 Passkey 验证登录成功');
    router.push('/');
  } catch (err: any) {
    const message = err.response?.data?.error || err.message || 'Passkey 登录失败';
    toast.error(message);
  } finally {
    passkeyLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4 py-8">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-6">
        <router-link to="/" class="inline-flex items-center gap-2 no-underline">
          <div class="w-10 h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center shadow font-bold text-base">
            <span>Z</span>
          </div>
        </router-link>
        <h1 class="text-lg font-semibold tracking-tight mt-3">登录 ZenLink</h1>
        <p class="text-xs text-muted-foreground mt-1">管理你的个人书签、笔记与 AI 助手</p>
      </div>

      <!-- 登录表单卡片 -->
      <Card class="shadow-sm border-border">
        <CardContent class="p-6">
          <!-- 错误提示横幅 (确保移动端或无 Toast 情况下清晰可见) -->
          <div
            v-if="generalError"
            class="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 mb-4 animate-in fade-in duration-200"
          >
            <AlertCircle class="h-4 w-4 shrink-0" />
            <span class="leading-tight">{{ generalError }}</span>
          </div>

          <form @submit.prevent="handleLogin" class="space-y-4">
            <div class="space-y-1.5">
              <label class="block text-xs font-medium text-foreground/80">用户名</label>
              <div class="relative">
                <User class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  ref="usernameInputRef"
                  v-model="form.username"
                  placeholder="请输入用户名"
                  class="pl-9"
                  autofocus
                  autocomplete="username"
                  @input="generalError = ''"
                  @keyup.enter="handleLogin"
                />
              </div>
              <p v-if="errors.username" class="text-xs text-destructive">{{ errors.username }}</p>
            </div>

            <div class="space-y-1.5">
              <label class="block text-xs font-medium text-foreground/80">密码</label>
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
              <p v-if="errors.password" class="text-xs text-destructive">{{ errors.password }}</p>
            </div>

            <!-- TOTP 输入框 -->
            <div class="space-y-1.5">
              <label class="block text-xs font-medium text-foreground/80">两步验证码 (未启用2FA可留空)</label>
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
              <p v-if="errors.totp" class="text-xs text-destructive font-medium">{{ errors.totp }}</p>
            </div>

            <Button
              type="submit"
              class="w-full gap-2 cursor-pointer touch-manipulation"
              :disabled="loading"
              @click="handleLogin"
            >
              <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
              <span>{{ loading ? '登录中...' : '立即登录' }}</span>
            </Button>

            <div class="relative my-3 text-center after:content-[''] after:absolute after:top-1/2 after:left-0 after:right-0 after:h-px after:bg-border">
              <span class="relative z-10 bg-card px-2 text-[11px] text-muted-foreground">
                或使用生物识别
              </span>
            </div>

            <!-- Passkey 登录 -->
            <Button
              type="button"
              variant="outline"
              class="w-full gap-2"
              :disabled="passkeyLoading"
              @click="handlePasskeyLogin"
            >
              <Loader2 v-if="passkeyLoading" class="h-4 w-4 animate-spin" />
              <Fingerprint v-else class="h-4 w-4" />
              <span>{{ passkeyLoading ? '验证中...' : '使用 Passkey 登录' }}</span>
            </Button>

            <p class="text-[11px] text-muted-foreground text-center mt-2 mb-0">
              支持指纹、Face ID 或 Windows Hello 硬件密钥
            </p>
          </form>
        </CardContent>
      </Card>

      <!-- 返回首页 -->
      <div class="text-center mt-4">
        <router-link to="/" class="text-xs text-muted-foreground hover:text-foreground no-underline transition-colors">
          ← 返回导航主页
        </router-link>
      </div>
    </div>
  </div>
</template>
