<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { noteApi, noteCategoryApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/components/ui/sonner';
import { confirmBox } from '@/utils/confirm';
import { renderMarkdown, handleCodeCopyClick } from '@/utils/markdown';
import { mapIcon } from '@/utils/icon-map';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Search,
  Plus,
  ArrowLeft,
  Pencil,
  Eye,
  Tag,
  Folder,
  Loader2,
  FileText,
  Share2,
  Copy,
  Trash2,
  Sparkles,
  Sliders,
  Brush,
  Scissors,
  FilePlus,
  BookOpen,
  FileSpreadsheet,
  Languages,
  Quote,
  CheckSquare,
  List,
  Table,
  Link,
  Minus,
  X,
  Paperclip,
  CheckCircle2,
} from 'lucide-vue-next';

const props = defineProps<{
  active?: boolean;
}>();

const emit = defineEmits<{
  stateChange: [state: {
    notes: Note[];
    tags: { name: string; count: number }[];
    categories: { id: number; name: string; count?: number; icon?: string }[];
    selectedTag: string | null;
    selectedCategoryId: number | null;
    selectedNoteId: number | null;
  }];
}>();

const authStore = useAuthStore();

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
const isMobileSearchOpen = ref(false);
const isSearchOpen = ref(false);

function onResize() {
  const mobile = window.innerWidth < 768;
  isMobile.value = mobile;
  if (mobile) {
    if (viewMode.value === 'split') {
      viewMode.value = 'edit';
    }
  } else {
    isMobileSearchOpen.value = false;
    if (viewMode.value === 'edit' || viewMode.value === 'preview') {
      viewMode.value = 'split';
    }
  }
}
onMounted(() => {
  window.addEventListener('resize', onResize);
});
onUnmounted(() => {
  window.removeEventListener('resize', onResize);
});

interface NoteTag {
  name: string;
  count: number;
}

interface Note {
  id: number;
  title: string;
  content: string;
  category_id?: number | null;
  tags?: string[];
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

interface NoteShareItem {
  id: string;
  note_id: number;
  password?: string | null;
  expires_at?: string | null;
  burn_after_reading: number;
  views_count: number;
  created_at: string;
}

interface NoteCategory {
  id: number;
  name: string;
  icon?: string;
  count?: number;
}

const notes = ref<Note[]>([]);
const availableTags = ref<NoteTag[]>([]);
const noteCategories = ref<NoteCategory[]>([]);
const selectedTag = ref<string | null>(null);
const selectedCategoryId = ref<number | null>(null);
const selectedNoteCategoryId = ref<number | null>(null);
const selectedNote = ref<Note | null>(null);
const searchQuery = ref('');
const loading = ref(false);
const showCategoryManageModal = ref(false);
const newCategoryName = ref('');
const isCategoryPopoverVisible = ref(false);

// 视图模式: PC 端默认 'split' (双栏对照)，移动端 'edit' (纯编辑) / 'preview' (纯预览)
const viewMode = ref<'edit' | 'split' | 'preview'>(
  typeof window !== 'undefined' && window.innerWidth >= 768 ? 'split' : 'edit'
);

// 编辑器状态
const editTitle = ref('');
const editContent = ref('');
const editTags = ref<string[]>([]);
const newTagInput = ref('');
const isTagInputVisible = ref(false);
const isTagPopoverVisible = ref(false);
function setEditMode() {
  viewMode.value = isMobile.value ? 'edit' : 'split';
}
function setPreviewMode() {
  viewMode.value = 'preview';
}
function setScrollSource(_src: 'editor' | 'preview') {}
const isAiWorking = ref(false);

const saveStatus = ref<'saved' | 'saving' | 'unsaved'>('saved');
const lastSavedTime = ref<string>('');
const autoSaveTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const previewWrapperRef = ref<HTMLElement | null>(null);
const noteFileInputRef = ref<HTMLInputElement | null>(null);
const uploadingNoteFile = ref(false);
const showImgViewer = ref(false);


const previewImgUrlList = ref<string[]>([]);




// 分享模态框状态
const showShareModal = ref(false);
const targetNoteForShare = ref<Note | null>(null);
const activeShareTab = ref<'create' | 'history'>('create');
const shareForm = ref({
  password: '',
  expire_hours: 24,
  burn_after_reading: false,
});
const createdShare = ref<{
  id: string;
  url: string;
  password?: string;
  expires_at?: string | null;
  burn_after_reading?: boolean;
} | null>(null);
const creatingShare = ref(false);
const noteShareHistory = ref<NoteShareItem[]>([]);
const loadingHistory = ref(false);

// 拖拽排序状态 (笔记卡片)
const draggedNoteIndex = ref<number | null>(null);
const dragOverNoteIndex = ref<number | null>(null);

// 双栏同步滚动
let isSyncingScroll = false;

function onEditorScroll() {
  if (isSyncingScroll || viewMode.value !== 'split') return;
  isSyncingScroll = true;
  const textarea = textareaRef.value;
  const preview = previewWrapperRef.value;
  if (textarea && preview) {
    const maxTextarea = textarea.scrollHeight - textarea.clientHeight;
    const maxPreview = preview.scrollHeight - preview.clientHeight;
    if (maxTextarea > 0 && maxPreview > 0) {
      const ratio = textarea.scrollTop / maxTextarea;
      preview.scrollTop = ratio * maxPreview;
    }
  }
  requestAnimationFrame(() => {
    isSyncingScroll = false;
  });
}

function onPreviewScroll() {
  if (isSyncingScroll || viewMode.value !== 'split') return;
  isSyncingScroll = true;
  const textarea = textareaRef.value;
  const preview = previewWrapperRef.value;
  if (textarea && preview) {
    const maxTextarea = textarea.scrollHeight - textarea.clientHeight;
    const maxPreview = preview.scrollHeight - preview.clientHeight;
    if (maxTextarea > 0 && maxPreview > 0) {
      const ratio = preview.scrollTop / maxPreview;
      textarea.scrollTop = ratio * maxTextarea;
    }
  }
  requestAnimationFrame(() => {
    isSyncingScroll = false;
  });
}

const filteredNotes = computed(() => {
  let list = notes.value;
  if (selectedCategoryId.value !== null) {
    list = list.filter(n => n.category_id === selectedCategoryId.value);
  }
  if (selectedTag.value) {
    list = list.filter(n => Array.isArray(n.tags) && n.tags.includes(selectedTag.value!));
  }
  if (!searchQuery.value.trim()) return list;
  const q = searchQuery.value.trim().toLowerCase();
  return list.filter(
    n =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q)) ||
      (Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(q)))
  );
});

const totalNoteCount = computed(() => notes.value.length);

const noteCategoriesWithCount = computed(() => {
  return noteCategories.value.map(c => {
    const count = notes.value.filter(n => n.category_id === c.id).length;
    return { ...c, count };
  });
});

const currentNoteCategoryName = computed(() => {
  if (!selectedNoteCategoryId.value) return '未分类';
  const found = noteCategories.value.find(c => c.id === selectedNoteCategoryId.value);
  return found ? found.name : '未分类';
});

function getCategoryName(catId?: number | null) {
  if (!catId) return '';
  const found = noteCategories.value.find(c => c.id === catId);
  return found ? found.name : '';
}

function getCategoryIcon(catId?: number | null) {
  if (!catId) return '';
  const found = noteCategories.value.find(c => c.id === catId);
  return found?.icon || '';
}

async function loadCategories() {
  if (!authStore.isLoggedIn) return;
  try {
    const { data } = await noteCategoryApi.getAll();
    noteCategories.value = data.categories || [];
  } catch (e) {
    console.error('loadCategories error', e);
  }
}

async function handleCreateCategory() {
  const name = newCategoryName.value.trim();
  if (!name) return;
  try {
    const { data } = await noteCategoryApi.create({ name });
    noteCategories.value.push(data.category);
    newCategoryName.value = '';
    toast.success('分类创建成功');
  } catch (err: any) {
    toast.error(err.response?.data?.error || '创建分类失败');
  }
}

