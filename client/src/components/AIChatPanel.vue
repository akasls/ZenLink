<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { aiApi, noteApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { ElMessage, ElMessageBox } from 'element-plus';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const props = defineProps<{
  active?: boolean;
}>();

const authStore = useAuthStore();

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
function handleResize() { isMobile.value = window.innerWidth < 768; }

// ==================== 1. 极简轻量 Marked 渲染器 (淡灰色代码框 + 右上角悬浮复制图标，不占用独占行高) ====================
const renderer = new marked.Renderer();

renderer.code = function (token: any) {
  const code = typeof token === 'object' && token !== null && 'text' in token ? token.text : (token || '');
  const lang = (typeof token === 'object' && token !== null && 'lang' in token ? token.lang : '') || '';
  const language = (lang || 'text').toLowerCase().trim();

  const escapedCode = String(code)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const encodedCode = encodeURIComponent(String(code));

  return `
    <div class="code-block-wrapper">
      <button type="button" class="code-floating-copy-btn" data-code="${encodedCode}" title="复制代码">
        <svg class="copy-svg" viewBox="0 0 1024 1024" width="14" height="14">
          <path fill="currentColor" d="M768 832a128 128 0 0 1-128 128H192A128 128 0 0 1 64 832V384a128 128 0 0 1 128-128v64a64 64 0 0 0-64 64v448a64 64 0 0 0 64 64h448a64 64 0 0 0 64-64h64z"/>
          <path fill="currentColor" d="M384 128a64 64 0 0 0-64 64v448a64 64 0 0 0 64 64h448a64 64 0 0 0 64-64V192a64 64 0 0 0-64-64H384zm0-64h448a128 128 0 0 1 128 128v448a128 128 0 0 1-128 128H384a128 128 0 0 1-128-128V192A128 128 0 0 1 384 64z"/>
        </svg>
      </button>
      <pre class="code-pre-surface"><code class="language-${language}">${escapedCode}</code></pre>
    </div>
  `;
};

marked.setOptions({
  breaks: true,
  gfm: true,
  renderer,
});

interface Message {
  id?: number | string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  model: string;
  role_id?: string;
  created_at: string;
  updated_at: string;
}

interface Attachment {
  name: string;
  url: string;
  size: number;
  isImage: boolean;
}

interface RolePreset {
  id: string;
  name: string;
  icon: string;
  prompt: string;
  isCustom?: boolean;
}

// 预设角色列表
const defaultRoles: RolePreset[] = [
  { id: 'default', name: '默认助手', icon: '🤖', prompt: '你是一个知识渊博、高效简洁的智能全能助理。逻辑清晰、答复专业。' },
  { id: 'coder', name: '代码专家', icon: '💻', prompt: '你是一个资深全栈工程师与架构师。擅长编写优雅健壮的代码、解答技术难题、重构代码并给出清晰的实现与解释。' },
  { id: 'writer', name: '文案大师', icon: '✍️', prompt: '你是一位精通文字排版与修辞的资深文案作家。擅长润色文章、创作引人入胜的标题、撰写结构清晰的文案。' },
  { id: 'translator', name: '专业翻译', icon: '🌐', prompt: '你是一个精通多语言的专业翻译官。翻译地道自然，符合目标语言文化习惯，精准保留专业术语。' },
  { id: 'analyst', name: '深度推理', icon: '🧠', prompt: '你是一个严谨的逻辑分析专家。请分步推理、条理分明地拆解问题，深入剖析核心逻辑并给出结构化结论。' },
];

const roles = ref<RolePreset[]>([...defaultRoles]);
const selectedRoleId = ref<string>('default');
const mobileChapterPopoverVisible = ref(false);
const roleSearchQuery = ref('');
const filteredRoles = computed(() => {
  if (!roleSearchQuery.value.trim()) return roles.value;
  const q = roleSearchQuery.value.trim().toLowerCase();
  return roles.value.filter(r => r.name.toLowerCase().includes(q) || r.prompt.toLowerCase().includes(q));
});
function deleteRole(id: string, e?: Event) {
  deleteCustomRole(id, e);
}

function getRoleIcon(roleId?: string): string {
  if (!roleId || roleId === 'default') return '🤖';
  const r = roles.value.find(item => item.id === roleId);
  return r?.icon || '🤖';
}

function selectRole(r: RolePreset) {
  selectedRoleId.value = r.id;
  rolePopoverVisible.value = false;
  if (activeConversationId.value) {
    aiApi.updateConversation(activeConversationId.value, { role_id: r.id }).catch(() => {});
    const cur = conversations.value.find(c => c.id === activeConversationId.value);
    if (cur) cur.role_id = r.id;
  }
  ElMessage.success('已应用角色「' + r.name + '」');
}

function loadCustomRoles() {
  try {
    const saved = localStorage.getItem('zenlink_ai_roles');
    if (saved) {
      const customList: RolePreset[] = JSON.parse(saved);
      roles.value = [...defaultRoles, ...customList];
    } else {
      roles.value = [...defaultRoles];
    }
  } catch {
    roles.value = [...defaultRoles];
  }
}

const currentRole = computed<RolePreset>(() => {
  return roles.value.find(r => r.id === selectedRoleId.value) || roles.value[0] || defaultRoles[0];
});

// 自定义角色弹窗状态
const showRoleModal = ref(false);
const isEditingExistingRole = ref(false);
const editingRole = ref<{ id: string; name: string; icon: string; prompt: string; isCustom?: boolean }>({
  id: '',
  name: '',
  icon: '⚡',
  prompt: '',
  isCustom: true,
});

function openAddRoleModal() {
  isEditingExistingRole.value = false;
  editingRole.value = {
    id: 'custom_' + Date.now(),
    name: '',
    icon: '⚡',
    prompt: '',
    isCustom: true,
  };
  showRoleModal.value = true;
}

function openEditRoleModal(role: RolePreset, e?: Event) {
  e?.stopPropagation();
  isEditingExistingRole.value = true;
  editingRole.value = { ...role };
  showRoleModal.value = true;
}

function saveCustomRole() {
  if (!editingRole.value.name.trim()) {
    ElMessage.warning('请输入角色名称');
    return;
  }
  if (!editingRole.value.prompt.trim()) {
    ElMessage.warning('请输入角色的提示词');
    return;
  }

  const customOnly = roles.value.filter(r => r.isCustom);
  const existingIdx = customOnly.findIndex(r => r.id === editingRole.value.id);
  
  if (existingIdx !== -1) {
    customOnly[existingIdx] = { ...editingRole.value, isCustom: true };
  } else {
    const isDefault = defaultRoles.some(d => d.id === editingRole.value.id);
    if (isDefault) {
      const newId = 'custom_' + Date.now();
      customOnly.push({ ...editingRole.value, id: newId, isCustom: true });
      editingRole.value.id = newId;
    } else {
      customOnly.push({ ...editingRole.value, isCustom: true });
    }
  }

  localStorage.setItem('zenlink_ai_roles', JSON.stringify(customOnly));
  loadCustomRoles();
  selectedRoleId.value = editingRole.value.id;
  showRoleModal.value = false;
  ElMessage.success(`已保存角色「${editingRole.value.name}」`);
}

function deleteCustomRole(roleId: string, e?: Event) {
  e?.stopPropagation();
  const customOnly = roles.value.filter(r => r.isCustom && r.id !== roleId);
  localStorage.setItem('zenlink_ai_roles', JSON.stringify(customOnly));
  if (selectedRoleId.value === roleId) {
    selectedRoleId.value = 'default';
  }
  loadCustomRoles();
  ElMessage.success('已删除角色');
}

// 会话与消息状态
const conversations = ref<Conversation[]>([]);
const activeConversationId = ref<string>('');
const messages = ref<Message[]>([]);
const inputPrompt = ref('');
const isStreaming = ref(false);
const loadingHistory = ref(false);

// 对话搜索与重命名
const convSearchQuery = ref('');
const convPopoverVisible = ref(false);
const rolePopoverVisible = ref(false);
const editingConvId = ref<string>('');
const editingConvTitle = ref<string>('');

const filteredConversations = computed(() => {
  if (!convSearchQuery.value.trim()) return conversations.value;
  const q = convSearchQuery.value.trim().toLowerCase();
  return conversations.value.filter(c => c.title.toLowerCase().includes(q));
});

// 编辑历史消息状态 (点击编辑后将内容放入底部编辑框)
const editingMsgIndex = ref<number | null>(null);

// 长消息折叠/展开映射表
const expandedMsgMap = ref<Record<number, boolean>>({});

function isLongMessage(text: string): boolean {
  if (!text) return false;
  return text.length > 200 || text.split('\n').length > 5;
}

function toggleMsgExpand(idx: number) {
  expandedMsgMap.value[idx] = !expandedMsgMap.value[idx];
}

// 顶栏动态标题
const currentConversationTitle = computed(() => {
  if (messages.value.length === 0 || !activeConversationId.value) {
    return '新对话';
  }
  const current = conversations.value.find(c => c.id === activeConversationId.value);
  if (current && current.title && current.title !== '新对话') {
    return current.title;
  }
  if (messages.value.length > 0) {
    const firstUserMsg = messages.value.find(m => m.role === 'user');
    if (firstUserMsg) {
      const summary = firstUserMsg.content.slice(0, 18).replace(/[\r\n]/g, ' ');
      return summary || '新对话';
    }
  }
  return '新对话';
});

// DOM 引用
const chatContainerRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

let shouldAutoScroll = true;
let currentAbortController: AbortController | null = null;

// ==================== 2. 下滑到底部按钮状态 ====================
const showScrollBottomBtn = ref(false);

function onChatScroll() {
  if (!chatContainerRef.value) return;
  const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.value;
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;
  shouldAutoScroll = distanceToBottom < 120;
  showScrollBottomBtn.value = distanceToBottom > 200;
  updateActiveChapterOnScroll();
}

function scrollToBottom(force = false) {
  nextTick(() => {
    if (chatContainerRef.value && (force || shouldAutoScroll)) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
    }
  });
}

