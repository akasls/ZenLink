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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  RotateCw,
  ChevronDown,
  Check,
  Square,
  ArrowUp,
  X,
  VenetianMask,
} from 'lucide-vue-next';

const props = defineProps<{
  active?: boolean;
}>();

const emit = defineEmits<{
  stateChange: [state: {
    conversations: Conversation[];
    activeConversationId: string | null;
    projects: any[];
    selectedProjectId: string | null;
    isPrivateMode: boolean;
  }];
}>();

const authStore = useAuthStore();

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
function handleResize() { isMobile.value = window.innerWidth < 768; }

interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  model: string;
  role_id?: string;
  icon?: string;
  project_id?: string | null;
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

// 私密模式与项目管理状态
const isPrivateMode = ref(false);
const projects = ref<any[]>([]);
const selectedProjectId = ref<string | null>(null);

function togglePrivateMode() {
  isPrivateMode.value = !isPrivateMode.value;
  if (isPrivateMode.value) {
    toast.info('已开启私密模式：本次对话不会保存到历史记录');
    activeConversationId.value = '';
    messages.value = [];
  } else {
    toast.info('已退出私密模式');
    activeConversationId.value = '';
    messages.value = [];
    loadConversations(false);
  }
}

async function loadProjects() {
  try {
    const { data } = await aiApi.getProjects();
    projects.value = data.projects || [];
  } catch (e) {
    console.error('加载项目失败', e);
  }
}

function selectProject(projId: string | null) {
  selectedProjectId.value = projId;
  createNewConversation();
  loadConversations(false);
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
const roleSearchQuery = ref('');
const filteredRoles = computed(() => {
  if (!roleSearchQuery.value.trim()) return roles.value;
  const q = roleSearchQuery.value.trim().toLowerCase();
  return roles.value.filter(r => r.name.toLowerCase().includes(q) || r.prompt.toLowerCase().includes(q));
});

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

function deduplicateRoles(list: RolePreset[]): RolePreset[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const res: RolePreset[] = [];
  for (const r of list) {
    if (!r || !r.id || !r.name) continue;
    const nameKey = r.name.trim().toLowerCase();
    if (seenIds.has(r.id) || seenNames.has(nameKey)) continue;
    seenIds.add(r.id);
    seenNames.add(nameKey);
    res.push(r);
  }
  return res;
}

function loadCustomRoles() {
  try {
    const v2Saved = localStorage.getItem('zenlink_ai_roles_v2');
    if (v2Saved) {
      const parsed: RolePreset[] = JSON.parse(v2Saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        roles.value = deduplicateRoles(parsed);
        return;
      }
    }

    // 兼容迁移旧版本 zenlink_ai_roles 并做深度去重，解决历史重复克隆问题
    const legacySaved = localStorage.getItem('zenlink_ai_roles');
    if (legacySaved) {
      const oldList: RolePreset[] = JSON.parse(legacySaved);
      const merged = deduplicateRoles([...defaultRoles, ...(Array.isArray(oldList) ? oldList : [])]);
      roles.value = merged.length > 0 ? merged : [...defaultRoles];
      localStorage.setItem('zenlink_ai_roles_v2', JSON.stringify(roles.value));
      localStorage.removeItem('zenlink_ai_roles');
    } else {
      roles.value = [...defaultRoles];
      localStorage.setItem('zenlink_ai_roles_v2', JSON.stringify(roles.value));
    }
  } catch {
    roles.value = [...defaultRoles];
  }
}

// 立即在模块顶层加载角色并去重
loadCustomRoles();

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
  const name = editingRole.value.name.trim();
  const prompt = editingRole.value.prompt.trim();
  if (!name) {
    toast.warning('请输入角色名称');
    return;
  }
  if (!prompt) {
    toast.warning('请输入角色的提示词');
    return;
  }

  const existingIdx = roles.value.findIndex(r => r.id === editingRole.value.id);
  if (existingIdx !== -1) {
    // 就地修改已有角色（无论是否原默认角色），不产生重复克隆
    roles.value[existingIdx] = {
      ...roles.value[existingIdx],
      ...editingRole.value,
      name,
      prompt,
    };
  } else {
    // 新增角色
    const newRole: RolePreset = {
      id: editingRole.value.id || ('custom_' + Date.now()),
      name,
      icon: editingRole.value.icon?.trim() || '⚡',
      prompt,
      isCustom: true,
    };
    roles.value.push(newRole);
    editingRole.value.id = newRole.id;
  }

  localStorage.setItem('zenlink_ai_roles_v2', JSON.stringify(roles.value));
  selectedRoleId.value = editingRole.value.id;
  showRoleModal.value = false;
  toast.success(`已保存角色「${name}」`);
}