async function handleDeleteCategory(id: number) {
  try {
    await noteCategoryApi.delete(id);
    noteCategories.value = noteCategories.value.filter(c => c.id !== id);
    if (selectedCategoryId.value === id) selectedCategoryId.value = null;
    if (selectedNoteCategoryId.value === id) {
      selectedNoteCategoryId.value = null;
      saveNote();
    }
    toast.success('分类已删除');
    loadNotes();
  } catch (err: any) {
    toast.error(err.response?.data?.error || '删除分类失败');
  }
}

function filterByCategory(catId: number | null) {
  selectedCategoryId.value = catId;
  selectedNote.value = null;
  loadNotes();
}

function setNoteCategory(catId: number | null) {
  selectedNoteCategoryId.value = catId;
  if (selectedNote.value) {
    selectedNote.value.category_id = catId;
  }
  saveNote();
}

function openManageCategories() {
  showCategoryManageModal.value = true;
}

async function loadTags() {
  if (!authStore.isLoggedIn) return;
  try {
    const { data } = await noteApi.getTags();
    availableTags.value = data.tags || [];
  } catch (e) {
    console.error('loadTags error', e);
  }
}

async function loadNotes() {
  if (!authStore.isLoggedIn) return;
  loading.value = true;
  try {
    const params: any = {};
    if (selectedTag.value) params.tag = selectedTag.value;
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim();
    const { data } = await noteApi.getAll(params);
    notes.value = data.notes || [];

    if (selectedNote.value) {
      const refreshed = notes.value.find(n => n.id === selectedNote.value!.id);
      if (refreshed) {
        selectedNote.value = refreshed;
      }
    }
  } catch (e) {
    console.error('loadNotes error', e);
  } finally {
    loading.value = false;
  }
}

function filterByTag(tag: string | null) {
  selectedTag.value = tag;
  selectedNote.value = null; // 切换标签回到列表卡片视图
  loadNotes();
}

function selectNote(note: Note) {
  if (selectedNote.value && autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value);
    saveNote();
  }
  selectedNote.value = note;
  editTitle.value = note.title || '';
  editContent.value = note.content || '';
  selectedNoteCategoryId.value = note.category_id || null;
  editTags.value = Array.isArray(note.tags) ? [...note.tags] : [];
  isTagInputVisible.value = false;
  newTagInput.value = '';
  saveStatus.value = 'saved';

  if (note.updated_at) {
    const d = new Date(note.updated_at.endsWith('Z') ? note.updated_at : note.updated_at + 'Z');
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const s = d.getSeconds().toString().padStart(2, '0');
    lastSavedTime.value = `${h}:${m}:${s}`;
  } else {
    lastSavedTime.value = '';
  }

  if (isMobile.value) {
    viewMode.value = 'edit';
  } else {
    viewMode.value = 'split'; // PC 端默认分栏
  }

  nextTick(() => {
    textareaRef.value?.focus();
  });
}

// 标签管理
function addTag() {
  const val = newTagInput.value.trim();
  if (val && !editTags.value.includes(val)) {
    editTags.value.push(val);
    saveNote();
    loadTags();
  }
  newTagInput.value = '';
  isTagInputVisible.value = false;
}

function removeTag(tag: string) {
  editTags.value = editTags.value.filter(t => t !== tag);
  saveNote();
  loadTags();
}

// 点击新建：如果存在没有内容的笔记就直接定位，不重复创建空白笔记
async function createNote() {
  const existingEmptyNote = notes.value.find(n => {
    const hasNoContent = !n.content || !n.content.trim();
    const isDefaultOrEmptyTitle = !n.title || n.title.trim() === '未命名笔记' || !n.title.trim();
    return hasNoContent && isDefaultOrEmptyTitle;
  });

  if (existingEmptyNote) {
    selectNote(existingEmptyNote);
    toast.info('已定位到未编写的空白笔记');
    return;
  }

  try {
    const { data } = await noteApi.create({
      title: '未命名笔记',
      categoryId: selectedCategoryId.value || undefined,
      tags: selectedTag.value ? [selectedTag.value] : [],
    });
    await loadNotes();
    await loadTags();
    selectNote(data.note);
    nextTick(() => {
      textareaRef.value?.focus();
    });
  } catch {
    toast.error('创建笔记失败');
  }
}

async function saveNote() {
  if (!selectedNote.value) return;
  saveStatus.value = 'saving';
  try {
    const updatedTitle = editTitle.value || '未命名笔记';
    const updatedContent = editContent.value;
    const updatedTags = [...editTags.value];

    await noteApi.update(selectedNote.value.id, {
      title: updatedTitle,
      content: updatedContent,
      categoryId: selectedNoteCategoryId.value,
      tags: updatedTags,
    });

    const idx = notes.value.findIndex(n => n.id === selectedNote.value!.id);
    const nowIso = new Date().toISOString();
    if (idx >= 0) {
      notes.value[idx].title = updatedTitle;
      notes.value[idx].content = updatedContent;
      notes.value[idx].category_id = selectedNoteCategoryId.value;
      notes.value[idx].tags = updatedTags;
      notes.value[idx].updated_at = nowIso;
    }
    selectedNote.value.title = updatedTitle;
    selectedNote.value.content = updatedContent;
    selectedNote.value.category_id = selectedNoteCategoryId.value;
    selectedNote.value.tags = updatedTags;
    selectedNote.value.updated_at = nowIso;

    saveStatus.value = 'saved';
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    lastSavedTime.value = `${h}:${m}:${s}`;
  } catch (err) {
    saveStatus.value = 'unsaved';
    console.error('Save note error', err);
  }
}

// 自动保存防抖 (500ms)
watch([editTitle, editContent], () => {
  if (!selectedNote.value) return;
  if (editTitle.value === selectedNote.value.title && editContent.value === selectedNote.value.content) {
    return;
  }
  saveStatus.value = 'unsaved';
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
  autoSaveTimer.value = setTimeout(saveNote, 500);
});

async function deleteNote(note: Note, e?: Event) {
  e?.stopPropagation();
  try {
    await confirmBox(`确定删除笔记「${note.title}」？删除后不可恢复。`, '确认删除');
    await noteApi.delete(note.id);
    if (selectedNote.value?.id === note.id) {
      selectedNote.value = null;
    }
    await loadNotes();
    await loadTags();
    toast.success('已删除笔记');
  } catch {}
}

// ===== 分享相关逻辑 =====
async function loadNoteShareHistory(noteId: number) {
  loadingHistory.value = true;
  try {
    const { data } = await noteApi.getShares(noteId);
    noteShareHistory.value = data.shares || [];
  } catch {
    noteShareHistory.value = [];
  } finally {
    loadingHistory.value = false;
  }
}

function openShareModal(note?: Note | null, e?: Event) {
  e?.stopPropagation();
  targetNoteForShare.value = note || selectedNote.value;
  if (!targetNoteForShare.value) return;
  shareForm.value = {
    password: '',
    expire_hours: 24,
    burn_after_reading: false,
  };
  createdShare.value = null;
  activeShareTab.value = 'create';
  loadNoteShareHistory(targetNoteForShare.value.id);
  showShareModal.value = true;
}

function generateRandomPassword() {
  const chars = '0123456789';
  let pwd = '';
  for (let i = 0; i < 4; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  shareForm.value.password = pwd;
}

async function submitCreateShare() {
  if (!targetNoteForShare.value) return;
  creatingShare.value = true;
  try {
    const { data } = await noteApi.createShare(targetNoteForShare.value.id, {
      password: shareForm.value.password ? shareForm.value.password.trim() : undefined,
      expire_hours: Number(shareForm.value.expire_hours),
      burn_after_reading: shareForm.value.burn_after_reading,
    });
    const shareUrl = `${window.location.origin}/share/${data.share.id}`;
    createdShare.value = {
      id: data.share.id,
      url: shareUrl,
      password: data.share.password,
      expires_at: data.share.expires_at,
      burn_after_reading: data.share.burn_after_reading,
    };
    await loadNoteShareHistory(targetNoteForShare.value.id);
    toast.success('笔记分享链接已生成');
  } catch (err: any) {
    toast.error(err.response?.data?.error || '生成分享链接失败');
  } finally {
    creatingShare.value = false;
  }
}

function copyShareLink(withPassword = true) {
  if (!createdShare.value) return;
  let text = `【ZenLink 笔记分享】${targetNoteForShare.value?.title || '未命名笔记'}\n链接：${createdShare.value.url}`;
  if (withPassword && createdShare.value.password) {
    text += `\n提取密码：${createdShare.value.password}`;
  }
  navigator.clipboard.writeText(text).then(() => {
    toast.success('分享链接与密码已复制到剪贴板');
  });
}

function copyHistoryShare(item: NoteShareItem) {
  const url = `${window.location.origin}/share/${item.id}`;
  let text = `【ZenLink 笔记分享】${targetNoteForShare.value?.title || '未命名笔记'}\n链接：${url}`;
  if (item.password) {
    text += `\n提取密码：${item.password}`;
  }
  navigator.clipboard.writeText(text).then(() => {
    toast.success('历史分享链接已复制到剪贴板');
  });
}

async function revokeShare(item: NoteShareItem) {
  try {
    await noteApi.deleteShare(item.id);
    toast.success('已撤销该分享链接');
    if (targetNoteForShare.value) {
      loadNoteShareHistory(targetNoteForShare.value.id);
    }
  } catch {
    toast.error('撤销失败');
  }
}

// ===== 拖拽排序 (笔记卡片) =====
function onNoteDragStart(index: number, e: DragEvent) {
  draggedNoteIndex.value = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }
}