function scrollToBottomSmooth() {
  if (!chatContainerRef.value) return;
  chatContainerRef.value.scrollTo({
    top: chatContainerRef.value.scrollHeight,
    behavior: 'smooth',
  });
  showScrollBottomBtn.value = false;
}

function stopGenerating() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  isStreaming.value = false;
}

// 附件管理
const attachments = ref<Attachment[]>([]);
const uploadingAttachment = ref(false);

// 模型选择 Popover 与状态
const modelPopoverVisible = ref(false);
const modelSearchQuery = ref('');
const selectedModel = ref('');
const modelOptions = ref<string[]>([]);

const filteredModelOptions = computed(() => {
  if (!modelSearchQuery.value.trim()) return modelOptions.value;
  const q = modelSearchQuery.value.trim().toLowerCase();
  return modelOptions.value.filter(m => m.toLowerCase().includes(q));
});

// ==================== 3. 专属模型与推理参数设置弹窗 ====================

const aiSettings = ref({
  model: 'deepseek-chat',
  system_prompt: '你是一个知识渊博、高效简洁的智能全能助理。',
  temperature: 0.7,
  top_p: 0.95,
  max_tokens: 4096,
  reasoning_mode: false,
});
// ==================== 4. 左侧仅显示用户发送消息的小横条指示器 ====================
const userQuestions = computed(() => {
  return messages.value
    .map((msg, index) => ({ msg, index }))
    .filter(item => item.msg.role === 'user');
});