function deleteRole(roleId: string, e?: Event) {
  e?.stopPropagation();
  if (roles.value.length <= 1) {
    toast.warning('至少需要保留一个助手');
    return;
  }
  roles.value = roles.value.filter(r => r.id !== roleId);
  localStorage.setItem('zenlink_ai_roles_v2', JSON.stringify(roles.value));
  if (selectedRoleId.value === roleId) {
    selectedRoleId.value = roles.value[0]?.id || 'default';
  }
  toast.success('已删除角色');
}

// 会话与消息状态
const conversations = ref<Conversation[]>([]);
const activeConversationId = ref<string>('');


const messages = ref<Message[]>([]);
const inputPrompt = ref('');
const isStreaming = ref(false);
const loadingHistory = ref(false);

const rolePopoverVisible = ref(false);

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

let scrollRafId: number | null = null;

function scrollToBottom(force = false) {
  if (force) {
    nextTick(() => {
      if (chatContainerRef.value) {
        chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
      }
    });
    return;
  }
  if (!shouldAutoScroll) return;
  if (scrollRafId !== null) return;
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null;
    if (chatContainerRef.value && shouldAutoScroll) {
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

async function loadConversations(autoSelect = false) {
  try {
    const { data } = await aiApi.getConversations(selectedProjectId.value || undefined);
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
  cancelEditingMsg();
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
  activeConversationId.value = '';
  messages.value = [];
  attachments.value = [];
  selectedRoleId.value = 'default';
  expandedMsgMap.value = {};
  nextTick(() => textareaRef.value?.focus());
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

  // 如果是在编辑历史提问，从此处截断后续回复并同步清理数据库历史
  if (editingMsgIndex.value !== null && customText === undefined) {
    const editIdx = editingMsgIndex.value;
    editingMsgIndex.value = null;

    const toDelete = messages.value.slice(editIdx);
    const deleteCount = messages.value.length - editIdx;
    messages.value.splice(editIdx, deleteCount);

    if (activeConversationId.value && !isPrivateMode.value) {
      const firstMsgWithId = toDelete.find(m => m.id != null);
      if (firstMsgWithId?.id) {
        try {
          await aiApi.truncateMessagesFrom(activeConversationId.value, firstMsgWithId.id);
        } catch {}
      }
      const idsToDelete = toDelete.filter(m => m.id != null).map(m => m.id!);
      if (idsToDelete.length > 0) {
        await Promise.all(idsToDelete.map(id => aiApi.deleteMessage(id).catch(() => {})));
      }
    }
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
        conversation_id: isPrivateMode.value ? undefined : (activeConversationId.value || undefined),
        message: userDisplayText,
        model: selectedModel.value || undefined,
        role_id: selectedRoleId.value || 'default',
        custom_prompt: currentRole.value.prompt || undefined,
        temperature: aiSettings.value.temperature,
        top_p: aiSettings.value.top_p,
        max_tokens: aiSettings.value.max_tokens,
        is_private: isPrivateMode.value,
        history: isPrivateMode.value
          ? messages.value.slice(0, -2).map(m => ({ role: m.role, content: m.content }))
          : undefined,
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
            if (parsed.conversation_id && !activeConversationId.value && !isPrivateMode.value) {
              activeConversationId.value = parsed.conversation_id;
              aiApi.updateConversation(parsed.conversation_id, {
                title: promptSummary,
                role_id: selectedRoleId.value,
                icon: currentRole.value?.icon || '💬',
                project_id: selectedProjectId.value || null,
              }).catch(() => {});
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
    if (!isPrivateMode.value) {
      loadConversations(false);
      if (activeConversationId.value) {
        try {
          const { data } = await aiApi.getMessages(activeConversationId.value);
          if (data?.messages) {
            messages.value = data.messages;
          }
        } catch {}
      }
    }
  }
}

// 重新生成指定消息
function regenerateMessage(assistantIndex: number) {
  if (isStreaming.value) return;
  const prevUserMsg = messages.value[assistantIndex - 1];
  const curAssistantMsg = messages.value[assistantIndex];
  if (prevUserMsg && prevUserMsg.role === 'user') {
    const userText = prevUserMsg.content;
    if (curAssistantMsg?.id) {
      aiApi.deleteMessage(curAssistantMsg.id).catch(() => {});
    }
    if (prevUserMsg?.id) {
      aiApi.deleteMessage(prevUserMsg.id).catch(() => {});
    }
    messages.value.splice(assistantIndex - 1, 2);
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

function emitState() {
  emit('stateChange', {
    conversations: conversations.value,
    activeConversationId: activeConversationId.value,
    projects: projects.value,
    selectedProjectId: selectedProjectId.value,
    isPrivateMode: isPrivateMode.value,
  });
}

watch(
  [conversations, activeConversationId, projects, selectedProjectId, isPrivateMode],
  () => {
    emitState();
  },
  { deep: true, immediate: true }
);

function initData() {
  if (authStore.isLoggedIn) {
    loadAiSettings();
    loadProjects();
    loadConversations(false);
    loadCustomRoles();
  }
}

watch(
  [() => props.active, () => authStore.isLoggedIn],
  ([isActive, isLoggedIn]) => {
    if (isActive && isLoggedIn) {
      initData();
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('resize', handleResize);
  initData();
});

onUnmounted(() => {
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId);
    scrollRafId = null;
  }
  window.removeEventListener('resize', handleResize);
  stopGenerating();
});

defineExpose({
  createNewConversation,
  selectConversation,
  deleteConversation,
  loadConversations,
  loadProjects,
  selectProject,
  togglePrivateMode,
});
</script>

<template>
  <div class="flex-1 flex flex-col h-full max-h-full min-h-0 w-full min-w-0 max-w-full overflow-hidden bg-[#f8f9fa] dark:bg-background text-foreground selection:bg-primary/10 relative">
      <!-- 1. 顶部控制栏 (极简透视，Grok 风格) -->
      <div class="h-12 px-3 sm:px-5 flex items-center justify-between shrink-0 sticky top-0 z-10 w-full min-w-0 max-w-full bg-transparent">
        <!-- 左上角：精美聊天助手展示与切换 -->
        <div class="flex items-center min-w-0">
          <Popover v-model:open="rolePopoverVisible">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="group h-8 px-1 text-xs text-foreground inline-flex items-center gap-1.5 transition-all cursor-pointer bg-transparent border-none outline-none select-none"
              >
                <!-- 助手图标 (仅图标响应悬浮微缩放) -->
                <div class="size-6 rounded-md flex items-center justify-center text-sm shrink-0 group-hover:scale-110 transition-transform">
                  {{ currentRole?.icon || '🤖' }}
                </div>
                <!-- 助手名称 (不加粗，尺寸适中精炼) 与下拉小箭头 -->
                <div class="flex items-center gap-1 min-w-0">
                  <span class="font-normal text-xs text-foreground/80 group-hover:text-foreground transition-colors truncate max-w-[120px] sm:max-w-[180px]">
                    {{ currentRole?.name || '智能助手' }}
                  </span>
                  <ChevronDown class="size-3 text-muted-foreground/60 group-hover:text-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0" />
                </div>
              </button>
            </PopoverTrigger>

            <PopoverContent side="bottom" align="start" class="w-72 sm:w-80 p-2.5 shadow-xl border-border/80">
              <div class="space-y-2">
                <div class="flex items-center gap-1.5">
                  <Input
                    v-model="roleSearchQuery"
                    placeholder="搜索助手预设..."
                    class="h-8 text-xs flex-1"
                  />
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        size="icon-xs"
                        class="h-8 w-8 shrink-0 cursor-pointer"
                        @click="openAddRoleModal"
                      >
                        <Plus class="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">自定义新助手</TooltipContent>
                  </Tooltip>
                </div>

                <div class="text-[11px] font-medium text-muted-foreground px-1 flex items-center justify-between">
                  <span>选择助手预设</span>
                  <span class="text-[10px] text-muted-foreground/60">{{ filteredRoles.length }} 个预设</span>
                </div>

                <ScrollArea class="h-56">
                  <div class="space-y-1 pr-2">
                    <div
                      v-for="r in filteredRoles"
                      :key="r.id"
                      class="group/item flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors"
                      :class="[
                        r.id === selectedRoleId
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground',
                      ]"
                      @click="selectRole(r)"
                    >
                      <div class="size-7 rounded-md bg-muted flex items-center justify-center mr-2 text-sm shrink-0">
                        {{ r.icon }}
                      </div>
                      <div class="flex-1 min-w-0 pr-1">
                        <div class="font-medium text-xs truncate">
                          {{ r.name }}
                        </div>
                        <div class="text-[11px] text-muted-foreground truncate">{{ r.prompt }}</div>
                      </div>

                      <div class="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity" @click.stop>
                        <Button variant="ghost" size="icon-xs" class="h-6 w-6 text-muted-foreground hover:text-foreground" title="编辑" @click="openEditRoleModal(r, $event)">
                          <Pencil class="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" class="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="删除" @click="deleteRole(r.id, $event)">
                          <Trash2 class="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <!-- 右上角：私密模式切换 (仅图标，极简优雅) -->
        <div class="flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                class="p-1.5 transition-colors cursor-pointer select-none bg-transparent hover:opacity-80 active:scale-95 flex items-center justify-center rounded-lg"
                @click="togglePrivateMode"
              >
                <VenetianMask
                  class="size-5 shrink-0 transition-colors"
                  :class="isPrivateMode ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">无痕模式</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <!-- 2. 主体对话容器 (自适应撑满一屏，内部历史滚动) -->
      <div class="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        <!-- 消息滚动区 -->
        <div
          ref="chatContainerRef"
          class="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center"
          @scroll="onChatScroll"
          @click="handleChatContainerClick"
        >
          <!-- 空状态 (支持常规探索与私密模式呈现) -->
          <div v-if="messages.length === 0" class="my-auto py-16 text-center max-w-lg select-none">
            <template v-if="isPrivateMode">
              <div class="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5 shadow-xs text-primary">
                <VenetianMask class="size-7" />
              </div>
              <h1 class="text-2xl sm:text-3xl font-semibold text-foreground m-0 mb-2.5 tracking-tight">私密对话模式</h1>
              <p class="text-xs sm:text-sm text-muted-foreground m-0 leading-relaxed max-w-sm mx-auto">
                本次会话产生的所有内容均不会写入历史记录或云端服务器，安全无痕。
              </p>
            </template>
            <template v-else>
              <div class="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center text-3xl mx-auto mb-5 shadow-xs">
                {{ currentRole?.icon || '✨' }}
              </div>
              <h1 class="text-2xl sm:text-3xl font-semibold text-foreground m-0 mb-2.5 tracking-tight">我们应该探索什么？</h1>
              <p class="text-xs sm:text-sm text-muted-foreground m-0 leading-relaxed max-w-sm mx-auto">
                当前预设：<strong class="text-foreground font-medium">{{ currentRole?.name || '默认助手' }}</strong> · 智能推理与多轮深度对话
              </p>
            </template>
          </div>

          <!-- 正常对话消息流 -->
          <div v-else class="w-full max-w-3xl space-y-6 pb-6">
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
                  <div class="px-4 py-2.5 bg-muted text-foreground text-xs leading-relaxed rounded-2xl rounded-tr-xs border border-border/80 break-words shadow-2xs">
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
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="text-muted-foreground hover:text-foreground"
                          @click="startEditMsg(index, msg)"
                        >
                          <Pencil class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">编辑</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="text-muted-foreground hover:text-foreground"
                          @click="copyMessage(msg.content)"
                        >
                          <Copy class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">复制</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          @click="deleteMessage(index)"
                        >
                          <Trash2 class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">删除</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </template>

              <!-- AI 回复 -->
              <template v-else>
                <!-- 思考阶段 (无正文内容时)：不显示图标和文字，仅显示动态思考波纹 -->
                <div
                  v-if="!msg.content && isStreaming && index === messages.length - 1"
                  class="flex items-center gap-1.5 py-3.5 px-1 select-none"
                >
                  <span class="inline-block size-2 rounded-full bg-primary animate-bounce" style="animation-duration: 0.85s; animation-delay: 0ms;" />
                  <span class="inline-block size-2 rounded-full bg-primary/80 animate-bounce" style="animation-duration: 0.85s; animation-delay: 170ms;" />
                  <span class="inline-block size-2 rounded-full bg-primary/55 animate-bounce" style="animation-duration: 0.85s; animation-delay: 340ms;" />
                </div>

                <div v-else class="group flex flex-col items-start w-full">
                  <!-- AI 回复正文 (已彻底移除头像，全宽流畅呈现) -->
                  <div
                    v-if="msg.content"
                    class="ai-markdown-body w-full"
                    v-html="renderMarkdown(msg.content)"
                  />

                  <!-- AI 操作栏 (默认常驻显示，提示为：重新生成 复制 删除) -->
                  <div v-if="msg.content && !isStreaming" class="flex items-center gap-1 mt-2.5 select-none">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="h-7 w-7 text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 rounded-md cursor-pointer transition-colors"
                          @click="regenerateMessage(index)"
                        >
                          <RotateCw class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">重新生成</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="h-7 w-7 text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 rounded-md cursor-pointer transition-colors"
                          @click="copyMessage(msg.content)"
                        >
                          <Copy class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">复制</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="h-7 w-7 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-md cursor-pointer transition-colors"
                          @click="deleteMessage(index)"
                        >
                          <Trash2 class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">删除</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- 页面右边中间：章节快速导航工具 (统一小横条规格，与主侧边栏一致的 Tooltip 浮动提示) -->
        <div
          v-if="userQuestions.length >= 1"
          class="absolute right-2 sm:right-3.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end gap-1 py-1.5 select-none max-h-[70vh] overflow-y-auto scrollbar-none"
        >
          <Tooltip
            v-for="(item, qIdx) in userQuestions"
            :key="'nav-chapter-' + item.index"
            :delay-duration="100"
          >
            <TooltipTrigger as-child>
              <button
                type="button"
                class="group/bar relative flex items-center justify-end py-0.5 px-1 cursor-pointer outline-none bg-transparent border-none shrink-0"
                @click="jumpToMessage(item.index)"
              >
                <!-- 章节横条：统一高4px，紧凑间距，默认宽度统一为16px，选中不变宽，仅鼠标悬停时动态变宽至24px -->
                <div
                  class="h-1 min-h-[4px] max-h-[4px] w-4 rounded-full transition-all duration-200 shrink-0 group-hover/bar:w-6 group-hover/bar:bg-neutral-950 dark:group-hover/bar:bg-white"
                  :class="activeChapterMsgIndex === item.index ? 'bg-neutral-950 dark:bg-white' : 'bg-neutral-400 dark:bg-neutral-600'"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="left"
              :side-offset="8"
              class="max-w-[260px] truncate"
            >
              <span class="font-semibold mr-1.5 opacity-80">#{{ qIdx + 1 }}</span>
              <span>{{ item.msg.content || '对话提问' }}</span>
            </TooltipContent>
          </Tooltip>
        </div>

        <!-- 3. 底部输入卡片 (默认多层柔和深阴影，底色与主页完全统一) -->
        <div class="sticky bottom-0 w-full max-w-3xl mx-auto px-4 pb-4 pt-1 bg-gradient-to-t from-[#f8f9fa] via-[#f8f9fa]/90 to-transparent dark:from-background dark:via-background/90 shrink-0">
          <div class="relative rounded-[26px] border border-border/80 dark:border-border/60 bg-card/95 dark:bg-card/80 backdrop-blur-md shadow-xl shadow-black/8 dark:shadow-[0_12px_36px_rgba(0,0,0,0.4)] focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all p-3 sm:p-3.5 flex flex-col gap-2">
            <!-- 附件预览 -->
            <div v-if="attachments.length > 0" class="flex flex-wrap gap-1.5 px-1 py-0.5">
              <div v-for="(att, idx) in attachments" :key="'att-' + idx" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted border border-border text-xs">
                <span>{{ att.isImage ? '🖼️' : '📎' }}</span>
                <span class="max-w-[140px] truncate text-[11px]">{{ att.name }}</span>
                <X class="h-3 w-3 text-muted-foreground hover:text-destructive cursor-pointer shrink-0 transition-colors ml-0.5" @click="removeAttachment(idx)" />
              </div>
            </div>

            <!-- 编辑状态提示条 -->
            <div v-if="editingMsgIndex !== null" class="px-3 py-1 bg-amber-500/10 rounded-lg flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
              <div class="flex items-center gap-1.5">
                <Pencil class="h-3.5 w-3.5" />
                <span>正在编辑提问 #{{ editingMsgIndex + 1 }}</span>
              </div>
              <Button variant="link" size="xs" class="p-0 h-auto text-xs text-amber-600 dark:text-amber-400 cursor-pointer" @click="cancelEditingMsg">
                取消编辑
              </Button>
            </div>

            <!-- 输入文本框 (Grok 占位符 "畅所欲言") -->
            <textarea
              ref="textareaRef"
              v-model="inputPrompt"
              class="w-full px-1.5 py-1 text-xs sm:text-[13px] bg-transparent text-foreground outline-none resize-none min-h-[44px] max-h-48 leading-relaxed placeholder:text-muted-foreground/60 scrollbar-none"
              placeholder="畅所欲言"
              rows="2"
              :disabled="isStreaming"
              @keydown="handleKeyDown"
              @paste="handlePaste"
            />

            <!-- 底部操作行 (左侧：+ 附件；右侧：模型切换与 Grok 圆形发送钮) -->
            <div class="flex items-center justify-between pt-0.5">
              <!-- 左侧操作区 -->
              <div class="flex items-center gap-1.5">
                <!-- + 附件上传按钮 -->
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="size-7 sm:size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors cursor-pointer"
                      @click="fileInputRef?.click()"
                    >
                      <Plus class="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">上传附件 / 图片</TooltipContent>
                </Tooltip>
                <input ref="fileInputRef" type="file" hidden @change="onFileSelect" />
              </div>

              <!-- 右侧操作区：模型选择 + 圆形 Grok 发送钮 -->
              <div class="flex items-center gap-2">
                <!-- 模型选择 Popover (与左上角助手一致的通透样式，无底色包裹) -->
                <Popover v-model:open="modelPopoverVisible">
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      class="group h-7 sm:h-8 px-2.5 sm:px-3 rounded-full hover:bg-muted/80 active:bg-muted data-[state=open]:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-all cursor-pointer border border-transparent hover:border-border/40 data-[state=open]:border-border/40 select-none"
                    >
                      <span class="max-w-[130px] truncate text-[11px] sm:text-xs font-medium text-foreground/80 group-hover:text-foreground">{{ selectedModel || '暂无模型' }}</span>
                      <ChevronDown class="size-3 text-muted-foreground/70 group-hover:text-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0" />
                    </button>
                  </PopoverTrigger>

                  <PopoverContent side="top" align="end" class="w-64 p-2 shadow-lg">
                    <div class="space-y-1.5">
                      <Input
                        v-model="modelSearchQuery"
                        placeholder="搜索模型..."
                        class="h-7 text-xs w-full"
                      />
                      <ScrollArea class="h-40">
                        <div class="space-y-0.5 pr-2">
                          <div
                            v-for="m in filteredModelOptions"
                            :key="m"
                            class="flex items-center justify-between px-2 py-1 rounded-md text-xs cursor-pointer transition-colors"
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
                      </ScrollArea>
                      <div class="pt-1 border-t border-border flex justify-end">
                        <Button variant="link" size="xs" class="p-0 h-auto text-[11px] text-primary cursor-pointer" @click="setDefaultModel">
                          设为默认模型
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <!-- 发送 / 停止圆形按钮 (原生纯圆高亮箭头钮) -->
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="size-8 rounded-full flex items-center justify-center transition-all cursor-pointer select-none"
                      :class="[
                        isStreaming
                          ? 'bg-destructive text-destructive-foreground hover:opacity-90 active:scale-95'
                          : (inputPrompt.trim() || attachments.length > 0)
                            ? 'bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm active:scale-95'
                            : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                      ]"
                      :disabled="!isStreaming && !inputPrompt.trim() && attachments.length === 0"
                      @click="isStreaming ? stopGenerating() : sendMessage()"
                    >
                      <Square v-if="isStreaming" class="size-3.5 fill-current" />
                      <ArrowUp v-else class="size-4 stroke-[2.5]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {{ isStreaming ? '停止生成' : '发送 (Enter)' }}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
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

          <DialogFooter class="gap-2">
            <Button variant="outline" @click="showRoleModal = false">取消</Button>
            <Button @click="saveCustomRole">保存并启用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
</template>