function onNoteDragOver(index: number, e: DragEvent) {
  e.preventDefault();
  if (draggedNoteIndex.value === null || draggedNoteIndex.value === index) return;
  dragOverNoteIndex.value = index;
}

async function onNoteDrop(index: number) {
  if (draggedNoteIndex.value === null || draggedNoteIndex.value === index) {
    draggedNoteIndex.value = null;
    dragOverNoteIndex.value = null;
    return;
  }
  const item = notes.value.splice(draggedNoteIndex.value, 1)[0];
  notes.value.splice(index, 0, item);
  draggedNoteIndex.value = null;
  dragOverNoteIndex.value = null;
  const ids = notes.value.map(n => n.id);
  try {
    await noteApi.reorder(ids);
  } catch {
    toast.error('笔记排序保存失败');
  }
}

function onNoteDragEnd() {
  draggedNoteIndex.value = null;
  dragOverNoteIndex.value = null;
}

// ==================== 快捷插入与排版支持 ====================
function insertWrap(prefix: string, suffix: string, defaultText = '文本') {
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const oldText = editContent.value;
  const selected = oldText.substring(start, end);

  const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${defaultText}${suffix}`;
  editContent.value = oldText.substring(0, start) + replacement + oldText.substring(end);

  nextTick(() => {
    textarea.focus();
    if (!selected) {
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + defaultText.length);
    } else {
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }
  });
}

function insertHeading(level: string) {
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const oldText = editContent.value;

  const lineStart = oldText.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = oldText.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? oldText.length : lineEndIdx;

  const block = oldText.substring(lineStart, lineEnd);
  const lines = block.split('\n');

  const lvl = parseInt(level, 10);
  const prefix = lvl > 0 ? '#'.repeat(lvl) + ' ' : '';

  const newLines = lines.map(l => {
    const clean = l.replace(/^#+\s*/, '');
    return prefix + clean;
  });

  const replacement = newLines.join('\n');
  editContent.value = oldText.substring(0, lineStart) + replacement + oldText.substring(lineEnd);

  nextTick(() => {
    textarea.focus();
    if (start === end) {
      const delta = replacement.length - block.length;
      const targetPos = Math.max(lineStart, start + delta);
      textarea.setSelectionRange(targetPos, targetPos);
    } else {
      textarea.setSelectionRange(lineStart, lineStart + replacement.length);
    }
  });
}

function insertBlockPrefix(prefix: string) {
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const oldText = editContent.value;

  const lineStart = oldText.lastIndexOf('\n', start - 1) + 1;
  const lineEndIdx = oldText.indexOf('\n', end);
  const lineEnd = lineEndIdx === -1 ? oldText.length : lineEndIdx;

  const block = oldText.substring(lineStart, lineEnd);
  const lines = block.split('\n');

  const allPrefixed = lines.every(l => l.startsWith(prefix));
  let newLines: string[];
  if (allPrefixed) {
    newLines = lines.map(l => l.slice(prefix.length));
  } else {
    newLines = lines.map((l, idx) => {
      if (prefix.startsWith('#')) {
        return `${prefix}${l.replace(/^#+\s*/, '')}`;
      }
      if (prefix === '1. ') {
        return `${idx + 1}. ${l.replace(/^(\d+\.|\-|\*)\s*/, '')}`;
      }
      return `${prefix}${l.replace(/^(\-|\*|\d+\.)\s*/, '')}`;
    });
  }

  const replacement = newLines.join('\n');
  editContent.value = oldText.substring(0, lineStart) + replacement + oldText.substring(lineEnd);

  nextTick(() => {
    textarea.focus();
    if (start === end) {
      const delta = replacement.length - block.length;
      const targetPos = Math.max(lineStart, start + delta);
      textarea.setSelectionRange(targetPos, targetPos);
    } else {
      textarea.setSelectionRange(lineStart, lineStart + replacement.length);
    }
  });
}

function insertTable() {
  const tableTpl = '\n| 标题 1 | 标题 2 | 标题 3 |\n| --- | --- | --- |\n| 内容 1 | 内容 2 | 内容 3 |\n';
  insertWrap(tableTpl, '', '');
}

function insertLink() {
  const textarea = textareaRef.value;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = editContent.value.substring(start, end);
  if (selected) {
    insertWrap('[', '](https://)', selected);
  } else {
    insertWrap('[链接文本](https://', ')', 'example.com');
  }
}

function clearFormatting() {
  const textarea = textareaRef.value;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const oldText = editContent.value;
  const selected = oldText.substring(start, end);
  if (!selected) {
    toast.info('请先选中需要清除格式的文本');
    return;
  }
  const clean = selected.replace(/[#*`~_>\-\[\]()|!]/g, '').trim();
  editContent.value = oldText.substring(0, start) + clean + oldText.substring(end);
  nextTick(() => {
    textarea.focus();
    textarea.setSelectionRange(start, start + clean.length);
  });
  toast.success('已清除选中文字格式');
}

function undoText() {
  document.execCommand('undo');
}

function redoText() {
  document.execCommand('redo');
}

// 键盘快捷键 (Ctrl+B/I/S, Tab, Enter智能列表)
function handleTextareaKeyDown(e: KeyboardEvent) {
  const textarea = textareaRef.value;
  if (!textarea) return;

  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      insertWrap('**', '**', '加粗文本');
      return;
    }
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      insertWrap('*', '*', '斜体文本');
      return;
    }
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      saveNote();
      toast.success('笔记已保存');
      return;
    }
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const oldText = editContent.value;

    if (e.shiftKey) {
      const lineStart = oldText.lastIndexOf('\n', start - 1) + 1;
      if (oldText.substring(lineStart, lineStart + 2) === '  ') {
        editContent.value = oldText.substring(0, lineStart) + oldText.substring(lineStart + 2);
        nextTick(() => {
          textarea.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2));
        });
      }
    } else {
      editContent.value = oldText.substring(0, start) + '  ' + oldText.substring(end);
      nextTick(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      });
    }
    return;
  }

  if (e.key === 'Enter') {
    const start = textarea.selectionStart;
    const oldText = editContent.value;
    const lineStart = oldText.lastIndexOf('\n', start - 1) + 1;
    const currentLine = oldText.substring(lineStart, start);

    const taskMatch = currentLine.match(/^(\s*-\s*\[[\sxX]\]\s+)/);
    if (taskMatch) {
      e.preventDefault();
      if (currentLine.trim() === '- [ ]' || currentLine.trim() === '- [x]') {
        editContent.value = oldText.substring(0, lineStart) + oldText.substring(start);
        nextTick(() => {
          textarea.setSelectionRange(lineStart, lineStart);
        });
      } else {
        const nextTask = '\n- [ ] ';
        editContent.value = oldText.substring(0, start) + nextTask + oldText.substring(start);
        nextTick(() => {
          textarea.setSelectionRange(start + nextTask.length, start + nextTask.length);
        });
      }
      return;
    }

    const listMatch = currentLine.match(/^(\s*(\-|\*)\s+)/);
    if (listMatch) {
      e.preventDefault();
      if (currentLine.trim() === '-' || currentLine.trim() === '*') {
        editContent.value = oldText.substring(0, lineStart) + oldText.substring(start);
        nextTick(() => {
          textarea.setSelectionRange(lineStart, lineStart);
        });
      } else {
        const nextList = '\n' + listMatch[1];
        editContent.value = oldText.substring(0, start) + nextList + oldText.substring(start);
        nextTick(() => {
          textarea.setSelectionRange(start + nextList.length, start + nextList.length);
        });
      }
      return;
    }

    const numMatch = currentLine.match(/^(\s*(\d+)\.\s+)/);
    if (numMatch) {
      e.preventDefault();
      const num = parseInt(numMatch[2], 10);
      if (currentLine.trim() === `${num}.`) {
        editContent.value = oldText.substring(0, lineStart) + oldText.substring(start);
        nextTick(() => {
          textarea.setSelectionRange(lineStart, lineStart);
        });
      } else {
        const nextNum = `\n${num + 1}. `;
        editContent.value = oldText.substring(0, start) + nextNum + oldText.substring(start);
        nextTick(() => {
          textarea.setSelectionRange(start + nextNum.length, start + nextNum.length);
        });
      }
      return;
    }
  }
}

