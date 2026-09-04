<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { aiApi, noteApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/components/ui/sonner';
import { confirmBox } from '@/utils/confirm';
import { renderMarkdown, handleCodeCopyClick } from '@/utils/markdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  RotateCw,
  ChevronDown,
  Check,
  Square,
  Send,
  Paperclip,
  ArrowDown,
  MessageSquare,
  Tickets,
  X,
} from 'lucide-vue-next';

const props = defineProps<{
  active?: boolean;
}>();

const emit = defineEmits<{
  stateChange: [state: {
    conversations: Conversation[];
    activeConversationId: string | null;
  }];
}>();

const authStore = useAuthStore();

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
function handleResize() { isMobile.value = window.innerWidth < 768; }

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
  toast.success('已应用角色「' + r.name + '」');
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
    toast.warning('请输入角色名称');
    return;
  }
  if (!editingRole.value.prompt.trim()) {
    toast.warning('请输入角色的提示词');
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
  toast.success(`已保存角色「${editingRole.value.name}」`);
}

function deleteCustomRole(roleId: string, e?: Event) {
  e?.stopPropagation();
  const customOnly = roles.value.filter(r => r.isCustom && r.id !== roleId);
  localStorage.setItem('zenlink_ai_roles', JSON.stringify(customOnly));
  if (selectedRoleId.value === roleId) {
    selectedRoleId.value = 'default';
  }
  loadCustomRoles();
  toast.success('已删除角色');
}

// 会话与消息状态
const conversations = ref<Conversation[]>([]);
const activeConversationId = ref<string>('');

watch(
  [conversations, activeConversationId],
  () => {
    emit('stateChange', {
      conversations: conversations.value,
      activeConversationId: activeConversationId.value,
    });
  },
  { deep: true, immediate: true }
);

defineExpose({
  conversations,
  activeConversationId,
  createNewConversation,
  selectConversation,
  deleteConversation,
  loadConversations,
});

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
    toast.success('已更新会话名称');
  } catch {
    toast.error('更新标题失败');
  } finally {
    cancelEditTitle();
  }
}

async function deleteConversation(id: string, e?: Event) {
  e?.stopPropagation();
  const conv = conversations.value.find(c => c.id === id);
  const convTitle = conv ? `「${conv.title}」` : '此会话';
  try {
    await confirmBox(`确定要删除 ${convTitle} 吗？删除后不可恢复。`, '删除会话');
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
    toast.success('已删除会话');
  } catch {}
}

async function clearAllConversations() {
  try {
    await confirmBox('确定要清空全部 AI 对话历史吗？此操作无法撤销。', '清空历史');
    await aiApi.clearConversations();
    conversations.value = [];
    activeConversationId.value = '';
    messages.value = [];
    convPopoverVisible.value = false;
    toast.success('已清空所有对话');
  } catch {}
}

function selectModelOption(m: string) {
  selectedModel.value = m;
  modelPopoverVisible.value = false;
  toast.success(`已切换模型为「${m}」`);
}