const activeChapterMsgIndex = ref<number | null>(null);

function jumpToMessage(msgIndex: number) {
  activeChapterMsgIndex.value = msgIndex;
  const targetId = `msg-row-${msgIndex}`;
  const el = document.getElementById(targetId);
  if (el && chatContainerRef.value) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('jump-highlight');
    setTimeout(() => el.classList.remove('jump-highlight'), 1800);
  }
}

function updateActiveChapterOnScroll() {
  if (!chatContainerRef.value || userQuestions.value.length === 0) return;
  const containerTop = chatContainerRef.value.getBoundingClientRect().top;
  
  let closestIndex = 0;
  let minDiff = Infinity;

  userQuestions.value.forEach((item) => {
    const el = document.getElementById(`msg-row-${item.index}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const diff = Math.abs(rect.top - containerTop - 40);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = item.index;
      }
    }
  });

  activeChapterMsgIndex.value = closestIndex;
}

async function loadAiSettings() {
  try {
    const { data } = await aiApi.getSettings();
    if (data && data.settings) {
      let models: string[] = [];
      if (data.settings.available_models) {
        models = Array.isArray(data.settings.available_models)
          ? data.settings.available_models
          : JSON.parse(data.settings.available_models);
      }
      if (!models || models.length === 0) {
        if (data.settings.model) models = [data.settings.model];
      }
      modelOptions.value = models;
      if (!selectedModel.value || !models.includes(selectedModel.value)) {
        selectedModel.value = data.settings.model || models[0] || '';
      }
      aiSettings.value.model = data.settings.model || 'deepseek-chat';
      aiSettings.value.system_prompt = data.settings.system_prompt || '你是一个知识渊博、高效简洁的智能全能助理。';
      if (data.settings.temperature !== undefined) aiSettings.value.temperature = Number(data.settings.temperature);
      if (data.settings.top_p !== undefined) aiSettings.value.top_p = Number(data.settings.top_p);
      if (data.settings.max_tokens !== undefined) aiSettings.value.max_tokens = Number(data.settings.max_tokens);
      if (data.settings.reasoning_mode !== undefined) aiSettings.value.reasoning_mode = data.settings.reasoning_mode === true || data.settings.reasoning_mode === 'true';
    } else {
      modelOptions.value = [];
      selectedModel.value = '';
    }
  } catch (e) {
    console.error('加载 AI 设置失败', e);
    modelOptions.value = [];
    selectedModel.value = '';
  }
}

async function loadConversations(autoSelect = true) {
  try {
    const { data } = await aiApi.getConversations();
    conversations.value = data.conversations || [];
    if (autoSelect && conversations.value.length > 0 && !activeConversationId.value && !isStreaming.value) {
      selectConversation(conversations.value[0].id);
    }
  } catch (e) {
    console.error('加载会话失败', e);
  }
}

async function selectConversation(id: string) {
  if (isStreaming.value) {
    stopGenerating();
  }
  if (editingConvId.value) {
    cancelEditTitle();
  }
  cancelEditingMsg();
  convPopoverVisible.value = false;
  activeConversationId.value = id;

  // 记忆并恢复该会话绑定的专属角色
  const conv = conversations.value.find(c => c.id === id);
  if (conv && conv.role_id) {
    selectedRoleId.value = conv.role_id;
  } else {
    selectedRoleId.value = 'default';
  }

  loadingHistory.value = true;
  try {
    const { data } = await aiApi.getMessages(id);
    messages.value = data.messages || [];
    scrollToBottom(true);
  } catch (e) {
    console.error('加载消息历史失败', e);
  } finally {
    loadingHistory.value = false;
  }
}

async function createNewConversation() {
  if (isStreaming.value) {
    stopGenerating();
  }
  cancelEditingMsg();
  convPopoverVisible.value = false;
  if (messages.value.length === 0) {
    nextTick(() => textareaRef.value?.focus());
    return;
  }

  activeConversationId.value = '';
  messages.value = [];
  attachments.value = [];
  selectedRoleId.value = 'default';
  expandedMsgMap.value = {};
  nextTick(() => textareaRef.value?.focus());
}

function startEditTitle(conv: Conversation) {
  editingConvId.value = conv.id;
  editingConvTitle.value = conv.title;
  nextTick(() => {
    const input = document.querySelector('.conv-title-input') as HTMLInputElement;
    input?.focus();
    input?.select();
  });
}

function cancelEditTitle() {
  editingConvId.value = '';
  editingConvTitle.value = '';
}

async function saveEditTitle(conv: Conversation) {
  const newTitle = editingConvTitle.value.trim();
  if (!newTitle || newTitle === conv.title) {
    cancelEditTitle();
    return;
  }
  try {
    await aiApi.updateConversation(conv.id, { title: newTitle });
    conv.title = newTitle;
    ElMessage.success('已更新会话名称');
  } catch {
    ElMessage.error('更新标题失败');
  } finally {
    cancelEditTitle();
  }
}

async function deleteConversation(id: string, e?: Event) {
  e?.stopPropagation();
  const conv = conversations.value.find(c => c.id === id);
  const convTitle = conv ? `「${conv.title}」` : '此会话';
  try {
    await ElMessageBox.confirm(`确定要删除 ${convTitle} 吗？删除后不可恢复。`, '删除会话', {
      type: 'warning',
      customClass: 'zenlink-custom-dialog',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    });
    await aiApi.deleteConversation(id);
    conversations.value = conversations.value.filter(c => c.id !== id);
    if (activeConversationId.value === id) {
      if (conversations.value.length > 0) {
        selectConversation(conversations.value[0].id);
      } else {
        activeConversationId.value = '';
        messages.value = [];
      }
    }
    ElMessage.success('已删除会话');
  } catch {}
}

async function clearAllConversations() {
  try {
    await ElMessageBox.confirm('确定要清空全部 AI 对话历史吗？此操作无法撤销。', '清空历史', {
      type: 'warning',
      customClass: 'zenlink-custom-dialog',
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    });
    await aiApi.clearConversations();
    conversations.value = [];
    activeConversationId.value = '';
    messages.value = [];
    convPopoverVisible.value = false;
    ElMessage.success('已清空所有对话');
  } catch {}
}

function selectModelOption(m: string) {
  selectedModel.value = m;
  modelPopoverVisible.value = false;
  ElMessage.success(`已切换模型为「${m}」`);
}

function setDefaultModel() {
  if (selectedModel.value) {
    ElMessage.success(`已将「${selectedModel.value}」设为默认模型`);
  } else {
    ElMessage.warning('当前无可用模型');
  }
  modelPopoverVisible.value = false;
}

// 附件上传
async function uploadAttachment(file: File) {
  uploadingAttachment.value = true;
  try {
    const { data } = await noteApi.uploadAttachment(file);
    const f = data.file;
    attachments.value.push({
      name: f?.fileName || file.name,
      url: f?.url || '',
      size: f?.size || file.size,
      isImage: file.type.startsWith('image/'),
    });
    ElMessage.success(`已附加「${file.name}」`);
  } catch {
    ElMessage.error('附件上传失败');
  } finally {
    uploadingAttachment.value = false;
  }
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    uploadAttachment(file);
    target.value = '';
  }
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        uploadAttachment(file);
        return;
      }
    }
  }
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1);
}

// ==================== 5. 消息编辑 (将历史提问调入底部输入框进行编辑与重发) ====================
function startEditMsg(index: number, msg: Message) {
  editingMsgIndex.value = index;
  inputPrompt.value = msg.content;
  nextTick(() => {
    textareaRef.value?.focus();
    scrollToBottomSmooth();
  });
  ElMessage.info(`已将提问 #${index + 1} 载入下方编辑框`);
}

function cancelEditingMsg() {
  editingMsgIndex.value = null;
  inputPrompt.value = '';
}

// 删除指定消息
async function deleteMessage(index: number) {
  const msg = messages.value[index];
  try {
    await ElMessageBox.confirm('确定要删除这条消息吗？', '删除消息', {
      type: 'warning',
      customClass: 'zenlink-custom-dialog',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    });

    if (msg && msg.id) {
      await aiApi.deleteMessage(msg.id).catch(() => {});
    }

    if (msg.role === 'user' && messages.value[index + 1]?.role === 'assistant') {
      const nextMsg = messages.value[index + 1];
      if (nextMsg?.id) {
        await aiApi.deleteMessage(nextMsg.id).catch(() => {});
      }
      messages.value.splice(index, 2);
    } else {
      messages.value.splice(index, 1);
    }

    ElMessage.success('已删除消息');
  } catch {}
}

// ==================== 6. 发送消息与流式响应 ====================
async function sendMessage(customText?: string) {
  let userDisplayText = (customText || inputPrompt.value).trim();
  if ((!userDisplayText && attachments.value.length === 0) || isStreaming.value) return;

  // 如果是在编辑历史提问，从此处截断后续回复
  if (editingMsgIndex.value !== null && customText === undefined) {
    const editIdx = editingMsgIndex.value;
    editingMsgIndex.value = null;
    const deleteCount = messages.value.length - editIdx;
    messages.value.splice(editIdx, deleteCount);
  }

  if (attachments.value.length > 0) {
    const attachTexts = attachments.value.map(att => {
      if (att.isImage) return `![${att.name}](${att.url})`;
      return `[📎 附件: ${att.name}](${att.url})`;
    }).join('\n');

    userDisplayText = userDisplayText ? `${attachTexts}\n\n${userDisplayText}` : attachTexts;
    attachments.value = [];
  }

  inputPrompt.value = '';

  const promptSummary = userDisplayText.slice(0, 16).replace(/[\r\n]/g, ' ') || '新对话';

  messages.value.push({
    role: 'user',
    content: userDisplayText,
    created_at: new Date().toISOString(),
  });
  scrollToBottom(true);

  const assistantMsgIndex = messages.value.length;
  messages.value.push({
    role: 'assistant',
    content: '',
    created_at: new Date().toISOString(),
  });
  isStreaming.value = true;
  shouldAutoScroll = true;
  scrollToBottom(true);

  currentAbortController = new AbortController();

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      signal: currentAbortController.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: localStorage.getItem('zenlink_token') ? `Bearer ${localStorage.getItem('zenlink_token')}` : '',
      },
      body: JSON.stringify({
        conversation_id: activeConversationId.value || undefined,
        message: userDisplayText,
        model: selectedModel.value || undefined,
        role_id: selectedRoleId.value || 'default',
        custom_prompt: currentRole.value.prompt || undefined,
        temperature: aiSettings.value.temperature,
        top_p: aiSettings.value.top_p,
        max_tokens: aiSettings.value.max_tokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      messages.value[assistantMsgIndex].content = `请求失败: ${errText} (请在系统设置中配置 API Key)`;
      isStreaming.value = false;
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    if (reader) {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.conversation_id && !activeConversationId.value) {
              activeConversationId.value = parsed.conversation_id;
              aiApi.updateConversation(parsed.conversation_id, { title: promptSummary, role_id: selectedRoleId.value }).catch(() => {});
              loadConversations(false);
            }
            if (parsed.text) {
              messages.value[assistantMsgIndex].content += parsed.text;
              scrollToBottom();
            }
          } catch {}
        }
      }
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      messages.value[assistantMsgIndex].content = `连接异常: ${e.message || '请检查网络或配置'}`;
    }
  } finally {
    isStreaming.value = false;
    currentAbortController = null;
    scrollToBottom();
    loadConversations(false);
  }
}