// 格式化文件大小
function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

// 粘贴上传支持：图片或任意文件精准插入到当前光标所在位置
async function handleNotesPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        await uploadFileToNotes(file);
        return;
      }
    }
  }
}

function triggerNoteFileUpload() {
  noteFileInputRef.value?.click();
}

async function onNoteFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      await uploadFileToNotes(files[i]);
    }
    target.value = "";
  }
}

// 精准插入光标处
async function uploadFileToNotes(file: File) {
  uploadingNoteFile.value = true;
  const textarea = textareaRef.value;
  const insertStart = textarea ? textarea.selectionStart : editContent.value.length;
  const insertEnd = textarea ? textarea.selectionEnd : editContent.value.length;

  try {
    const { data } = await noteApi.uploadAttachment(file);
    const fileInfo = data.file;
    const isImage = file.type.startsWith("image/") || fileInfo?.isImage;
    const fileName = file.name || "附件";
    const previewUrl = fileInfo?.url || ("/api/notes/raw/" + fileInfo?.path);
    const downloadUrl = fileInfo?.downloadUrl || previewUrl;

    let markdownSnippet = "";
    if (isImage) {
      markdownSnippet = "\n\n![" + fileName + "](" + previewUrl + ")\n\n";
    } else {
      const sizeTag = formatFileSize(file.size);
      markdownSnippet = "\n\n[📎 下载附件: " + fileName + " (" + sizeTag + ")](" + downloadUrl + ")\n\n";
    }

    const oldText = editContent.value;
    editContent.value = oldText.substring(0, insertStart) + markdownSnippet + oldText.substring(insertEnd);

    nextTick(() => {
      if (textarea) {
        textarea.focus();
        const nextPos = insertStart + markdownSnippet.length;
        textarea.setSelectionRange(nextPos, nextPos);
      }
    });

    toast.success((isImage ? "图片" : "附件") + "「" + fileName + "」已插入当前光标处");
    saveNote();
  } catch (err: any) {
    toast.error(err.response?.data?.error || "上传失败，请检查存储配置");
  } finally {
    uploadingNoteFile.value = false;
  }
}

// 预览区交互：支持点击图片全屏大图预览、点击附件下载、点击复选框勾选、复制代码
function handlePreviewClick(e: MouseEvent) {
  if (handleCodeCopyClick(e)) return;
  const target = e.target as HTMLElement;

  // 1. 点击图片 -> 全屏大图灯箱预览
  if (target && target.tagName === "IMG") {
    e.preventDefault();
    e.stopPropagation();
    const src = target.getAttribute("src");
    if (src) {
      previewImgUrlList.value = [src];
      showImgViewer.value = true;
      return;
    }
  }

  // 2. 点击附件链接 -> 下载附件文件
  const link = target.closest("a");
  if (link) {
    const href = link.getAttribute("href");
    if (href && (href.includes("/notes/download/") || href.includes("/notes/raw/") || href.startsWith("/api/") || href.startsWith("blob:"))) {
      e.preventDefault();
      e.stopPropagation();
      const a = document.createElement("a");
      a.href = href;
      a.download = link.textContent?.replace(/[📎\[\]]/g, "").trim() || "attachment";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("正在下载附件...");
      return;
    }
  }

  // 3. 点击交互式清单复选框
  if (target && target.tagName === "INPUT" && target.getAttribute("type") === "checkbox") {
    const isChecked = (target as HTMLInputElement).checked;
    const taskItem = target.closest("li");
    if (!taskItem) return;
    const textContent = taskItem.textContent?.trim() || "";
    if (!textContent) return;

    const oldText = editContent.value;
    const escapedText = textContent.replace(/[.*+?^${}()|[\]\\]/g, "\\// ==================== AI 智能写作协同引擎 ====================");
    const regex = new RegExp("- \\[([ xX])\\]\\s*" + escapedText, "m");
    const match = oldText.match(regex);
    if (match) {
      const nextBox = isChecked ? "- [x] " : "- [ ] ";
      editContent.value = oldText.replace(regex, nextBox + textContent);
      saveNote();
    }
  }
}

// ==================== AI 智能写作协同引擎 ====================
const showAiPromptDialog = ref(false);
const customAiPrompt = ref('');
let aiAbortController: AbortController | null = null;

function handleAiCommand(cmd: string) {
  if (cmd === 'title_and_tags') {
    generateAiTitleAndTags();
  } else if (cmd === 'custom') {
    customAiPrompt.value = '';
    showAiPromptDialog.value = true;
  } else {
    runAiAction(cmd);
  }
}

async function runAiAction(action: string, customInstruction = '') {
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = editContent.value.substring(start, end).trim();
  const contextText = selectedText || editContent.value.trim();

  if (!contextText && action !== 'continue') {
    toast.warning('请先输入或选择笔记内容');
    return;
  }

  isAiWorking.value = true;
  aiAbortController = new AbortController();

  try {
    const res = await fetch('/api/ai/writing-assistant', {
      method: 'POST',
      signal: aiAbortController.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: localStorage.getItem('zenlink_token') ? `Bearer ${localStorage.getItem('zenlink_token')}` : '',
      },
      body: JSON.stringify({
        action,
        content: contextText,
        instruction: customInstruction,
      }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullGenerated = '';

    if (reader) {
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
          if (dataStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) {
              fullGenerated += parsed.text;
            }
          } catch {}
        }
      }
    }

    if (fullGenerated) {
      if (selectedText) {
        editContent.value = editContent.value.substring(0, start) + fullGenerated + editContent.value.substring(end);
      } else {
        editContent.value = editContent.value + (editContent.value ? '\n\n' : '') + fullGenerated;
      }
      toast.success('AI 写作协同完成');
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      toast.error('AI 协同响应失败');
    }
  } finally {
    isAiWorking.value = false;
  }
}

// AI 智能同时提炼标题和标签
async function generateAiTitleAndTags() {
  if (!selectedNote.value) return;
  const noteText = (editTitle.value + '\n\n' + editContent.value).trim();
  if (!noteText) {
    toast.warning('请先撰写笔记正文');
    return;
  }

  isAiWorking.value = true;
  try {
    const res = await fetch('/api/ai/writing-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: localStorage.getItem('zenlink_token') ? `Bearer ${localStorage.getItem('zenlink_token')}` : '',
      },
      body: JSON.stringify({
        action: 'title_and_tags',
        content: noteText.slice(0, 1500),
      }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let resultText = '';

    if (reader) {
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
          if (dataStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.text) resultText += parsed.text;
          } catch {}
        }
      }
    }

    try {
      const cleaned = resultText.replace(/\`\`\`json|\`\`\`/g, '').trim();
      const data = JSON.parse(cleaned);
      if (data.title) {
        editTitle.value = data.title.replace(/^["'《]+|["'》]+$/g, '').trim();
      }
      if (Array.isArray(data.tags) && data.tags.length > 0) {
        const set = new Set([...editTags.value, ...data.tags]);
        editTags.value = Array.from(set);
      }
      saveNote();
      loadTags();
      toast.success(`AI 已生成标题「${data.title || editTitle.value}」与标签`);
    } catch {
      if (resultText) {
        editTitle.value = resultText.replace(/^["'《]+|["'》]+$/g, '').slice(0, 30).trim();
        saveNote();
        toast.success('AI 已生成标题');
      }
    }
  } catch (err) {
    console.error('generateAiTitleAndTags error', err);
    toast.error('AI 生成标题和标签失败');
  } finally {
    isAiWorking.value = false;
  }
}

// 统计
const noteStats = computed(() => {
  const c = editContent.value || '';
  const chars = c.length;
  const words = c.trim() ? (c.match(/[\w\d]+|[\u4e00-\u9fa5]/g) || []).length : 0;
  return { chars, words };
});

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getPreview(content?: string) {
  if (!content) return '无内容';
  return content
    .replace(/[#*`~_>\-\[\]()|!]/g, '')
    .slice(0, 140)
    .trim() || '无内容';
}

