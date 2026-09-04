<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { shareApi } from '@/api';
import { toast } from '@/components/ui/sonner';
import { renderMarkdown, handleCodeCopyClick } from '@/utils/markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertTriangle, Lock, Copy } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const code = route.params.code as string;
const loading = ref(true);
const verifying = ref(false);
const errorMsg = ref('');
const needPassword = ref(false);
const password = ref('');
const isBurned = ref(false);

interface ShareItem {
  id: number;
  type: string;
  title?: string | null;
  content: string | null;
  tags?: string[];
  created_at: string;
}

const shareItem = ref<ShareItem | null>(null);

async function loadShare() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const { data } = await shareApi.getShare(code);
    if (data.need_password) {
      needPassword.value = true;
      shareItem.value = {
        id: 0,
        type: data.type || 'note',
        title: data.title || '受保护的笔记',
        content: null,
        created_at: '',
      };
    } else {
      needPassword.value = false;
      shareItem.value = data.transfer;
      isBurned.value = !!data.is_burned;
    }
  } catch (err: any) {
    errorMsg.value = err.response?.data?.error || '分享链接已失效或已被阅后即焚';
  } finally {
    loading.value = false;
  }
}

async function handleUnlock() {
  if (!password.value.trim()) {
    toast.warning('请输入提取密码');
    return;
  }
  verifying.value = true;
  try {
    const { data } = await shareApi.verifyShare(code, password.value.trim());
    needPassword.value = false;
    shareItem.value = data.transfer;
    isBurned.value = !!data.is_burned;
    toast.success('提取成功');
  } catch (err: any) {
    toast.error(err.response?.data?.error || '提取密码错误');
  } finally {
    verifying.value = false;
  }
}

function copyContent(content: string) {
  navigator.clipboard.writeText(content);
  toast.success('已复制到剪贴板');
}

function formatTime(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

onMounted(() => {
  loadShare();
});
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-primary/10">
    <Card class="w-full max-w-3xl border-border shadow-sm">
      <CardContent class="p-5 sm:p-7">
        <!-- 加载中 -->
        <div v-if="loading" class="py-16 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 class="h-7 w-7 animate-spin mb-2 text-primary" />
          <p class="text-xs text-muted-foreground m-0">正在检索分享内容...</p>
        </div>

        <!-- 错误/已失效提示 -->
        <div v-else-if="errorMsg" class="py-12 flex flex-col items-center justify-center text-center">
          <div class="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-3">
            <AlertTriangle class="h-5 w-5" />
          </div>
          <h3 class="text-sm font-semibold text-foreground m-0 mb-1">无法访问此分享</h3>
          <p class="text-xs text-muted-foreground m-0 mb-4 max-w-md">{{ errorMsg }}</p>
          <Button size="sm" @click="router.push('/')">
            前往 ZenLink 主页
          </Button>
        </div>

        <!-- 密码保护解锁表单 -->
        <div v-else-if="needPassword" class="py-10 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
          <div class="w-10 h-10 rounded-full bg-muted text-foreground flex items-center justify-center mb-3">
            <Lock class="h-5 w-5" />
          </div>
          <h3 class="text-sm font-semibold text-foreground m-0 mb-1">该分享已设置访问密码</h3>
          <p class="text-xs text-muted-foreground m-0 mb-4">请输入提取码以解锁内容</p>

          <form class="w-full space-y-3" @submit.prevent="handleUnlock">
            <Input
              v-model="password"
              type="password"
              placeholder="请输入提取密码"
              autofocus
            />
            <Button
              type="submit"
              class="w-full gap-2"
              :disabled="verifying"
            >
              <Loader2 v-if="verifying" class="h-4 w-4 animate-spin" />
              <span>{{ verifying ? '验证中...' : '提取笔记 / 查看内容' }}</span>
            </Button>
          </form>
        </div>

        <!-- 成功展示内容 -->
        <div v-else-if="shareItem" class="flex flex-col">
          <!-- 阅后即焚警告条 -->
          <div v-if="isBurned" class="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle class="h-4 w-4 shrink-0" />
            <span>此为【阅后即焚】分享，页面关闭后将自动销毁无法再次访问！</span>
          </div>

          <!-- 笔记分享视图 -->
          <div class="flex flex-col">
            <div class="flex items-start justify-between pb-3 border-b border-border">
              <div>
                <h1 class="text-base font-semibold text-foreground m-0 leading-snug">
                  {{ shareItem.title || '未命名笔记' }}
                </h1>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-[11px] font-mono text-muted-foreground">{{ formatTime(shareItem.created_at) }}</span>

                  <!-- 复制全文图标按钮 -->
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-foreground"
                    title="复制笔记全文"
                    @click="copyContent(shareItem.content || '')"
                  >
                    <Copy class="h-3.5 w-3.5" />
                  </Button>

                  <!-- GitHub 项目链接图标 -->
                  <Button as-child variant="ghost" size="icon-xs" class="text-muted-foreground hover:text-foreground">
                    <a
                      href="https://github.com/akasls/ZenLink"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="GitHub 项目主页"
                    >
                      <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <!-- 文章正文 Markdown 渲染 -->
            <div class="mt-4" @click="handleCodeCopyClick">
              <div class="ai-markdown-body" v-html="renderMarkdown(shareItem.content || '')" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