// 重新生成指定消息
function regenerateMessage(assistantIndex: number) {
  if (isStreaming.value) return;
  const prevUserMsg = messages.value[assistantIndex - 1];
  if (prevUserMsg && prevUserMsg.role === 'user') {
    messages.value.splice(assistantIndex, 1);
    const userText = prevUserMsg.content;
    messages.value.splice(assistantIndex - 1, 1);
    sendMessage(userText);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function copyMessage(content: string) {
  navigator.clipboard.writeText(content);
  ElMessage.success('已复制内容');
}

function renderMarkdown(content: string): string {
  if (!content) return '';
  const rawHtml = marked.parse(content) as string;
  return DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target', 'data-code'] });
}

// ==================== 7. 代码框复制按钮事件代理 ====================
function handleChatContainerClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const copyBtn = target.closest('.code-floating-copy-btn') as HTMLElement;
  if (copyBtn) {
    e.stopPropagation();
    const encoded = copyBtn.getAttribute('data-code');
    if (encoded) {
      const rawCode = decodeURIComponent(encoded);
      navigator.clipboard.writeText(rawCode).then(() => {
        copyBtn.classList.add('copied');
        ElMessage.success('代码已复制');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
        }, 1800);
      }).catch(() => {
        ElMessage.error('复制失败');
      });
    }
  }
}