function copyNoteContent(content?: string, e?: Event) {
  e?.stopPropagation();
  if (!content) {
    toast.info('暂无内容可复制');
    return;
  }
  navigator.clipboard.writeText(content).then(() => {
    toast.success('笔记 Markdown 内容已复制至剪贴板');
  });
}

watch(
  [notes, availableTags, noteCategories, selectedTag, selectedCategoryId, selectedNote],
  () => {
    emit('stateChange', {
      notes: notes.value,
      tags: availableTags.value,
      categories: noteCategoriesWithCount.value,
      selectedTag: selectedTag.value,
      selectedCategoryId: selectedCategoryId.value,
      selectedNoteId: selectedNote.value?.id || null,
    });
  },
  { deep: true, immediate: true }
);

defineExpose({
  exportMarkdownFile,
  exportHtmlFile,
  createNote,
  selectNote,
  selectNoteById(id: number) {
    const found = notes.value.find((n) => n.id === id);
    if (found) selectNote(found);
  },
  filterByTag,
  filterByCategory,
  openManageCategories,
  deleteNote,
  loadNotes,
  loadTags,
  loadCategories,
});

function exportMarkdownFile() {
  if (!selectedNote.value) return;
  const blob = new Blob([editContent.value], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${editTitle.value || '未命名笔记'}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success('Markdown 文件导出成功');
}

function exportHtmlFile() {
  if (!selectedNote.value) return;
  const htmlBody = renderMarkdown(editContent.value);
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${editTitle.value || '未命名笔记'}</title>
<style>
body { max-width: 800px; margin: 40px auto; padding: 0 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.7; color: #333; }
pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
blockquote { border-left: 4px solid #18181b; margin: 0; padding-left: 12px; color: #666; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px 12px; }
</style>
</head>
<body>
<h1>${editTitle.value || '未命名笔记'}</h1>
${htmlBody}
</body>
</html>`;
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${editTitle.value || '未命名笔记'}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success('HTML 网页文件导出成功');
}

onMounted(() => {
  if (authStore.isLoggedIn) {
    loadCategories();
    loadTags();
    loadNotes();
  }
});

watch(
  () => props.active,
  (isActive) => {
    if (isActive && authStore.isLoggedIn) {
      loadCategories();
      loadTags();
      loadNotes();
    }
  }
);

watch(
  () => authStore.isLoggedIn,
  (isLogged) => {
    if (isLogged) {
      loadCategories();
      loadTags();
      loadNotes();
    } else {
      notes.value = [];
      noteCategories.value = [];
      selectedNote.value = null;
    }
  }
);
</script>

<template>
  <div class="flex-1 flex flex-col min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-background text-foreground">
      <!-- ==================== 1. 顶部控制栏 (无背景色) ==================== -->
      <div class="h-12 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-10 w-full min-w-0 max-w-full bg-transparent">
        <!-- 场景 A：列表视图顶部 -->
        <template v-if="!selectedNote">
          <!-- 左上角显示标题笔记列表 -->
          <div class="flex items-center gap-2 select-none min-w-0">
            <h1 class="text-base sm:text-lg font-semibold tracking-tight text-foreground m-0 truncate">
              笔记列表
            </h1>
          </div>

          <!-- 右上角显示搜索、标签和新建图标 -->
          <div class="flex items-center gap-1.5 shrink-0">
            <!-- 搜索图标与展开输入框 -->
            <div v-if="isSearchOpen || searchQuery" class="relative flex items-center">
              <Search class="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                v-model="searchQuery"
                type="text"
                placeholder="搜索笔记..."
                class="h-8 pl-8 pr-7 text-xs w-36 sm:w-52 bg-background/90"
                autofocus
                @input="loadNotes"
                @keydown.esc="isSearchOpen = false; searchQuery = ''; loadNotes()"
              />
              <Button
                variant="ghost"
                size="icon"
                class="size-6 absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                @click="isSearchOpen = false; searchQuery = ''; loadNotes()"
              >
                <X class="h-3.5 w-3.5" />
              </Button>
            </div>
            <Tooltip v-else>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-muted-foreground hover:text-foreground hover:bg-accent/80 rounded-md cursor-pointer"
                  @click="isSearchOpen = true"
                >
                  <Search class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">搜索笔记</TooltipContent>
            </Tooltip>

            <!-- 标签筛选组件 (点击展开) -->
            <Popover>
              <PopoverTrigger as-child>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8 text-muted-foreground hover:text-foreground hover:bg-accent/80 rounded-md cursor-pointer relative"
                      :class="{ 'text-primary bg-primary/10': selectedTag }"
                    >
                      <Tag class="size-4" />
                      <span v-if="selectedTag" class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">按标签筛选</TooltipContent>
                </Tooltip>
              </PopoverTrigger>
              <PopoverContent align="end" class="w-56 p-2 shadow-lg">
                <div class="space-y-1">
                  <div class="text-[11px] font-medium text-muted-foreground px-2 py-1 flex items-center justify-between">
                    <span>按标签筛选</span>
                    <button
                      v-if="selectedTag"
                      class="text-muted-foreground hover:text-foreground text-[10px] cursor-pointer"
                      @click="filterByTag(null)"
                    >清除筛选</button>
                  </div>
                  <ScrollArea class="h-56">
                    <div class="space-y-0.5 pr-2">
                      <div
                        class="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        :class="{ 'bg-accent font-medium text-foreground': selectedTag === null }"
                        @click="filterByTag(null)"
                      >
                        <span class="truncate">全部标签</span>
                        <span class="text-[10px] text-muted-foreground font-mono">({{ totalNoteCount }})</span>
                      </div>
                      <div
                        v-for="tag in availableTags"
                        :key="tag.name"
                        class="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        :class="{ 'bg-accent font-medium text-foreground': selectedTag === tag.name }"
                        @click="filterByTag(tag.name)"
                      >
                        <span class="truncate">#{{ tag.name }}</span>
                        <span class="text-[10px] text-muted-foreground font-mono">({{ tag.count }})</span>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>

            <!-- 新建笔记图标按钮 -->
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon"
                  class="size-8 rounded-md cursor-pointer shadow-xs"
                  @click="createNote"
                >
                  <Plus class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">新建笔记</TooltipContent>
            </Tooltip>
          </div>
        </template>

        <!-- 场景 B：编辑视图顶部 -->
        <template v-else>
          <div class="flex-1 min-w-0 flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  size="icon-sm"
                  @click="selectedNote = null; loadTags(); loadNotes()"
                >
                  <ArrowLeft class="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">返回笔记列表</TooltipContent>
            </Tooltip>

            <Input
              v-model="editTitle"
              type="text"
              class="flex-1 h-7 border-0 bg-transparent text-sm font-semibold focus-visible:ring-1 focus-visible:ring-border px-2"
              placeholder="输入笔记标题..."
              @blur="saveNote"
            />
          </div>

          <div class="shrink-0 flex items-center gap-1.5 pl-2">
            <!-- 模式切换 Tabs -->
            <Tabs :model-value="viewMode === 'preview' ? 'preview' : 'edit'" @update:model-value="(val) => val === 'preview' ? setPreviewMode() : setEditMode()">
              <TabsList class="h-7 p-0.5">
                <TabsTrigger value="edit" class="text-xs px-2.5 h-6 gap-1">
                  <Pencil class="h-3 w-3" />
                  <span>编辑</span>
                </TabsTrigger>
                <TabsTrigger value="preview" class="text-xs px-2.5 h-6 gap-1">
                  <Eye class="h-3 w-3" />
                  <span>预览</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <!-- 分类选择 -->
            <Popover v-model:open="isCategoryPopoverVisible">
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs gap-1 border-border/70"
                  :class="{ 'bg-accent text-accent-foreground font-semibold': isCategoryPopoverVisible }"
                  title="设置所属分类"
                >
                  <Folder class="h-3 w-3 text-muted-foreground" />
                  <span class="max-w-[70px] sm:max-w-[100px] truncate">{{ currentNoteCategoryName }}</span>
                </Button>
              </PopoverTrigger>

              <PopoverContent align="end" class="w-56 p-2 shadow-lg">
                <div class="space-y-1">
                  <div class="text-[11px] font-medium text-muted-foreground px-2 py-1 flex items-center justify-between">
                    <span>选择笔记分类</span>
                    <button class="text-primary hover:underline text-[11px] cursor-pointer" @click="openManageCategories">管理分类</button>
                  </div>
                  <ScrollArea class="h-48">
                    <div class="space-y-0.5 pr-2">
                      <div
                        class="flex items-center px-2 py-1.5 rounded-md text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        :class="{ 'bg-accent font-medium text-foreground': selectedNoteCategoryId === null }"
                        @click="setNoteCategory(null); isCategoryPopoverVisible = false;"
                      >
                        <Folder class="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
                        <span>未分类</span>
                      </div>
                      <div
                        v-for="cat in noteCategories"
                        :key="cat.id"
                        class="flex items-center px-2 py-1.5 rounded-md text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        :class="{ 'bg-accent font-medium text-foreground': selectedNoteCategoryId === cat.id }"
                        @click="setNoteCategory(cat.id); isCategoryPopoverVisible = false;"
                      >
                        <component :is="mapIcon(cat.icon || '')" class="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
                        <span class="truncate">{{ cat.name }}</span>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>

            <!-- 标签管理 -->
            <Popover v-model:open="isTagPopoverVisible">
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs gap-1"
                  :class="{ 'bg-accent text-accent-foreground font-semibold': isTagPopoverVisible }"
                  title="管理文章标签"
                >
                  <Tag class="h-3 w-3" />
                  <span>标签{{ editTags.length ? ` (${editTags.length})` : '' }}</span>
                </Button>
              </PopoverTrigger>

              <PopoverContent align="end" class="w-64 p-3 shadow-lg">
                <div class="space-y-2.5">
                  <div class="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>文章标签 ({{ editTags.length }})</span>
                  </div>
                  <ScrollArea class="h-36">
                    <div class="flex flex-wrap gap-1.5 pr-2">
                      <Badge
                        v-for="tag in editTags"
                        :key="tag"
                        variant="secondary"
                        class="gap-1 text-[11px] font-normal"
                      >
                        #{{ tag }}
                        <X class="h-2.5 w-2.5 text-muted-foreground hover:text-destructive cursor-pointer shrink-0 transition-colors" title="删除" @click.stop="removeTag(tag)" />
                      </Badge>
                      <span v-if="!editTags.length" class="text-xs text-muted-foreground">暂无标签，在下方输入添加</span>
                    </div>
                  </ScrollArea>
                  <div class="pt-2 border-t border-border flex items-center gap-1.5">
                    <Input
                      v-model="newTagInput"
                      placeholder="新标签名..."
                      class="h-7 text-xs flex-1"
                      @keydown.enter="addTag"
                    />
                    <Button size="sm" class="h-7 px-2.5 text-xs" @click="addTag">添加</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </template>
      </div>

      <!-- ==================== 2. 主体工作区 ==================== -->
    <div class="flex-1 flex flex-col min-h-0">
      <!-- 场景 1：无选中笔记时的卡片网格列表 -->
      <div v-if="!selectedNote" class="flex-1 p-3 sm:p-5 max-w-7xl w-full min-w-0 max-w-full mx-auto">
        <div v-if="loading && notes.length === 0" class="py-20 text-center text-muted-foreground">
          <Loader2 class="h-7 w-7 animate-spin mx-auto mb-2 text-primary" />
          <p class="text-xs m-0">正在加载笔记列表...</p>
        </div>

        <div v-else-if="filteredNotes.length === 0" class="py-16 text-center bg-card border border-border rounded-xl p-8">
          <FileText class="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
          <h3 class="text-sm font-semibold text-foreground m-0 mb-1">暂无匹配笔记</h3>
          <p v-if="searchQuery" class="text-xs text-muted-foreground m-0 mb-4">没有搜索到包含「{{ searchQuery }}」的笔记</p>
          <p v-else-if="selectedTag" class="text-xs text-muted-foreground m-0 mb-4">当前标签 #{{ selectedTag }} 下暂无笔记</p>
          <p v-else class="text-xs text-muted-foreground m-0 mb-4">点击右上角「新建」开启您的第一篇知识笔记</p>
          <Button size="sm" class="gap-1.5" @click="createNote">
            <Plus class="h-3.5 w-3.5" />
            <span>立即新建</span>
          </Button>
        </div>

        <!-- 笔记卡片网格 -->
        <div v-else class="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <ContextMenu v-for="(n, idx) in filteredNotes" :key="n.id">
            <ContextMenuTrigger as-child>
              <Card
                class="group relative flex flex-col justify-between p-3.5 shadow-xs hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer h-40 select-none overflow-hidden"
                :class="{
                  'opacity-50 scale-95': draggedNoteIndex === idx,
                  'ring-2 ring-primary': dragOverNoteIndex === idx
                }"
                draggable="true"
                @dragstart="onNoteDragStart(idx, $event)"
                @dragover="onNoteDragOver(idx, $event)"
                @drop="onNoteDrop(idx)"
                @dragend="onNoteDragEnd"
                @click="selectNote(n)"
              >
                <!-- 卡片头部 -->
                <div class="flex items-start justify-between gap-2">
                  <span class="text-xs font-semibold text-foreground/90 truncate flex-1 group-hover:text-primary transition-colors">
                    {{ n.title || '未命名笔记' }}
                  </span>

                  <!-- 悬浮操作按钮 -->
                  <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" @click.stop>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="text-muted-foreground hover:text-foreground"
                          @click="openShareModal(n, $event)"
                        >
                          <Share2 class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">分享笔记</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="text-muted-foreground hover:text-foreground"
                          @click="copyNoteContent(n.content, $event)"
                        >
                          <Copy class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">复制内容</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          @click="deleteNote(n, $event)"
                        >
                          <Trash2 class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">删除笔记</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <!-- 预览正文 -->
                <div class="text-xs text-muted-foreground line-clamp-3 leading-relaxed my-1.5 flex-1">
                  {{ getPreview(n.content) }}
                </div>

                <!-- 卡片底部 -->
                <div class="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                  <div class="flex items-center gap-1 overflow-hidden pr-2" @click.stop>
                    <Badge
                      v-if="getCategoryName(n.category_id)"
                      variant="outline"
                      class="px-1.5 py-0 text-[10px] truncate hover:text-foreground cursor-pointer font-normal gap-0.5 border-border/70 shrink-0"
                      @click="filterByCategory(n.category_id!)"
                    >
                      <component :is="mapIcon(getCategoryIcon(n.category_id))" class="size-2.5 text-muted-foreground" />
                      <span>{{ getCategoryName(n.category_id) }}</span>
                    </Badge>
                    <template v-if="n.tags && n.tags.length">
                      <Badge
                        v-for="t in n.tags"
                        :key="t"
                        variant="secondary"
                        class="px-1.5 py-0 text-[10px] truncate hover:text-foreground cursor-pointer font-normal"
                        @click="filterByTag(t)"
                      >#{{ t }}</Badge>
                    </template>
                  </div>
                  <span class="font-mono shrink-0">{{ formatDate(n.updated_at) }}</span>
                </div>
              </Card>
            </ContextMenuTrigger>

            <ContextMenuContent class="w-44">
              <ContextMenuItem @click="selectNote(n)">
                <Pencil class="mr-2 h-3.5 w-3.5" />
                <span>编辑笔记</span>
              </ContextMenuItem>
              <ContextMenuItem @click="openShareModal(n)">
                <Share2 class="mr-2 h-3.5 w-3.5" />
                <span>分享笔记</span>
              </ContextMenuItem>
              <ContextMenuItem @click="copyNoteContent(n.content)">
                <Copy class="mr-2 h-3.5 w-3.5" />
                <span>复制 Markdown</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem class="text-destructive focus:text-destructive" @click="deleteNote(n)">
                <Trash2 class="mr-2 h-3.5 w-3.5" />
                <span>删除笔记</span>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </div>

      <!-- 场景 2：Markdown 工作台 -->
      <div v-else class="flex-1 flex flex-col min-h-0 w-full min-w-0 max-w-full overflow-x-hidden bg-card">
        <!-- 工具栏 -->
        <div v-if="viewMode !== 'preview'" class="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 border-b border-border bg-muted/30 overflow-x-auto max-w-full min-w-0 shrink-0">
          <!-- 1. AI 写作下拉 -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="xs"
                class="gap-1 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
              >
                <Loader2 v-if="isAiWorking" class="h-3.5 w-3.5 animate-spin" />
                <Sparkles v-else class="h-3.5 w-3.5 text-primary" />
                <span class="text-[11px]">AI 助手</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-44">
              <DropdownMenuItem @click="handleAiCommand('title_and_tags')">
                <Sparkles class="mr-2 h-3.5 w-3.5 text-primary" />
                <span>生成标题标签</span>
              </DropdownMenuItem>
              <DropdownMenuItem @click="handleAiCommand('custom')">
                <Sliders class="mr-2 h-3.5 w-3.5" />
                <span>自定义指令</span>
              </DropdownMenuItem>
              <DropdownMenuItem @click="handleAiCommand('polish')">
                <Brush class="mr-2 h-3.5 w-3.5" />
                <span>文字润色</span>
              </DropdownMenuItem>
              <DropdownMenuItem @click="handleAiCommand('shorten')">
                <Scissors class="mr-2 h-3.5 w-3.5" />
                <span>提炼精简</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="handleAiCommand('continue')">
                <FilePlus class="mr-2 h-3.5 w-3.5" />
                <span>续写下文</span>
              </DropdownMenuItem>
              <DropdownMenuItem @click="handleAiCommand('expand')">
                <BookOpen class="mr-2 h-3.5 w-3.5" />
                <span>扩写丰富</span>
              </DropdownMenuItem>
              <DropdownMenuItem @click="handleAiCommand('summarize')">
                <FileSpreadsheet class="mr-2 h-3.5 w-3.5" />
                <span>提取摘要</span>
              </DropdownMenuItem>
              <DropdownMenuItem @click="handleAiCommand('translate')">
                <Languages class="mr-2 h-3.5 w-3.5" />
                <span>中英翻译</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" class="h-3.5 mx-1" />

          <!-- 2. 标题下拉 -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="ghost" size="icon-xs">
                    <span class="font-bold text-xs">H</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">标题分级</TooltipContent>
              </Tooltip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-36">
              <DropdownMenuItem @click="insertHeading('1')"><span class="font-bold mr-2">H1</span> 一级标题</DropdownMenuItem>
              <DropdownMenuItem @click="insertHeading('2')"><span class="font-bold mr-2">H2</span> 二级标题</DropdownMenuItem>
              <DropdownMenuItem @click="insertHeading('3')"><span class="font-bold mr-2">H3</span> 三级标题</DropdownMenuItem>
              <DropdownMenuItem @click="insertHeading('4')"><span class="font-bold mr-2">H4</span> 四级标题</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="insertHeading('0')">常规段落</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- 3. 加粗/斜体/删除线 -->
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="insertWrap('**', '**', '加粗文本')">
                <span class="font-bold text-xs">B</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">加粗 (Ctrl+B)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="insertWrap('*', '*', '斜体文本')">
                <span class="italic font-serif text-xs">I</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">斜体 (Ctrl+I)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="insertWrap('~~', '~~', '删除文本')">
                <span class="line-through text-xs">S</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">删除线</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" class="h-3.5 mx-1" />

          <!-- 4. 块级工具 -->
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="insertBlockPrefix('> ')">
                <Quote class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">引用块</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="insertBlockPrefix('- [ ] ')">
                <CheckSquare class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">待办清单</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="insertBlockPrefix('- ')">
                <List class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">无序列表</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" class="h-3.5 mx-1" />

          <!-- 5. 代码/表格/链接 -->
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="insertWrap('\n```\n', '\n```\n', '代码内容')">
                <span class="text-[11px] font-mono">&lt;/&gt;</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">代码块</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="insertTable">
                <Table class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">插入表格</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="insertLink">
                <Link class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">插入超链接</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="insertWrap('\n---\n', '', '')">
                <Minus class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">分割线</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" class="h-3.5 mx-1" />

          <!-- 6. 撤销/重做/清除格式 -->
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="undoText">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C20.91 11.23 17.11 8 12.5 8z"/></svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">撤销 (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="redoText">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.61 0-8.41 3.23-9.57 7.22l2.37.78c1.05-3.19 4.06-5.5 7.6-5.5 1.96 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">重做 (Ctrl+Y)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-xs" @click="clearFormatting">
                <X class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">清除格式</TooltipContent>
          </Tooltip>

          <!-- 7. 上传图片附件 -->
          <Separator orientation="vertical" class="h-3.5 mx-1" />
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-xs"
                :disabled="uploadingNoteFile"
                @click="triggerNoteFileUpload"
              >
                <Loader2 v-if="uploadingNoteFile" class="h-3.5 w-3.5 animate-spin" />
                <Paperclip v-else class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">上传图片或附件</TooltipContent>
          </Tooltip>
          <input ref="noteFileInputRef" type="file" hidden @change="onNoteFileChange" />
        </div>

        <!-- 内容分栏展示区域 -->
        <div class="flex-1 flex min-h-0 overflow-hidden">
          <!-- 1. 编辑框 -->
          <div
            v-show="viewMode === 'edit' || viewMode === 'split'"
            class="flex-1 flex flex-col min-w-0 border-r border-border relative bg-card"
            @mouseenter="setScrollSource('editor')"
          >
            <textarea
              ref="textareaRef"
              v-model="editContent"
              class="flex-1 w-full p-4 sm:p-5 text-xs font-mono bg-transparent text-foreground outline-none resize-none leading-relaxed placeholder:text-muted-foreground"
              placeholder="在此撰写 Markdown 笔记内容，支持快捷键 (Ctrl+B/I/S, Tab缩进, 回车智能列表)..."
              @keydown="handleTextareaKeyDown"
              @paste="handleNotesPaste"
              @scroll="onEditorScroll"
              @blur="saveNote"
              @mouseenter="setScrollSource('editor')"
            ></textarea>

            <!-- 底部状态栏 -->
            <div class="h-7 px-3 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground font-mono shrink-0">
              <span>{{ noteStats.chars }} 字符 · {{ noteStats.words }} 词</span>
              <div class="flex items-center gap-1.5">
                <template v-if="saveStatus === 'saving'">
                  <Loader2 class="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>正在保存...</span>
                </template>
                <template v-else-if="saveStatus === 'unsaved'">
                  <span class="text-amber-500 font-bold">●</span>
                  <span>未保存</span>
                </template>
                <template v-else>
                  <CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />
                  <span>已保存 {{ lastSavedTime ? '于 ' + lastSavedTime : '' }}</span>
                </template>
              </div>
            </div>
          </div>

          <!-- 2. 实时预览区 -->
          <div
            v-show="viewMode === 'preview' || viewMode === 'split'"
            ref="previewWrapperRef"
            class="flex-1 p-4 sm:p-6 overflow-y-auto bg-muted/10"
            @scroll="onPreviewScroll"
            @click="handlePreviewClick"
            @mouseenter="setScrollSource('preview')"
          >
            <div
              v-if="editContent.trim()"
              class="ai-markdown-body max-w-3xl"
              v-html="renderMarkdown(editContent)"
            />
            <div v-else class="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
              <Eye class="h-8 w-8 mb-2 text-muted-foreground/50" />
              <p class="text-xs m-0">在左侧输入 Markdown 内容即可在此实时呈现</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分享弹窗 -->
    <Dialog :open="showShareModal" @update:open="showShareModal = $event">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>分享笔记「{{ targetNoteForShare?.title || '未命名' }}」</DialogTitle>
        </DialogHeader>

        <Tabs :model-value="activeShareTab" @update:model-value="(val) => activeShareTab = val as 'create' | 'history'" class="mb-3">
          <TabsList class="h-8">
            <TabsTrigger value="create" class="text-xs px-3">创建新分享</TabsTrigger>
            <TabsTrigger value="history" class="text-xs px-3">历史分享 ({{ noteShareHistory.length }})</TabsTrigger>
          </TabsList>
        </Tabs>

        <!-- 创建分享 -->
        <div v-if="activeShareTab === 'create'">
          <div v-if="!createdShare" class="space-y-3 py-1">
            <div class="space-y-1.5">
              <label class="block text-xs font-medium text-foreground/80">提取密码 (可选，留空为公开)</label>
              <div class="flex gap-2">
                <Input
                  v-model="shareForm.password"
                  placeholder="自定义密码或点击随机"
                  maxlength="16"
                  class="flex-1"
                />
                <Button variant="outline" size="sm" @click="generateRandomPassword">随机生成</Button>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="block text-xs font-medium text-foreground/80">有效时长</label>
              <Select :model-value="String(shareForm.expire_hours)" @update:model-value="shareForm.expire_hours = Number($event)">
                <SelectTrigger class="w-full h-9 text-xs">
                  <SelectValue placeholder="请选择有效时长" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 小时内有效</SelectItem>
                  <SelectItem value="24">24 小时 (1天) 内有效</SelectItem>
                  <SelectItem value="168">7 天内有效</SelectItem>
                  <SelectItem value="0">永久有效</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div>
                <div class="text-xs font-semibold text-foreground">阅后即焚</div>
                <div class="text-[11px] text-muted-foreground">访问一次后立即自动销毁链接</div>
              </div>
              <Switch :checked="shareForm.burn_after_reading" @update:checked="shareForm.burn_after_reading = $event" />
            </div>
          </div>

          <div v-else class="space-y-3 py-1">
            <div class="p-3 bg-muted/40 border border-border rounded-lg space-y-2">
              <div class="text-xs text-muted-foreground">分享链接：</div>
              <div class="text-xs font-mono break-all p-2 bg-card rounded border border-border select-all">
                {{ createdShare.url }}
              </div>

              <div v-if="createdShare.password" class="text-xs flex items-center justify-between pt-1">
                <span class="text-muted-foreground">提取密码：</span>
                <span class="font-mono font-bold text-primary">{{ createdShare.password }}</span>
              </div>

              <div class="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border">
                <span>有效期：{{ createdShare.expires_at ? formatDate(createdShare.expires_at) : '永久有效' }}</span>
                <span v-if="createdShare.burn_after_reading" class="text-amber-500 font-medium">阅后即焚</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 历史记录 -->
        <div v-else class="py-1">
          <div v-if="loadingHistory" class="text-center py-6 text-xs text-muted-foreground">
            <Loader2 class="h-4 w-4 animate-spin mx-auto mb-1 text-primary" /> 加载分享历史...
          </div>
          <div v-else-if="!noteShareHistory.length" class="text-center py-6 text-xs text-muted-foreground">
            此笔记暂无历史分享记录
          </div>
          <ScrollArea v-else class="h-64">
            <div class="space-y-2 pr-2">
              <div
                v-for="item in noteShareHistory"
                :key="item.id"
                class="p-2.5 bg-muted/30 border border-border rounded-lg flex items-center justify-between gap-3 text-xs"
              >
                <div class="min-w-0 flex-1 space-y-0.5">
                  <div class="font-mono font-semibold text-foreground truncate">
                    /share/{{ item.id }}
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span>密码: <strong class="text-foreground font-semibold">{{ item.password || '免密' }}</strong></span>
                    <span>访问: {{ item.views_count }} 次</span>
                    <span v-if="item.burn_after_reading" class="text-amber-500 font-medium">阅后即焚</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-6 px-2 text-[11px]"
                    title="复制分享链接"
                    @click="copyHistoryShare(item)"
                  >
                    复制
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    class="h-6 px-2 text-[11px]"
                    title="撤销此分享"
                    @click="revokeShare(item)"
                  >
                    撤销
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <template v-if="activeShareTab === 'create'">
            <template v-if="!createdShare">
              <Button variant="outline" @click="showShareModal = false">关闭</Button>
              <Button
                :disabled="creatingShare"
                @click="submitCreateShare"
              >
                <Loader2 v-if="creatingShare" class="h-3.5 w-3.5 animate-spin mr-1" />
                <span>生成分享链接</span>
              </Button>
            </template>
            <template v-else>
              <Button variant="outline" @click="createdShare = null">重新创建</Button>
              <Button @click="copyShareLink(true)">
                复制链接与密码
              </Button>
            </template>
          </template>
          <template v-else>
            <Button variant="outline" @click="showShareModal = false">关闭</Button>
          </template>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 自定义 AI 写作指令弹窗 -->
    <Dialog :open="showAiPromptDialog" @update:open="showAiPromptDialog = $event">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>AI 自定义写作指令</DialogTitle>
        </DialogHeader>

        <div class="space-y-2.5 py-2">
          <p class="text-xs text-muted-foreground m-0">告诉 AI 如何处理当前选中的笔记内容：</p>
          <Textarea
            v-model="customAiPrompt"
            :rows="3"
            placeholder="例如：将要点改写为生动易读的排版风格..."
            class="resize-none"
            autofocus
            @keydown.enter.ctrl="runAiAction('custom', customAiPrompt); showAiPromptDialog = false"
          />
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showAiPromptDialog = false">取消</Button>
          <Button
            :disabled="!customAiPrompt.trim()"
            @click="runAiAction('custom', customAiPrompt); showAiPromptDialog = false"
          >
            开始执行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 笔记分类管理弹窗 -->
    <Dialog :open="showCategoryManageModal" @update:open="showCategoryManageModal = $event">
      <DialogContent class="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Folder class="h-5 w-5 text-primary" />
            笔记分类管理
          </DialogTitle>
        </DialogHeader>

        <div class="space-y-4 py-2">
          <!-- 新建分类输入 -->
          <div class="flex items-center gap-2">
            <Input
              v-model="newCategoryName"
              placeholder="输入新分类名称..."
              class="flex-1"
              @keydown.enter.prevent="handleCreateCategory"
            />
            <Button size="sm" class="gap-1" @click="handleCreateCategory">
              <Plus class="h-4 w-4" />
              添加
            </Button>
          </div>

          <!-- 分类列表 -->
          <div class="border rounded-md overflow-hidden">
            <div
              v-if="noteCategories.length === 0"
              class="text-xs text-muted-foreground text-center py-6"
            >
              暂无分类，输入上方名称后点击添加
            </div>
            <ScrollArea v-else class="h-60">
              <div class="divide-y pr-2">
                <div
                  v-for="cat in noteCategories"
                  :key="cat.id"
                  class="flex items-center justify-between px-3 py-2.5 hover:bg-accent/50 transition-colors"
                >
                  <div class="flex items-center gap-2 text-sm font-medium">
                    <component :is="mapIcon(cat.icon || '')" class="h-4 w-4 text-muted-foreground" />
                    <span>{{ cat.name }}</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 text-muted-foreground hover:text-destructive"
                        @click="handleDeleteCategory(cat.id)"
                      >
                        <Trash2 class="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">删除分类</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showCategoryManageModal = false">完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 图片全屏灯箱 -->
    <div
      v-if="showImgViewer"
      class="fixed inset-0 z-50 bg-background/90 backdrop-blur flex items-center justify-center p-4 cursor-pointer animate-in fade-in-0"
      @click="showImgViewer = false"
    >
      <img
        :src="previewImgUrlList[0]"
        class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        alt="Preview"
      />
      <Button
        variant="ghost"
        size="icon"
        class="absolute top-4 right-4 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent"
        @click="showImgViewer = false"
      >
        <X class="h-6 w-6" />
      </Button>
    </div>
  </div>
</template>
