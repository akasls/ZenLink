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

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  stopGenerating();
});
</script>

<template>
  <div class="openwebui-ai-panel">
    <!-- 1. 顶栏 (左侧：当前会话标题；右侧：新建会话 + 参数设置) -->
    <div class="openwebui-top-bar">
      <div class="top-bar-left">
        <div class="top-bar-title-wrap" :title="currentConversationTitle">
          <span class="top-bar-app-title">{{ currentConversationTitle }}</span>
        </div>
      </div>

      <div class="top-bar-right">
        <!-- 移动端专属章节快速跳转 Popover (仅移动端展示，避免浮动条遮挡侧栏) -->
        <el-popover
          v-if="userQuestions.length > 0"
          trigger="click"
          placement="bottom-end"
          :width="250"
          popper-class="unified-dock-popover zenlink-popover-theme"
          :show-arrow="false"
        >
          <template #reference>
            <button class="openwebui-capsule-btn md:hidden" title="快速跳转历史提问">
              <el-icon class="mr-1"><component is="Tickets" /></el-icon>
              <span class="btn-text">章节 ({{ userQuestions.length }})</span>
            </button>
          </template>

          <div class="dock-popover-content">
            <div class="dock-popover-title-row">
              <span>提问列表 (点击跳转)</span>
            </div>
            <div class="dock-popover-list">
              <div
                v-for="(item, qIdx) in userQuestions"
                :key="'mq-' + item.index"
                class="dock-popover-item"
                :class="{ active: activeChapterMsgIndex === item.index }"
                @click="jumpToMessage(item.index)"
              >
                <span class="font-mono font-bold text-xs text-primary mr-1.5">#{{ qIdx + 1 }}</span>
                <span class="item-name">{{ item.msg.content.slice(0, 32) || '（空提问）' }}</span>
              </div>
            </div>
          </div>
        </el-popover>
        <button class="openwebui-capsule-btn" @click="createNewConversation" title="发起新会话">
          <el-icon class="sm:mr-1"><component is="Plus" /></el-icon>
          <span class="btn-text">新建</span>
        </button>

        
      </div>
    </div>

    <!-- 2. 主体对话容器行 -->
    <div class="openwebui-body-row">
      <!-- 居中微型横条章节指示器 (置于 820px 宽度之外，高度居中对齐) -->
      <div v-if="userQuestions.length > 0" class="chat-timeline-strip">
        <div
          v-for="(item, qIdx) in userQuestions"
          :key="'qtick-' + item.index"
          class="timeline-tick-wrapper user-tick"
          :class="{ active: activeChapterMsgIndex === item.index }"
          @click="jumpToMessage(item.index)"
        >
          <el-tooltip
            :content="`#${qIdx + 1} ${item.msg.content.slice(0, 48) || '（空提问）'}`"
            placement="right"
            effect="dark"
            :show-after="30"
            :hide-after="30"
            popper-class="timeline-tick-tooltip"
          >
            <div class="timeline-tick-bar" />
          </el-tooltip>
        </div>
      </div>

      <div class="openwebui-main-container">
        <!-- 消息滚动区 -->
        <div
          ref="chatContainerRef"
          class="openwebui-chat-scroll"
          @scroll="onChatScroll"
          @click="handleChatContainerClick"
        >
          <!-- 空状态：问候语 + 简约说明 -->
          <div v-if="messages.length === 0" class="openwebui-hero-container">
            <div class="openwebui-greeting">
              <div class="greeting-logo robot-logo">{{ currentRole?.icon || '🤖' }}</div>
              <h1>有什么可以帮到您？</h1>
            </div>
            
            <p class="openwebui-hero-desc">
              当前角色：{{ currentRole?.name || '默认助手' }} · 支持多模型深度对话与提示词自定义
            </p>
          </div>

          <!-- 正常对话消息流 (严格 820px 与编辑框同宽) -->
          <div v-else class="openwebui-messages-wrap">
            <div
              v-for="(msg, index) in messages"
              :id="'msg-row-' + index"
              :key="index"
              class="openwebui-msg-row"
              :class="msg.role === 'user' ? 'user-row' : 'assistant-row'"
            >
              <div class="msg-bubble-wrapper">
                <!-- 用户消息气泡 (中性纯色、全圆角、长文本折叠) -->
                <div v-if="msg.role === 'user'" class="msg-bubble user">
                  <div class="user-text-container">
                    <div
                      class="user-text-body"
                      :class="{ 'is-collapsed': isLongMessage(msg.content) && !expandedMsgMap[index] }"
                    >
                      {{ msg.content }}
                    </div>

                    <!-- 展开 / 收起 按钮 -->
                    <button
                      v-if="isLongMessage(msg.content)"
                      type="button"
                      class="user-expand-toggle-btn"
                      @click="toggleMsgExpand(index)"
                    >
                      <span>{{ expandedMsgMap[index] ? '收起 ▴' : '展开全文 ▾' }}</span>
                    </button>
                  </div>
                </div>

                <!-- 用户消息纯图标悬浮操作栏 (编辑调入底部输入框、复制、删除) -->
                <div v-if="msg.role === 'user' && !isStreaming" class="user-msg-actions">
                  <button class="msg-act-icon-btn" @click="startEditMsg(index, msg)" title="编辑提问（放入下方输入框）">
                    <el-icon><component is="EditPen" /></el-icon>
                  </button>
                  <button class="msg-act-icon-btn" @click="copyMessage(msg.content)" title="复制文本">
                    <el-icon><component is="CopyDocument" /></el-icon>
                  </button>
                  <button class="msg-act-icon-btn del-icon" @click="deleteMessage(index)" title="删除消息">
                    <el-icon><component is="Delete" /></el-icon>
                  </button>
                </div>

                <!-- AI 助手消息 (无背景包裹，纯净呈现) -->
                <div v-if="msg.role === 'assistant'" class="msg-bubble assistant">
                  <div
                    v-if="msg.content"
                    class="ai-markdown-body"
                    :class="{ 'streaming-active': isStreaming && index === messages.length - 1 }"
                    v-html="renderMarkdown(msg.content)"
                  />
                  <div
                    v-else-if="isStreaming && index === messages.length - 1"
                    class="ai-typing-indicator"
                  >
                    <span></span><span></span><span></span>
                  </div>
                </div>

                <!-- AI 助手消息纯图标操作栏 (重新生成、复制、删除) -->
                <div v-if="msg.role === 'assistant' && msg.content && !isStreaming" class="msg-actions">
                  <button class="msg-act-icon-btn" @click="regenerateMessage(index)" title="重新生成">
                    <el-icon><component is="Refresh" /></el-icon>
                  </button>
                  <button class="msg-act-icon-btn" @click="copyMessage(msg.content)" title="复制回复">
                    <el-icon><component is="CopyDocument" /></el-icon>
                  </button>
                  <button class="msg-act-icon-btn del-icon" @click="deleteMessage(index)" title="删除回复">
                    <el-icon><component is="Delete" /></el-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. 底部输入区域 (一体紧贴卡片：上部工具条无下圆角 + 下部输入区自适应) -->
        <div class="openwebui-bottom-dock">
          <div class="openwebui-hero-input-box dock-mode attached-card-mode">
            <!-- 紧贴在输入框上方的无下圆角工具条 -->
            <div class="dock-attached-top-bar">
              <div class="dock-attached-left">
                <!-- 对话列表下拉 Popover -->
                <el-popover
                  v-model:visible="convPopoverVisible"
                  trigger="click"
                  placement="top-start"
                  :width="280"
                  popper-class="unified-dock-popover zenlink-popover-theme"
                  :show-arrow="false"
                >
                  <template #reference>
                    <button type="button" class="dock-attached-trigger-btn" title="切换或管理对话">
                      <el-icon class="mr-1 text-xs"><component is="ChatDotRound" /></el-icon>
                      <span class="pill-btn-title">{{ currentConversationTitle }}</span>
                      <el-icon class="ml-0.5 text-[10px] arrow-icon"><component is="ArrowDown" /></el-icon>
                    </button>
                  </template>

                  <div class="dock-popover-content">
                    <div class="dock-popover-header">
                      <input
                        v-model="convSearchQuery"
                        type="text"
                        placeholder="搜索历史对话..."
                        class="dock-popover-search"
                      />
                      <button type="button" class="dock-popover-new-btn" title="发起新对话" @click="createNewConversation">
                        <el-icon><component is="Plus" /></el-icon>
                      </button>
                    </div>

                    <div class="dock-popover-list">
                      <div
                        v-for="conv in filteredConversations"
                        :key="conv.id"
                        class="dock-popover-item"
                        :class="{ active: conv.id === activeConversationId }"
                        @click="selectConversation(conv.id)"
                      >
                        <span class="mr-1.5 text-xs flex-shrink-0">{{ getRoleIcon(conv.role_id) }}</span>
                        
                        <div v-if="editingConvId === conv.id" class="conv-edit-box" @click.stop>
                          <input
                            v-model="editingConvTitle"
                            class="conv-title-input"
                            @keydown.enter="saveEditTitle(conv)"
                            @keydown.esc="cancelEditTitle"
                            @blur="saveEditTitle(conv)"
                          />
                        </div>
                        <span v-else class="item-name">{{ conv.title }}</span>

                        <div class="item-actions" @click.stop>
                          <button type="button" class="act-btn" title="重命名" @click.stop="startEditTitle(conv)">
                            <el-icon><component is="EditPen" /></el-icon>
                          </button>
                          <button type="button" class="act-btn del" title="删除" @click.stop="deleteConversation(conv.id, $event)">
                            <el-icon><component is="Delete" /></el-icon>
                          </button>
                        </div>
                      </div>
                      <div v-if="filteredConversations.length === 0" class="dock-popover-empty">暂无对话</div>
                    </div>

                    <div v-if="conversations.length > 0" class="dock-popover-footer">
                      <button type="button" class="clear-all-link" @click="clearAllConversations">
                        <el-icon class="mr-1"><component is="Delete" /></el-icon>清空所有对话
                      </button>
                    </div>
                  </div>
                </el-popover>

                <div class="dock-attached-divider" />

                <!-- 角色选择 Popover (支持快捷切换、直接编辑与删除) -->
                <el-popover
                  v-model:visible="rolePopoverVisible"
                  trigger="click"
                  placement="top"
                  :width="310"
                  popper-class="unified-dock-popover zenlink-popover-theme"
                  :show-arrow="false"
                >
                  <template #reference>
                    <button type="button" class="dock-attached-trigger-btn" title="选择或自定义角色提示词">
                      <span class="mr-1 text-xs">{{ currentRole?.icon || '🤖' }}</span>
                      <span class="pill-btn-title">{{ currentRole?.name || '默认助手' }}</span>
                      <el-icon class="ml-0.5 text-[10px] arrow-icon"><component is="ArrowDown" /></el-icon>
                    </button>
                  </template>

                  <div class="dock-popover-content">
                    <div class="dock-popover-title-row">
                      <span>角色预设与提示词</span>
                      <button type="button" class="dock-popover-new-btn" title="添加新角色" @click="openAddRoleModal">
                        <el-icon><component is="Plus" /></el-icon>
                      </button>
                    </div>

                    <div class="dock-popover-list">
                      <div
                        v-for="r in roles"
                        :key="r.id"
                        class="dock-popover-item role-item group"
                        :class="{ active: r.id === selectedRoleId }"
                        @click="selectRole(r)"
                      >
                        <span class="mr-2 text-sm">{{ r.icon }}</span>
                        <div class="flex-1 min-w-0">
                          <div class="font-medium text-xs text-main flex items-center justify-between">
                            <span>{{ r.name }}</span>
                            <span v-if="r.isCustom" class="text-[10px] text-muted">自定义</span>
                          </div>
                          <div class="text-[11px] text-muted truncate">{{ r.prompt }}</div>
                        </div>

                        <!-- 行内操作：编辑角色、删除角色 -->
                        <div class="role-hover-actions" @click.stop>
                          <button
                            type="button"
                            class="act-btn"
                            title="编辑此角色"
                            @click="openEditRoleModal(r, $event)"
                          >
                            <el-icon><component is="EditPen" /></el-icon>
                          </button>
                          <button
                            v-if="r.isCustom"
                            type="button"
                            class="act-btn del"
                            title="删除角色"
                            @click="deleteCustomRole(r.id, $event)"
                          >
                            <el-icon><component is="Delete" /></el-icon>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </el-popover>
              </div>

              <!-- 右侧返回底部按钮 -->
              <div class="dock-attached-right">
                <button
                  v-if="showScrollBottomBtn"
                  type="button"
                  class="dock-attached-trigger-btn scroll-bottom-btn"
                  title="返回底部"
                  @click="scrollToBottomSmooth"
                >
                  <el-icon class="mr-0.5 text-xs"><component is="Bottom" /></el-icon>
                  <span>回底</span>
                  <span v-if="isStreaming" class="scroll-pulse-dot-neutral" />
                </button>
              </div>
            </div>

            <!-- 主体输入框区域 -->
            <div class="dock-attached-input-body">
              <!-- 正在编辑历史消息提示条 -->
              <div v-if="editingMsgIndex !== null" class="dock-editing-history-bar">
                <div class="editing-tag-info">
                  <el-icon class="mr-1 text-xs text-primary"><component is="EditPen" /></el-icon>
                  <span>正在编辑提问 #{{ editingMsgIndex + 1 }}</span>
                </div>
                <button type="button" class="cancel-edit-text-btn" @click="cancelEditingMsg" title="放弃编辑">
                  取消编辑
                </button>
              </div>

              <!-- 暂存附件标签栏 -->
              <div v-if="attachments.length > 0" class="card-attachments-bar">
                <div v-for="(att, idx) in attachments" :key="'att-' + idx" class="card-attachment-chip">
                  <span>{{ att.isImage ? '🖼️' : '📎' }}</span>
                  <span class="chip-name">{{ att.name }}</span>
                  <button type="button" class="chip-remove" title="移除附件" @click="removeAttachment(idx)">×</button>
                </div>
              </div>

              <textarea
                ref="textareaRef"
                v-model="inputPrompt"
                class="openwebui-card-textarea"
                placeholder="输入您的问题，Enter 发送，Shift+Enter 换行，支持 Ctrl+V 粘贴图片..."
                rows="2"
                :disabled="isStreaming"
                @keydown="handleKeyDown"
                @paste="handlePaste"
              />

              <!-- 卡片底部工具栏：左下角 + 号，右下角模型选择与简约发送按钮 -->
              <div class="openwebui-card-bottom-bar">
                <div class="card-bottom-left">
                  <button type="button" class="openwebui-plus-btn" title="添加文件/图片" @click="fileInputRef?.click()">
                    <el-icon><component is="Plus" /></el-icon>
                  </button>
                  <input ref="fileInputRef" type="file" hidden @change="onFileSelect" />
                </div>

                <div class="card-bottom-right">
                  <!-- 简约模型选择 Popover -->
                  <el-popover
                    v-model:visible="modelPopoverVisible"
                    trigger="click"
                    placement="top-end"
                    :width="260"
                    popper-class="openwebui-model-popover zenlink-popover-theme"
                    :show-arrow="false"
                  >
                    <template #reference>
                      <button type="button" class="openwebui-model-trigger-btn">
                        <span>{{ selectedModel || '选择模型' }}</span>
                        <el-icon class="ml-1 text-xs model-arrow-icon" :class="{ 'is-open': modelPopoverVisible }">
                          <component is="ArrowDown" />
                        </el-icon>
                      </button>
                    </template>

                    <div class="popover-model-box">
                      <div class="model-search-header">
                        <el-icon class="search-icon"><component is="Search" /></el-icon>
                        <input
                          v-model="modelSearchQuery"
                          type="text"
                          placeholder="搜索模型"
                          class="model-search-input"
                        />
                      </div>

                      <div v-if="filteredModelOptions.length > 0" class="model-options-list">
                        <div
                          v-for="m in filteredModelOptions"
                          :key="m"
                          class="model-option-row"
                          :class="{ active: m === selectedModel }"
                          @click="selectModelOption(m)"
                        >
                          <div class="model-row-left">
                            <el-icon class="mr-1.5 text-xs text-muted"><component is="Cpu" /></el-icon>
                            <span class="model-row-name">{{ m }}</span>
                          </div>
                          <el-icon v-if="m === selectedModel" class="text-primary check-icon"><component is="Check" /></el-icon>
                        </div>
                      </div>

                      <div v-else class="empty-model-state">
                        <div class="empty-model-title">暂无可用模型</div>
                        <div class="empty-model-desc">请前往系统设置配置 API</div>
                      </div>

                      <div class="popover-model-footer">
                        <button type="button" class="set-default-btn" @click="setDefaultModel">
                          设为默认
                        </button>
                      </div>
                    </div>
                  </el-popover>

                  <!-- 简约圆形发送 / 停止生成按钮 -->
                  <button
                    type="button"
                    class="openwebui-send-icon-btn"
                    :class="{
                      active: inputPrompt.trim().length > 0 || attachments.length > 0 || isStreaming,
                      'stop-mode': isStreaming
                    }"
                    :disabled="!isStreaming && !inputPrompt.trim() && attachments.length === 0"
                    @click="isStreaming ? stopGenerating() : sendMessage()"
                    :title="isStreaming ? '停止生成' : '发送'"
                  >
                    <el-icon v-if="!isStreaming"><component is="Promotion" /></el-icon>
                    <el-icon v-else class="stop-icon"><component is="VideoPause" /></el-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 角色配置/编辑弹窗 (支持新增与修改预设) -->
    <el-dialog
      v-model="showRoleModal"
      :title="isEditingExistingRole ? '✏️ 编辑角色与提示词' : '✨ 自定义角色与提示词'"
      width="480px"
      custom-class="zenlink-custom-dialog"
      align-center
      destroy-on-close
    >
      <div class="space-y-3.5 py-1">
        <div>
          <label class="block text-xs font-semibold text-muted mb-1.5">角色名称</label>
          <el-input v-model="editingRole.name" placeholder="例如：安全审计工程师、前端架构师..." />
        </div>
        <div>
          <label class="block text-xs font-semibold text-muted mb-1.5">角色图标 (Emoji)</label>
          <el-input v-model="editingRole.icon" placeholder="⚡" maxlength="4" style="width: 80px;" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-muted mb-1.5">角色系统提示词 (System Prompt)</label>
          <el-input
            v-model="editingRole.prompt"
            type="textarea"
            :rows="5"
            placeholder="详细描述该角色的专业背景、回答风格、注意事项..."
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