function setDefaultModel() {
  if (selectedModel.value) {
    toast.success(`已将「${selectedModel.value}」设为默认模型`);
  } else {
    toast.warning('当前无可用模型');
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
    toast.success(`已附加「${file.name}」`);
  } catch {
    toast.error('附件上传失败');
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
  toast.info(`已将提问 #${index + 1} 载入下方编辑框`);
}

function cancelEditingMsg() {
  editingMsgIndex.value = null;
  inputPrompt.value = '';
}

// 删除指定消息
async function deleteMessage(index: number) {
  const msg = messages.value[index];
  try {
    await confirmBox('确定要删除这条消息吗？', '删除消息');

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

    toast.success('已删除消息');
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
  toast.success('已复制内容');
}

// ==================== 7. 代码框复制按钮事件代理 ====================
function handleChatContainerClick(e: MouseEvent) {
  handleCodeCopyClick(e);
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
  <div class="flex-1 flex flex-col min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-background text-foreground selection:bg-primary/10">
    <!-- 1. 顶栏 -->
    <div class="h-12 px-4 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between shrink-0 sticky top-0 z-10 w-full min-w-0 max-w-full">
      <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
        <span class="text-xs font-semibold text-foreground/90 truncate" :title="currentConversationTitle">
          {{ currentConversationTitle }}
        </span>
      </div>

      <div class="shrink-0 flex items-center gap-1.5">
        <!-- 移动端章节跳转 Popover -->
        <Popover
          v-if="userQuestions.length >= 2"
          v-model:open="mobileChapterPopoverVisible"
        >
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="h-7 text-xs font-medium md:hidden gap-1"
              title="快速跳转历史提问"
            >
              <Tickets class="h-3.5 w-3.5 text-muted-foreground" />
              <span>章节 ({{ userQuestions.length }})</span>
            </Button>
          </PopoverTrigger>

          <PopoverContent align="end" class="w-60 p-2 shadow-lg">
            <div class="space-y-1">
              <div class="text-xs font-semibold text-muted-foreground px-1 pb-1 border-b border-border">
                提问列表
              </div>
              <div class="max-h-48 overflow-y-auto space-y-0.5">
                <div
                  v-for="(item, qIdx) in userQuestions"
                  :key="'mq-' + item.index"
                  class="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-foreground/80 hover:bg-accent hover:text-foreground cursor-pointer transition-colors"
                  :class="{ 'bg-accent font-semibold text-primary': activeChapterMsgIndex === item.index }"
                  @click="jumpToMessage(item.index); mobileChapterPopoverVisible = false;"
                >
                  <span class="font-mono text-[11px] text-primary shrink-0">#{{ qIdx + 1 }}</span>
                  <span class="truncate">{{ item.msg.content.slice(0, 30) || '（空提问）' }}</span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <!-- 新建会话按钮 -->
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-xs font-medium gap-1"
          title="发起新会话"
          @click="createNewConversation"
        >
          <Plus class="h-3.5 w-3.5" />
          <span>新建对话</span>
        </Button>
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
          <div class="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center text-2xl mx-auto mb-3 shadow-xs">
            {{ currentRole?.icon || '🤖' }}
          </div>
          <h1 class="text-base font-semibold text-foreground m-0 mb-1">有什么可以帮到您？</h1>
          <p class="text-xs text-muted-foreground m-0 leading-relaxed">
            当前预设：<strong class="text-foreground font-medium">{{ currentRole?.name || '默认助手' }}</strong> · 支持多模型深度对话与提示词自定义
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
                <div class="px-3.5 py-2.5 bg-primary/10 text-foreground text-xs leading-relaxed rounded-2xl rounded-tr-xs border border-primary/20 break-words shadow-xs">
                  <div :class="{ 'line-clamp-6': isLongMessage(msg.content) && !expandedMsgMap[index] }">
                    {{ msg.content }}
                  </div>
                  <Button
                    v-if="isLongMessage(msg.content)"
                    variant="link"
                    size="xs"
                    class="p-0 h-auto text-[11px] text-primary mt-1 cursor-pointer"
                    @click="toggleMsgExpand(index)"
                  >
                    {{ expandedMsgMap[index] ? '收起 ▴' : '展开全文 ▾' }}
                  </Button>
                </div>

                <!-- 用户操作栏 -->
                <div v-if="!isStreaming" class="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-foreground"
                    @click="startEditMsg(index, msg)"
                    title="编辑提问"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-foreground"
                    @click="copyMessage(msg.content)"
                    title="复制文本"
                  >
                    <Copy class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    @click="deleteMessage(index)"
                    title="删除消息"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </Button>
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
                  class="flex items-center gap-1.5 py-2 text-muted-foreground text-xs"
                >
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-100"></span>
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-200"></span>
                  <span class="ml-1 text-[11px]">正在思考与回复...</span>
                </div>

                <!-- AI 操作栏 -->
                <div v-if="msg.content && !isStreaming" class="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-foreground"
                    @click="regenerateMessage(index)"
                    title="重新生成"
                  >
                    <RotateCw class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-foreground"
                    @click="copyMessage(msg.content)"
                    title="复制回复"
                  >
                    <Copy class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    @click="deleteMessage(index)"
                    title="删除回复"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 3. 底部输入卡片 -->
      <div class="sticky bottom-0 w-full max-w-3xl mx-auto px-4 pb-4 pt-1 bg-gradient-to-t from-background via-background/90 to-transparent shrink-0">
        <Card class="shadow-sm flex flex-col focus-within:ring-1 focus-within:ring-ring transition-all overflow-hidden border-border p-0 gap-0">
          <!-- 上部快捷工具栏 -->
          <div class="px-3 py-1.5 border-b border-border/70 flex items-center justify-between bg-muted/30 text-xs">
            <div class="flex items-center gap-2">
              <!-- 对话列表 Popover -->
              <Popover v-model:open="convPopoverVisible">
                <PopoverTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground gap-1 font-medium cursor-pointer"
                    title="切换或管理对话"
                  >
                    <MessageSquare class="h-3.5 w-3.5" />
                    <span>对话历史</span>
                    <ChevronDown class="h-3 w-3 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent side="top" align="start" class="w-72 p-2.5 shadow-lg">
                  <div class="space-y-2">
                    <div class="flex items-center gap-1.5">
                      <Input
                        v-model="convSearchQuery"
                        placeholder="搜索历史对话..."
                        class="h-7 text-xs flex-1"
                      />
                      <Button
                        size="icon-xs"
                        class="h-7 w-7 shrink-0 cursor-pointer"
                        title="发起新对话"
                        @click="createNewConversation"
                      >
                        <Plus class="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div class="max-h-48 overflow-y-auto space-y-0.5">
                      <div
                        v-for="conv in filteredConversations"
                        :key="conv.id"
                        class="group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors"
                        :class="[
                          conv.id === activeConversationId
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                        ]"
                        @click="selectConversation(conv.id)"
                      >
                        <div class="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
                          <span class="text-xs shrink-0">{{ getRoleIcon(conv.role_id) }}</span>
                          <div v-if="editingConvId === conv.id" class="flex-1" @click.stop>
                            <Input
                              v-model="editingConvTitle"
                              class="h-6 text-xs"
                              @keydown.enter="saveEditTitle(conv)"
                              @keydown.esc="cancelEditTitle"
                              @blur="saveEditTitle(conv)"
                            />
                          </div>
                          <span v-else class="truncate">{{ conv.title }}</span>
                        </div>

                        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                          <Button variant="ghost" size="icon-xs" class="text-muted-foreground hover:text-foreground" title="重命名" @click.stop="startEditTitle(conv)">
                            <Pencil class="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon-xs" class="text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="删除" @click.stop="deleteConversation(conv.id, $event)">
                            <Trash2 class="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div v-if="filteredConversations.length === 0" class="text-center py-3 text-xs text-muted-foreground">暂无对话</div>
                    </div>

                    <div v-if="conversations.length > 0" class="pt-1.5 border-t border-border text-center">
                      <Button variant="ghost" size="xs" class="text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer" @click="clearAllConversations">
                        清空所有对话
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <div class="h-3 w-px bg-border"></div>

              <!-- 角色选择 Popover -->
              <Popover v-model:open="rolePopoverVisible">
                <PopoverTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground gap-1 font-medium cursor-pointer"
                    title="选择或自定义角色提示词"
                  >
                    <span class="text-xs">{{ currentRole?.icon || '🤖' }}</span>
                    <span>{{ currentRole?.name || '默认助手' }}</span>
                    <ChevronDown class="h-3 w-3 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent side="top" align="start" class="w-72 p-2.5 shadow-lg">
                  <div class="space-y-2">
                    <div class="flex items-center gap-1.5">
                      <Input
                        v-model="roleSearchQuery"
                        placeholder="搜索角色预设..."
                        class="h-7 text-xs flex-1"
                      />
                      <Button
                        size="icon-xs"
                        class="h-7 w-7 shrink-0 cursor-pointer"
                        title="添加新角色"
                        @click="openAddRoleModal"
                      >
                        <Plus class="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div class="max-h-48 overflow-y-auto space-y-1">
                      <div
                        v-for="r in filteredRoles"
                        :key="r.id"
                        class="group flex items-center justify-between p-1.5 rounded text-xs cursor-pointer transition-colors"
                        :class="[
                          r.id === selectedRoleId
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                        ]"
                        @click="selectRole(r)"
                      >
                        <span class="mr-1.5 text-sm">{{ r.icon }}</span>
                        <div class="flex-1 min-w-0 pr-1">
                          <div class="font-medium text-xs truncate">{{ r.name }}</div>
                          <div class="text-[10px] text-muted-foreground truncate">{{ r.prompt }}</div>
                        </div>

                        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                          <Button variant="ghost" size="icon-xs" class="text-muted-foreground hover:text-foreground" title="编辑" @click="openEditRoleModal(r, $event)">
                            <Pencil class="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon-xs" class="text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="删除" @click="deleteRole(r.id, $event)">
                            <Trash2 class="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <!-- 右侧返回底部按钮 -->
            <Button
              v-if="showScrollBottomBtn"
              variant="ghost"
              size="xs"
              class="gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              title="返回底部"
              @click="scrollToBottomSmooth"
            >
              <ArrowDown class="h-3.5 w-3.5" />
              <span>回到底部</span>
            </Button>
          </div>

          <!-- 附件预览 -->
          <div v-if="attachments.length > 0" class="flex flex-wrap gap-1.5 p-2 bg-muted/20 border-b border-border">
            <div v-for="(att, idx) in attachments" :key="'att-' + idx" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border border-border text-xs">
              <span>{{ att.isImage ? '🖼️' : '📎' }}</span>
              <span class="max-w-[120px] truncate text-[11px]">{{ att.name }}</span>
              <X class="h-2.5 w-2.5 text-muted-foreground hover:text-destructive cursor-pointer shrink-0 transition-colors" @click="removeAttachment(idx)" />
            </div>
          </div>

          <!-- 编辑状态提示条 -->
          <div v-if="editingMsgIndex !== null" class="px-3 py-1 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
            <div class="flex items-center gap-1">
              <Pencil class="h-3.5 w-3.5" />
              <span>正在编辑提问 #{{ editingMsgIndex + 1 }}</span>
            </div>
            <Button variant="link" size="xs" class="p-0 h-auto text-xs text-amber-600 dark:text-amber-400 cursor-pointer" @click="cancelEditingMsg">
              取消编辑
            </Button>
          </div>

          <!-- 输入文本框 -->
          <textarea
            ref="textareaRef"
            v-model="inputPrompt"
            class="w-full px-3.5 py-2.5 text-xs bg-transparent text-foreground outline-none resize-none min-h-[44px] max-h-36 leading-relaxed placeholder:text-muted-foreground"
            placeholder="输入您的问题，Enter 发送，Shift+Enter 换行，支持粘贴图片..."
            rows="2"
            :disabled="isStreaming"
            @keydown="handleKeyDown"
            @paste="handlePaste"
          />

          <!-- 底部发送与模型切换行 -->
          <div class="px-3 py-1.5 flex items-center justify-between border-t border-border/60 bg-muted/20">
            <div class="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-xs"
                class="text-muted-foreground hover:text-foreground cursor-pointer"
                title="上传附件/图片"
                @click="fileInputRef?.click()"
              >
                <Paperclip class="h-3.5 w-3.5" />
              </Button>
              <input ref="fileInputRef" type="file" hidden @change="onFileSelect" />

              <!-- 模型选择 Popover -->
              <Popover v-model:open="modelPopoverVisible">
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    size="xs"
                    class="h-6 gap-1 text-[11px] font-medium text-foreground cursor-pointer"
                  >
                    <span>{{ selectedModel || '暂无模型' }}</span>
                    <ChevronDown class="h-3 w-3 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent side="top" align="start" class="w-60 p-2 shadow-lg">
                  <div class="space-y-1.5">
                    <Input
                      v-model="modelSearchQuery"
                      placeholder="搜索模型..."
                      class="h-7 text-xs w-full"
                    />
                    <div class="max-h-40 overflow-y-auto space-y-0.5">
                      <div
                        v-for="m in filteredModelOptions"
                        :key="m"
                        class="flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors"
                        :class="[
                          m === selectedModel
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                        ]"
                        @click="selectModelOption(m)"
                      >
                        <span class="truncate">{{ m }}</span>
                        <Check v-if="m === selectedModel" class="h-3.5 w-3.5 text-primary" />
                      </div>
                    </div>
                    <div class="pt-1 border-t border-border flex justify-end">
                      <Button variant="link" size="xs" class="p-0 h-auto text-[11px] text-primary cursor-pointer" @click="setDefaultModel">
                        设为默认
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <!-- 发送 / 停止按钮 -->
            <Button
              size="sm"
              class="h-7 gap-1.5 text-xs font-medium"
              :variant="isStreaming ? 'destructive' : 'default'"
              :disabled="!isStreaming && !inputPrompt.trim() && attachments.length === 0"
              @click="isStreaming ? stopGenerating() : sendMessage()"
              :title="isStreaming ? '停止生成' : '发送'"
            >
              <Square v-if="isStreaming" class="h-3.5 w-3.5 fill-current" />
              <Send v-else class="h-3.5 w-3.5" />
              <span>{{ isStreaming ? '停止' : '发送' }}</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>

    <!-- 角色配置/编辑弹窗 -->
    <Dialog :open="showRoleModal" @update:open="showRoleModal = $event">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{{ isEditingExistingRole ? '编辑角色与提示词' : '自定义角色与提示词' }}</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-foreground/80">角色名称</label>
            <Input v-model="editingRole.name" placeholder="例如：安全审计专家、代码架构师..." />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-foreground/80">图标 (Emoji)</label>
            <Input v-model="editingRole.icon" placeholder="⚡" maxlength="4" class="w-20 text-center" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-foreground/80">角色系统提示词 (System Prompt)</label>
            <Textarea
              v-model="editingRole.prompt"
              :rows="5"
              placeholder="详细描述该角色的专业背景、回答风格与输出格式规范..."
              class="resize-none"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showRoleModal = false">取消</Button>
          <Button @click="saveCustomRole">保存并启用</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
