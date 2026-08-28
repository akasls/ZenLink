<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { shareApi } from '@/api';
import { ElMessage } from 'element-plus';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: true,
  gfm: true,
});

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

function renderMarkdown(content: string) {
  if (!content) return '';
  const rawHtml = marked.parse(content) as string;
  return DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });
}

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
    ElMessage.warning('请输入提取密码');
    return;
  }
  verifying.value = true;
  try {
    const { data } = await shareApi.verifyShare(code, password.value.trim());
    needPassword.value = false;
    shareItem.value = data.transfer;
    isBurned.value = !!data.is_burned;
    ElMessage.success('提取成功');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '提取密码错误');
  } finally {
    verifying.value = false;
  }
}

function copyContent(content: string) {
  navigator.clipboard.writeText(content);
  ElMessage.success('已复制到剪贴板');
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
  <div class="zenlink-share-page is-note-share">
    <div class="share-card-container note-card-container">
      <!-- 加载中 -->
      <div v-if="loading" class="share-loading-box">
        <el-icon class="is-loading text-2xl text-primary"><component is="Loading" /></el-icon>
        <p class="mt-3 text-sm text-muted">正在检索分享内容...</p>
      </div>

      <!-- 错误/已失效提示 -->
      <div v-else-if="errorMsg" class="share-error-box">
        <div class="error-icon">⚠️</div>
        <h3>无法访问此分享</h3>
        <p>{{ errorMsg }}</p>
        <button class="share-action-btn primary mt-4" @click="router.push('/')">
          前往 ZenLink 主页
        </button>
      </div>

      <!-- 密码保护解锁表单 -->
      <div v-else-if="needPassword" class="share-unlock-box">
        <div class="lock-icon">🔒</div>
        <h3>该分享已设置访问密码</h3>
        <p class="text-xs text-muted mb-4">请输入提取码以解锁内容</p>

        <form class="unlock-form" @submit.prevent="handleUnlock">
          <input
            v-model="password"
            type="password"
            placeholder="请输入提取密码"
            class="unlock-input"
            autofocus
          />
          <button type="submit" class="share-action-btn primary w-full mt-3" :disabled="verifying">
            <el-icon v-if="verifying" class="is-loading mr-1"><component is="Loading" /></el-icon>
            <span>{{ verifying ? '验证中...' : '提取笔记 / 查看内容' }}</span>
          </button>
        </form>
      </div>

      <!-- 成功展示内容 -->
      <div v-else-if="shareItem" class="share-content-box">
        <!-- 阅后即焚警告条 -->
        <div v-if="isBurned" class="burn-warning-bar mb-4">
          <el-icon class="mr-1"><component is="Warning" /></el-icon>
          <span>此为【阅后即焚】分享，页面关闭后将自动销毁无法再次访问！</span>
        </div>

        <!-- 笔记分享视图 (标题 时间 在左，ZenLink 笔记分享 在右，正文在下) -->
        <div class="share-note-layout">
          <div class="share-note-header-bar">
            <div class="note-header-left">
              <h1 class="note-title-heading">{{ shareItem.title || '未命名笔记' }}</h1>
              <span class="note-time-sub">{{ formatTime(shareItem.created_at) }}</span>
            </div>
            <div class="note-header-right">
              <div class="brand-right-title">
                <span class="brand-logo-small">🔗</span>
                <span class="font-semibold">ZenLink 笔记分享</span>
              </div>
              <p class="brand-slogan-small">跨端加密同步 · 安全阅后即焚</p>
            </div>
          </div>

          <!-- 文章正文 Markdown 渲染 -->
          <div class="share-note-article-body">
            <div class="ai-markdown-body" v-html="renderMarkdown(shareItem.content || '')" />
          </div>

          <!-- 底部操作按钮 -->
          <div class="share-footer-actions mt-8">
            <button
              type="button"
              class="share-action-btn secondary"
              @click="copyContent(shareItem.content || '')"
            >
              <el-icon class="mr-1"><component is="CopyDocument" /></el-icon> 复制 Markdown 正文
            </button>
            <button
              type="button"
              class="share-action-btn primary"
              @click="router.push('/')"
            >
              前往 ZenLink
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