watch(
  [() => props.active, () => authStore.isLoggedIn],
  ([isActive, isLoggedIn]) => {
    if (isActive && isLoggedIn) {
      loadAiSettings();
      loadConversations();
      loadCustomRoles();
      }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('resize', handleResize);
  if (authStore.isLoggedIn) {
    loadAiSettings();
    loadConversations();
    loadCustomRoles();
  }
});

watch(
  () => props.active,
  (isActive) => {
    if (isActive && authStore.isLoggedIn) {
      loadAiSettings();
      loadConversations();
      loadCustomRoles();
    }
  }
);

watch(
  () => authStore.isLoggedIn,
  (isLogged) => {
    if (isLogged) {
      loadAiSettings();
      loadConversations();
      loadCustomRoles();
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  stopGenerating();
});
</script>

<template>
  <div class="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 selection:bg-indigo-500/10">
    <!-- 1. 顶栏 -->
    <div class="h-12 px-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between flex-shrink-0 sticky top-0 z-20">
      <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
        <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" :title="currentConversationTitle">
          {{ currentConversationTitle }}
        </span>
      </div>

      <div class="flex-shrink-0 flex items-center gap-1.5">
        <!-- 移动端章节跳转 Popover -->
        <el-popover
          v-if="userQuestions.length >= 2"
          v-model:visible="mobileChapterPopoverVisible"
          trigger="click"
          placement="bottom-end"
          :width="240"
          popper-class="!p-2 !bg-white dark:!bg-slate-900 !border-slate-200/80 dark:!border-slate-800 !rounded-lg !shadow-lg"
          :show-arrow="false"
        >
          <template #reference>
            <button
              type="button"
              class="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-300 md:hidden flex items-center gap-1 cursor-pointer"
              title="快速跳转历史提问"
            >
              <el-icon class="text-xs"><component is="Tickets" /></el-icon>
              <span>章节 ({{ userQuestions.length }})</span>
            </button>
          </template>

          <div class="space-y-1">
            <div class="text-xs font-semibold text-slate-400 px-1 pb-1 border-b border-slate-100 dark:border-slate-800">
              提问列表
            </div>
            <div class="max-h-48 overflow-y-auto space-y-0.5">
              <div
                v-for="(item, qIdx) in userQuestions"
                :key="'mq-' + item.index"
                class="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                :class="{ 'bg-slate-100 dark:bg-slate-800 font-semibold text-indigo-600 dark:text-indigo-400': activeChapterMsgIndex === item.index }"
                @click="jumpToMessage(item.index); mobileChapterPopoverVisible = false;"
              >
                <span class="font-mono text-[11px] text-indigo-500 flex-shrink-0">#{{ qIdx + 1 }}</span>
                <span class="truncate">{{ item.msg.content.slice(0, 30) || '（空提问）' }}</span>
              </div>
            </div>
          </div>
        </el-popover>

        <!-- 新建会话按钮 -->
        <button
          type="button"
          class="h-7 px-2.5 rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          title="发起新会话"
          @click="createNewConversation"
        >
          <el-icon class="text-xs"><component is="Plus" /></el-icon>
          <span>新建对话</span>
        </button>
      </div>
    </div>

    <!-- 2. 主体对话容器 -->
    <div class="flex-1 flex flex-col min-h-0 relative">
      <!-- 消息滚动区 -->
      <div
        ref="chatContainerRef"
        class="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center"
        @scroll="onChatScroll"
        @click="handleChatContainerClick"
      >
        <!-- 空状态 -->
        <div v-if="messages.length === 0" class="my-auto py-12 text-center max-w-md">
          <div class="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-2xl mx-auto mb-3 shadow-xs">
            {{ currentRole?.icon || '🤖' }}
          </div>
          <h1 class="text-base font-semibold text-slate-900 dark:text-slate-100 m-0 mb-1">有什么可以帮到您？</h1>
          <p class="text-xs text-slate-400 dark:text-slate-500 m-0 leading-relaxed">
            当前预设：<strong class="text-slate-700 dark:text-slate-300 font-medium">{{ currentRole?.name || '默认助手' }}</strong> · 支持多模型深度对话与提示词自定义
          </p>
        </div>

        <!-- 正常对话消息流 -->
        <div v-else class="w-full max-w-3xl space-y-5 pb-6">
          <div
            v-for="(msg, index) in messages"
            :id="'msg-row-' + index"
            :key="index"
            class="flex flex-col w-full"
            :class="msg.role === 'user' ? 'items-end' : 'items-start'"
          >
            <!-- 用户消息 -->
            <template v-if="msg.role === 'user'">
              <div class="group flex flex-col items-end max-w-[85%]">
                <div class="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs leading-relaxed rounded-lg border border-slate-200/60 dark:border-slate-700/60 break-words shadow-subtle">
                  <div :class="{ 'line-clamp-6': isLongMessage(msg.content) && !expandedMsgMap[index] }">
                    {{ msg.content }}
                  </div>
                  <button
                    v-if="isLongMessage(msg.content)"
                    type="button"
                    class="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    @click="toggleMsgExpand(index)"
                  >
                    {{ expandedMsgMap[index] ? '收起 ▴' : '展开全文 ▾' }}
                  </button>
                </div>

                <!-- 用户操作栏 -->
                <div v-if="!isStreaming" class="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    class="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    @click="startEditMsg(index, msg)"
                    title="编辑提问"
                  >
                    <el-icon class="text-xs"><component is="EditPen" /></el-icon>
                  </button>
                  <button
                    type="button"
                    class="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    @click="copyMessage(msg.content)"
                    title="复制文本"
                  >
                    <el-icon class="text-xs"><component is="CopyDocument" /></el-icon>
                  </button>
                  <button
                    type="button"
                    class="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    @click="deleteMessage(index)"
                    title="删除消息"
                  >
                    <el-icon class="text-xs"><component is="Delete" /></el-icon>
                  </button>
                </div>
              </div>
            </template>

            <!-- AI 回复 -->
            <template v-else>
              <div class="group flex flex-col items-start w-full">
                <div
                  v-if="msg.content"
                  class="ai-markdown-body w-full"
                  v-html="renderMarkdown(msg.content)"
                />
                <div
                  v-else-if="isStreaming && index === messages.length - 1"
                  class="flex items-center gap-1 py-2 text-slate-400 text-xs"
                >
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse delay-100"></span>
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse delay-200"></span>
                  <span class="ml-1 text-[11px]">正在思考与回复...</span>
                </div>

                <!-- AI 操作栏 -->
                <div v-if="msg.content && !isStreaming" class="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    class="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    @click="regenerateMessage(index)"
                    title="重新生成"
                  >
                    <el-icon class="text-xs"><component is="Refresh" /></el-icon>
                  </button>
                  <button
                    type="button"
                    class="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    @click="copyMessage(msg.content)"
                    title="复制回复"
                  >
                    <el-icon class="text-xs"><component is="CopyDocument" /></el-icon>
                  </button>
                  <button
                    type="button"
                    class="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    @click="deleteMessage(index)"
                    title="删除回复"
                  >
                    <el-icon class="text-xs"><component is="Delete" /></el-icon>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 3. 底部输入卡片 -->
      <div class="sticky bottom-0 w-full max-w-3xl mx-auto px-4 pb-4 pt-1 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50/90 dark:via-slate-950/90 to-transparent flex-shrink-0">
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg shadow-subtle flex flex-col focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all overflow-hidden">
          <!-- 上部快捷工具栏 -->
          <div class="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30 text-xs">
            <div class="flex items-center gap-2">
              <!-- 对话列表 Popover -->
              <el-popover
                v-model:visible="convPopoverVisible"
                trigger="click"
                placement="top-start"
                :width="270"
                popper-class="!p-2.5 !bg-white dark:!bg-slate-900 !border-slate-200/80 dark:!border-slate-800 !rounded-lg !shadow-lg"
                :show-arrow="false"
              >
                <template #reference>
                  <button
                    type="button"
                    class="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer font-medium"
                    title="切换或管理对话"
                  >
                    <el-icon class="text-xs"><component is="ChatDotRound" /></el-icon>
                    <span>对话历史</span>
                    <el-icon class="text-[10px] text-slate-400"><component is="ArrowDown" /></el-icon>
                  </button>
                </template>

                <div class="space-y-2">
                  <div class="flex items-center gap-1.5">
                    <input
                      v-model="convSearchQuery"
                      type="text"
                      placeholder="搜索历史对话..."
                      class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <button
                      type="button"
                      class="w-6 h-6 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center cursor-pointer"
                      title="发起新对话"
                      @click="createNewConversation"
                    >
                      <el-icon class="text-xs"><component is="Plus" /></el-icon>
                    </button>
                  </div>

                  <div class="max-h-48 overflow-y-auto space-y-0.5">
                    <div
                      v-for="conv in filteredConversations"
                      :key="conv.id"
                      class="group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors"
                      :class="[
                        conv.id === activeConversationId
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      ]"
                      @click="selectConversation(conv.id)"
                    >
                      <div class="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
                        <span class="text-xs flex-shrink-0">{{ getRoleIcon(conv.role_id) }}</span>
                        <div v-if="editingConvId === conv.id" class="flex-1" @click.stop>
                          <input
                            v-model="editingConvTitle"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1 text-xs outline-none"
                            @keydown.enter="saveEditTitle(conv)"
                            @keydown.esc="cancelEditTitle"
                            @blur="saveEditTitle(conv)"
                          />
                        </div>
                        <span v-else class="truncate">{{ conv.title }}</span>
                      </div>

                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                        <button type="button" class="text-slate-400 hover:text-slate-700 cursor-pointer" title="重命名" @click.stop="startEditTitle(conv)">
                          <el-icon class="text-[11px]"><component is="EditPen" /></el-icon>
                        </button>
                        <button type="button" class="text-slate-400 hover:text-red-500 cursor-pointer" title="删除" @click.stop="deleteConversation(conv.id, $event)">
                          <el-icon class="text-[11px]"><component is="Delete" /></el-icon>
                        </button>
                      </div>
                    </div>
                    <div v-if="filteredConversations.length === 0" class="text-center py-3 text-xs text-slate-400">暂无对话</div>
                  </div>

                  <div v-if="conversations.length > 0" class="pt-1.5 border-t border-slate-100 dark:border-slate-800 text-center">
                    <button type="button" class="text-[11px] text-red-500 hover:underline cursor-pointer" @click="clearAllConversations">
                      清空所有对话
                    </button>
                  </div>
                </div>
              </el-popover>

              <div class="h-3 w-px bg-slate-200 dark:bg-slate-800"></div>

              <!-- 角色选择 Popover -->
              <el-popover
                v-model:visible="rolePopoverVisible"
                trigger="click"
                placement="top"
                :width="270"
                popper-class="!p-2.5 !bg-white dark:!bg-slate-900 !border-slate-200/80 dark:!border-slate-800 !rounded-lg !shadow-lg"
                :show-arrow="false"
              >
                <template #reference>
                  <button
                    type="button"
                    class="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer font-medium"
                    title="选择或自定义角色提示词"
                  >
                    <span class="text-xs">{{ currentRole?.icon || '🤖' }}</span>
                    <span>{{ currentRole?.name || '默认助手' }}</span>
                    <el-icon class="text-[10px] text-slate-400"><component is="ArrowDown" /></el-icon>
                  </button>
                </template>

                <div class="space-y-2">
                  <div class="flex items-center gap-1.5">
                    <input
                      v-model="roleSearchQuery"
                      type="text"
                      placeholder="搜索角色预设..."
                      class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <button
                      type="button"
                      class="w-6 h-6 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center cursor-pointer"
                      title="添加新角色"
                      @click="openAddRoleModal"
                    >
                      <el-icon class="text-xs"><component is="Plus" /></el-icon>
                    </button>
                  </div>

                  <div class="max-h-48 overflow-y-auto space-y-1">
                    <div
                      v-for="r in filteredRoles"
                      :key="r.id"
                      class="group flex items-center justify-between p-1.5 rounded text-xs cursor-pointer transition-colors"
                      :class="[
                        r.id === selectedRoleId
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      ]"
                      @click="selectRole(r)"
                    >
                      <span class="mr-1.5 text-sm">{{ r.icon }}</span>
                      <div class="flex-1 min-w-0 pr-1">
                        <div class="font-medium text-xs truncate">{{ r.name }}</div>
                        <div class="text-[10px] text-slate-400 truncate">{{ r.prompt }}</div>
                      </div>

                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                        <button type="button" class="text-slate-400 hover:text-slate-700 cursor-pointer" title="编辑" @click="openEditRoleModal(r, $event)">
                          <el-icon class="text-[11px]"><component is="EditPen" /></el-icon>
                        </button>
                        <button type="button" class="text-slate-400 hover:text-red-500 cursor-pointer" title="删除" @click="deleteRole(r.id, $event)">
                          <el-icon class="text-[11px]"><component is="Delete" /></el-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </el-popover>
            </div>

            <!-- 右侧返回底部按钮 -->
            <button
              v-if="showScrollBottomBtn"
              type="button"
              class="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              title="返回底部"
              @click="scrollToBottomSmooth"
            >
              <el-icon class="text-xs"><component is="Bottom" /></el-icon>
              <span>回到底部</span>
            </button>
          </div>

          <!-- 附件预览 -->
          <div v-if="attachments.length > 0" class="flex flex-wrap gap-1.5 p-2 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800">
            <div v-for="(att, idx) in attachments" :key="'att-' + idx" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-xs">
              <span>{{ att.isImage ? '🖼️' : '📎' }}</span>
              <span class="max-w-[120px] truncate text-[11px]">{{ att.name }}</span>
              <button type="button" class="text-slate-400 hover:text-red-500 text-xs cursor-pointer" @click="removeAttachment(idx)">×</button>
            </div>
          </div>

          <!-- 编辑状态提示条 -->
          <div v-if="editingMsgIndex !== null" class="px-3 py-1 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/60 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
            <div class="flex items-center gap-1">
              <el-icon class="text-xs"><component is="EditPen" /></el-icon>
              <span>正在编辑提问 #{{ editingMsgIndex + 1 }}</span>
            </div>
            <button type="button" class="text-xs text-amber-600 hover:underline cursor-pointer" @click="cancelEditingMsg">
              取消编辑
            </button>
          </div>

          <!-- 输入文本框 -->
          <textarea
            ref="textareaRef"
            v-model="inputPrompt"
            class="w-full px-3.5 py-2.5 text-xs bg-transparent text-slate-800 dark:text-slate-200 outline-none resize-none min-h-[44px] max-h-36 leading-relaxed"
            placeholder="输入您的问题，Enter 发送，Shift+Enter 换行，支持粘贴图片..."
            rows="2"
            :disabled="isStreaming"
            @keydown="handleKeyDown"
            @paste="handlePaste"
          />

          <!-- 底部发送与模型切换行 -->
          <div class="px-3 py-1.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-950/20">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="上传附件/图片"
                @click="fileInputRef?.click()"
              >
                <el-icon class="text-xs"><component is="Plus" /></el-icon>
              </button>
              <input ref="fileInputRef" type="file" hidden @change="onFileSelect" />

              <!-- 模型选择 Popover -->
              <el-popover
                v-model:visible="modelPopoverVisible"
                trigger="click"
                placement="top-start"
                :width="240"
                popper-class="!p-2 !bg-white dark:!bg-slate-900 !border-slate-200/80 dark:!border-slate-800 !rounded-lg !shadow-lg"
                :show-arrow="false"
              >
                <template #reference>
                  <button
                    type="button"
                    class="h-6 px-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{{ selectedModel || '暂无模型' }}</span>
                    <el-icon class="text-[9px] text-slate-400"><component is="ArrowDown" /></el-icon>
                  </button>
                </template>

                <div class="space-y-1.5">
                  <input
                    v-model="modelSearchQuery"
                    type="text"
                    placeholder="搜索模型..."
                    class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none"
                  />
                  <div class="max-h-40 overflow-y-auto space-y-0.5">
                    <div
                      v-for="m in filteredModelOptions"
                      :key="m"
                      class="flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors"
                      :class="[
                        m === selectedModel
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      ]"
                      @click="selectModelOption(m)"
                    >
                      <span class="truncate">{{ m }}</span>
                      <el-icon v-if="m === selectedModel" class="text-xs text-indigo-500"><component is="Check" /></el-icon>
                    </div>
                  </div>
                  <div class="pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button type="button" class="text-[11px] text-indigo-600 hover:underline cursor-pointer" @click="setDefaultModel">
                      设为默认
                    </button>
                  </div>
                </div>
              </el-popover>
            </div>

            <!-- 发送 / 停止按钮 -->
            <button
              type="button"
              class="h-7 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
              :class="[
                isStreaming
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white'
              ]"
              :disabled="!isStreaming && !inputPrompt.trim() && attachments.length === 0"
              @click="isStreaming ? stopGenerating() : sendMessage()"
              :title="isStreaming ? '停止生成' : '发送'"
            >
              <el-icon class="text-xs"><component :is="isStreaming ? 'VideoPause' : 'Promotion'" /></el-icon>
              <span>{{ isStreaming ? '停止' : '发送' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 角色配置/编辑弹窗 -->
    <el-dialog
      v-model="showRoleModal"
      :title="isEditingExistingRole ? '编辑角色与提示词' : '自定义角色与提示词'"
      width="440px"
      align-center
      destroy-on-close
    >
      <div class="space-y-3 py-1">
        <div>
          <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">角色名称</label>
          <el-input v-model="editingRole.name" placeholder="例如：安全审计专家、代码架构师..." />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">图标 (Emoji)</label>
          <el-input v-model="editingRole.icon" placeholder="⚡" maxlength="4" style="width: 80px;" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">角色系统提示词 (System Prompt)</label>
          <el-input
            v-model="editingRole.prompt"
            type="textarea"
            :rows="5"
            placeholder="详细描述该角色的专业背景、回答风格与输出格式规范..."
          />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="showRoleModal = false">取消</el-button>
          <el-button type="primary" @click="saveCustomRole">保存并启用</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
