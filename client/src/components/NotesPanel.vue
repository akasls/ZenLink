<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { noteApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const props = defineProps<{
  active?: boolean;
}>();

marked.setOptions({
  breaks: true,
  gfm: true,
});

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
const isMobileSearchOpen = ref(false);

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

const notes = ref<Note[]>([]);
const availableTags = ref<NoteTag[]>([]);
const selectedTag = ref<string | null>(null);
const selectedNote = ref<Note | null>(null);
const searchQuery = ref('');
const loading = ref(false);

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

async function loadTags() {
  try {
    const { data } = await noteApi.getTags();
    availableTags.value = data.tags || [];
  } catch (e) {
    console.error('loadTags error', e);
  }
}

async function loadNotes() {
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
    ElMessage.info('已定位到未编写的空白笔记');
    return;
  }

  try {
    const { data } = await noteApi.create({
      title: '未命名笔记',
      tags: selectedTag.value ? [selectedTag.value] : [],
    });
    await loadNotes();
    await loadTags();
    selectNote(data.note);
    nextTick(() => {
      textareaRef.value?.focus();
    });
  } catch {
    ElMessage.error('创建笔记失败');
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
      tags: updatedTags,
    });

    const idx = notes.value.findIndex(n => n.id === selectedNote.value!.id);
    const nowIso = new Date().toISOString();
    if (idx >= 0) {
      notes.value[idx].title = updatedTitle;
      notes.value[idx].content = updatedContent;
      notes.value[idx].tags = updatedTags;
      notes.value[idx].updated_at = nowIso;
    }
    selectedNote.value.title = updatedTitle;
    selectedNote.value.content = updatedContent;
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
    await ElMessageBox.confirm(`确定删除笔记「${note.title}」？删除后不可恢复。`, '确认删除', {
      type: 'warning',
      customClass: 'zenlink-custom-msgbox',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    });
    await noteApi.delete(note.id);
    if (selectedNote.value?.id === note.id) {
      selectedNote.value = null;
    }
    await loadNotes();
    await loadTags();
    ElMessage.success('已删除笔记');
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
    ElMessage.success('笔记分享链接已生成');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '生成分享链接失败');
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
    ElMessage.success('分享链接与密码已复制到剪贴板');
  });
}

function copyHistoryShare(item: NoteShareItem) {
  const url = `${window.location.origin}/share/${item.id}`;
  let text = `【ZenLink 笔记分享】${targetNoteForShare.value?.title || '未命名笔记'}\n链接：${url}`;
  if (item.password) {
    text += `\n提取密码：${item.password}`;
  }
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('历史分享链接已复制到剪贴板');
  });
}

async function revokeShare(item: NoteShareItem) {
  try {
    await noteApi.deleteShare(item.id);
    ElMessage.success('已撤销该分享链接');
    if (targetNoteForShare.value) {
      loadNoteShareHistory(targetNoteForShare.value.id);
    }
  } catch {
    ElMessage.error('撤销失败');
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
    ElMessage.error('笔记排序保存失败');
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
    ElMessage.info('请先选中需要清除格式的文本');
    return;
  }
  const clean = selected.replace(/[#*`~_>\-\[\]()|!]/g, '').trim();
  editContent.value = oldText.substring(0, start) + clean + oldText.substring(end);
  nextTick(() => {
    textarea.focus();
    textarea.setSelectionRange(start, start + clean.length);
  });
  ElMessage.success('已清除选中文字格式');
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
      ElMessage.success('笔记已保存');
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

    ElMessage.success((isImage ? "图片" : "附件") + "「" + fileName + "」已插入当前光标处");
    saveNote();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || "上传失败，请检查存储配置");
  } finally {
    uploadingNoteFile.value = false;
  }
}

// 预览区交互：支持点击图片全屏大图预览、点击附件下载、点击复选框勾选
function handlePreviewClick(e: MouseEvent) {
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
      ElMessage.success("正在下载附件...");
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
    ElMessage.warning('请先输入或选择笔记内容');
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
      ElMessage.success('AI 写作协同完成');
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      ElMessage.error('AI 协同响应失败');
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
    ElMessage.warning('请先撰写笔记正文');
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
      ElMessage.success(`AI 已生成标题「${data.title || editTitle.value}」与标签`);
    } catch {
      if (resultText) {
        editTitle.value = resultText.replace(/^["'《]+|["'》]+$/g, '').slice(0, 30).trim();
        saveNote();
        ElMessage.success('AI 已生成标题');
      }
    }
  } catch (err) {
    console.error('generateAiTitleAndTags error', err);
    ElMessage.error('AI 生成标题和标签失败');
  } finally {
    isAiWorking.value = false;
  }
}

// Markdown 渲染
function renderMarkdown(content: string) {
  if (!content) return '';
  const rawHtml = marked.parse(content) as string;
  return DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });
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
    ElMessage.info('暂无内容可复制');
    return;
  }
  navigator.clipboard.writeText(content).then(() => {
    ElMessage.success('笔记 Markdown 内容已复制至剪贴板');
  });
}

function exportMarkdownFile() {
  if (!selectedNote.value) return;
  const blob = new Blob([editContent.value], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${editTitle.value || '未命名笔记'}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  ElMessage.success('Markdown 文件导出成功');
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
blockquote { border-left: 4px solid var(--zl-primary); margin: 0; padding-left: 12px; color: #666; }
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
  ElMessage.success('HTML 网页文件导出成功');
}

onMounted(() => {
  loadTags();
  loadNotes();
});
</script>

<template>
  <div class="openwebui-ai-panel notes-modern-panel">
    <!-- ==================== 1. 顶部控制栏 ==================== -->
    <div class="openwebui-top-bar">
      <!-- 场景 A：列表视图顶部 -->
      <template v-if="!selectedNote">
        <!-- 移动端展开搜索模式：直接在顶栏内展开充满 -->
        <div v-if="isMobile && isMobileSearchOpen" class="top-bar-mobile-search-inline">
          <el-icon class="search-icon"><component :is="'Search'"></component></el-icon>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索笔记标题、内容或标签..."
            class="mobile-inline-search-input"
            autofocus
            @input="loadNotes"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="search-clear-cross"
            @click="searchQuery = ''; loadNotes()"
          >×</button>
          <button
            type="button"
            class="mobile-search-cancel-btn"
            @click="isMobileSearchOpen = false; searchQuery = ''; loadNotes()"
          >取消</button>
        </div>

        <!-- 正常顶栏模式 (左侧横向滚动标签胶囊，右侧紧凑搜索和无高亮新建按钮) -->
        <template v-else>
          <div class="top-bar-left flex-1 min-w-0">
            <div class="top-bar-tags-slider">
              <button
                type="button"
                class="tag-pill-btn"
                :class="{ active: selectedTag === null }"
                @click="filterByTag(null)"
              >
                <span>全部</span>
                <span class="tag-count-badge">{{ totalNoteCount }}</span>
              </button>
              <button
                v-for="tag in availableTags"
                :key="tag.name"
                type="button"
                class="tag-pill-btn"
                :class="{ active: selectedTag === tag.name }"
                @click="filterByTag(tag.name)"
              >
                <span>#{{ tag.name }}</span>
                <span class="tag-count-badge">{{ tag.count }}</span>
              </button>
            </div>
          </div>

          <!-- 列表态右侧：PC 搜索框 + 柔和新建；移动端纯图标 -->
          <div class="top-bar-right flex-shrink-0 flex items-center gap-2">
            <!-- PC 端搜索框 -->
            <div v-if="!isMobile" class="notes-search-input-box">
              <el-icon class="search-icon"><component :is="'Search'"></component></el-icon>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索笔记..."
                class="notes-search-input-field"
                @input="loadNotes"
              />
              <button
                v-if="searchQuery"
                type="button"
                class="search-clear-cross"
                @click="searchQuery = ''; loadNotes()"
              >×</button>
            </div>

            <!-- PC 端新建按钮 (无高亮强色，契合整体柔和色调) -->
            <button
              v-if="!isMobile"
              type="button"
              class="notes-new-btn-neutral"
              title="新建空白笔记"
              @click="createNote"
            >
              <el-icon class="mr-1"><component :is="'Plus'"></component></el-icon>
              <span>新建</span>
            </button>

            <!-- 移动端搜索与新建图标按钮 -->
            <template v-else>
              <button
                type="button"
                class="notes-mobile-icon-btn"
                :class="{ active: searchQuery }"
                title="搜索笔记"
                @click="isMobileSearchOpen = true"
              >
                <el-icon><component :is="'Search'"></component></el-icon>
              </button>

              <button
                type="button"
                class="notes-mobile-icon-btn"
                title="新建笔记"
                @click="createNote"
              >
                <el-icon><component :is="'Plus'"></component></el-icon>
              </button>
            </template>
          </div>
        </template>
      </template>

      <!-- 场景 B：编辑视图顶部 (左侧纯图标返回 + 纯净标题输入；右侧展示标签栏) -->
      <template v-else>
        <div class="top-bar-left flex-1 min-w-0 flex items-center gap-2">
          <!-- 纯图标返回按钮 (无胶囊无文字) -->
          <button
            class="top-bar-icon-back-btn"
            title="返回笔记列表"
            @click="selectedNote = null; loadTags(); loadNotes()"
          >
            <el-icon><component :is="'ArrowLeft'"></component></el-icon>
          </button>

          <!-- 标题输入框 (纯净可编辑，无多余AI生成图标) -->
          <input
            v-model="editTitle"
            type="text"
            class="top-bar-title-input"
            placeholder="输入笔记标题..."
            @blur="saveNote"
          />
        </div>

        <!-- 编辑态右侧：放置文章标签 (Desktop 直接平铺，Mobile 弹出式) -->
        <div class="top-bar-right flex-shrink-0 flex items-center">
          <!-- PC 端右上角标签平铺展示与添加 -->
          <div v-if="!isMobile" class="top-bar-tags-wrap">
            <span
              v-for="tag in editTags"
              :key="tag"
              class="editor-tag-badge"
            >
              #{{ tag }}
              <button type="button" class="tag-del-x" title="删除标签" @click="removeTag(tag)">×</button>
            </span>

            <div v-if="isTagInputVisible" class="editor-tag-input-box">
              <input
                v-model="newTagInput"
                type="text"
                class="editor-tag-input"
                placeholder="标签名..."
                autofocus
                @keydown.enter="addTag"
                @keydown.esc="isTagInputVisible = false"
                @blur="addTag"
              />
            </div>
            <button
              v-else
              type="button"
              class="editor-add-tag-btn"
              title="添加新标签"
              @click="isTagInputVisible = true"
            >
              + 标签
            </button>
          </div>

          <!-- 移动端右上角仅展示标签图标按钮，点击展开管理 -->
          <el-popover
            v-else
            trigger="click"
            width="260"
            placement="bottom-end"
            popper-class="zenlink-custom-popover"
          >
            <template #reference>
              <button type="button" class="notes-mobile-icon-btn" title="管理文章标签">
                <el-icon><component :is="'PriceTag'"></component></el-icon>
                <span v-if="editTags.length" class="mobile-tag-count-dot">{{ editTags.length }}</span>
              </button>
            </template>

            <div class="p-2 space-y-2">
              <div class="text-xs font-semibold text-muted mb-1.5 flex items-center justify-between">
                <span>文章标签 ({{ editTags.length }})</span>
              </div>
              <div class="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                <span
                  v-for="tag in editTags"
                  :key="tag"
                  class="editor-tag-badge"
                >
                  #{{ tag }}
                  <button type="button" class="tag-del-x" title="删除" @click="removeTag(tag)">×</button>
                </span>
                <span v-if="!editTags.length" class="text-xs text-muted">暂无标签</span>
              </div>
              <div class="pt-2 border-t border-light flex items-center gap-1.5">
                <input
                  v-model="newTagInput"
                  type="text"
                  class="editor-tag-input flex-1"
                  placeholder="新标签名..."
                  @keydown.enter="addTag"
                />
                <button type="button" class="editor-add-tag-btn" @click="addTag">添加</button>
              </div>
            </div>
          </el-popover>
        </div>
      </template>
    </div>

    <!-- ==================== 2. 主体工作区 ==================== -->
    <div class="notes-body-container">
      <!-- 场景 1：无选中笔记时，展示等高整齐排列、支持拖拽排序的笔记列表卡片 -->
      <div class="notes-cards-waterfall-view" v-if="!selectedNote">
        <div v-if="loading && notes.length === 0" class="memo-loading-state">
          <el-icon class="is-loading"><component :is="'Loading'"></component></el-icon>
          <span>正在加载笔记列表...</span>
        </div>

        <div v-else-if="filteredNotes.length === 0" class="memo-empty-state">
          <div class="empty-memo-box">
            <el-icon class="empty-memo-icon"><component :is="'Document'"></component></el-icon>
            <h3>暂无匹配笔记</h3>
            <p v-if="searchQuery">没有搜索到包含「{{ searchQuery }}」的笔记</p>
            <p v-else-if="selectedTag">当前标签 #{{ selectedTag }} 下暂无笔记</p>
            <p v-else>点击右上角「新建」开启您的第一篇 Markdown 知识库</p>
            <button class="empty-create-btn" @click="createNote">
              <el-icon class="mr-1"><component :is="'Plus'"></component></el-icon>
              立即新建
            </button>
          </div>
        </div>

        <!-- 等高笔记卡片栅格 (支持拖拽排序) -->
        <div v-else class="memo-cards-grid">
          <div
            v-for="(n, idx) in filteredNotes"
            :key="n.id"
            class="memo-card equal-height-card"
            :class="{
              'is-dragging': draggedNoteIndex === idx,
              'is-drag-over': dragOverNoteIndex === idx
            }"
            draggable="true"
            @dragstart="onNoteDragStart(idx, $event)"
            @dragover="onNoteDragOver(idx, $event)"
            @drop="onNoteDrop(idx)"
            @dragend="onNoteDragEnd"
            @click="selectNote(n)"
          >
            <!-- 卡片顶部 -->
            <div class="memo-card-header">
              <div class="memo-title-row">
                <span class="memo-title-text">{{ n.title || '未命名笔记' }}</span>
              </div>

              <!-- 卡片操作按钮 (右上角直接分享，复制，删除) -->
              <div class="memo-card-actions" @click.stop>
                <button
                  type="button"
                  class="memo-act-btn"
                  title="分享此笔记"
                  @click="openShareModal(n, $event)"
                >
                  <el-icon><component :is="'Share'"></component></el-icon>
                </button>
                <button
                  type="button"
                  class="memo-act-btn"
                  title="复制内容"
                  @click="copyNoteContent(n.content, $event)"
                >
                  <el-icon><component :is="'CopyDocument'"></component></el-icon>
                </button>
                <button
                  type="button"
                  class="memo-act-btn del"
                  title="删除笔记"
                  @click="deleteNote(n, $event)"
                >
                  <el-icon><component :is="'Delete'"></component></el-icon>
                </button>
              </div>
            </div>

            <!-- 卡片预览正文 (固定3行截断) -->
            <div class="memo-card-body">
              <div class="memo-preview-text">{{ getPreview(n.content) }}</div>
            </div>

            <!-- 卡片底部：左下角显示标签(无高亮灰调轻柔样式)，右下角显示时间 -->
            <div class="memo-card-footer">
              <div class="memo-footer-tags-wrap" @click.stop>
                <template v-if="n.tags && n.tags.length">
                  <span
                    v-for="t in n.tags"
                    :key="t"
                    class="memo-tag-chip-subtle"
                    @click="filterByTag(t)"
                  >#{{ t }}</span>
                </template>
              </div>
              <span class="memo-time">{{ formatDate(n.updated_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 场景 2：Markdown 工作台 -->
      <div v-else class="notes-editor-workspace">
        <!-- Markdown 快捷排版工具栏 (AI首位，精选菜单，上传靠左排列) -->
        <div v-if="viewMode !== 'preview'" class="notes-syntax-toolbar">
          <!-- 1. AI 智能写作下拉菜单 (居于工具条首位) -->
          <el-dropdown trigger="click" @command="handleAiCommand">
            <button
              class="syntax-tool-btn ai-magic-toolbar-btn mr-0.5"
              :class="{ 'is-ai-active': isAiWorking }"
              title="AI 智能写作助手"
            >
              <el-icon v-if="isAiWorking" class="is-loading"><component :is="'Loading'"></component></el-icon>
              <el-icon v-else><component :is="'MagicStick'"></component></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu class="zenlink-custom-dropdown zenlink-ai-dropdown">
                <el-dropdown-item command="title_and_tags" class="font-semibold text-primary">
                  <el-icon class="mr-1.5"><component :is="'MagicStick'"></component></el-icon>
                  <span>生成标题标签</span>
                </el-dropdown-item>
                <el-dropdown-item command="custom">
                  <el-icon class="mr-1.5"><component :is="'Operation'"></component></el-icon>
                  <span>自定义指令</span>
                </el-dropdown-item>
                <el-dropdown-item command="polish">
                  <el-icon class="mr-1.5"><component :is="'Brush'"></component></el-icon>
                  <span>文字润色</span>
                </el-dropdown-item>
                <el-dropdown-item command="shorten">
                  <el-icon class="mr-1.5"><component :is="'Scissor'"></component></el-icon>
                  <span>提炼精简</span>
                </el-dropdown-item>

                <el-dropdown-item command="continue" divided>
                  <el-icon class="mr-1.5"><component :is="'DocumentAdd'"></component></el-icon>
                  <span>续写下文</span>
                </el-dropdown-item>
                <el-dropdown-item command="expand">
                  <el-icon class="mr-1.5"><component :is="'Reading'"></component></el-icon>
                  <span>丰富论述扩写</span>
                </el-dropdown-item>
                <el-dropdown-item command="summarize">
                  <el-icon class="mr-1.5"><component :is="'Memo'"></component></el-icon>
                  <span>提取核心摘要</span>
                </el-dropdown-item>
                <el-dropdown-item command="translate">
                  <el-icon class="mr-1.5"><component :is="'Switch'"></component></el-icon>
                  <span>中英双向翻译</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <span class="syntax-divider"></span>

          <!-- 2. 标题下拉菜单 -->
          <el-dropdown trigger="click" @command="insertHeading">
            <button class="syntax-tool-btn" title="插入标题 (H1-H4)">
              <span class="font-bold text-xs">H</span>
              <el-icon class="ml-0.5 text-[10px]"><component :is="'ArrowDown'"></component></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu class="zenlink-custom-dropdown">
                <el-dropdown-item command="1"><span class="font-bold">H1</span><span class="ml-2 text-xs text-muted">一级大标题</span></el-dropdown-item>
                <el-dropdown-item command="2"><span class="font-bold">H2</span><span class="ml-2 text-xs text-muted">二级中标题</span></el-dropdown-item>
                <el-dropdown-item command="3"><span class="font-bold">H3</span><span class="ml-2 text-xs text-muted">三级小标题</span></el-dropdown-item>
                <el-dropdown-item command="4"><span class="font-bold">H4</span><span class="ml-2 text-xs text-muted">四级正文标题</span></el-dropdown-item>
                <el-dropdown-item command="0" divided><span class="text-xs">常规段落 (取消标题)</span></el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <!-- 3. 加粗/斜体/删除线 -->
          <button class="syntax-tool-btn" @click="insertWrap('**', '**', '加粗文本')" title="加粗 (Ctrl+B)">
            <span class="font-bold">B</span>
          </button>
          <button class="syntax-tool-btn" @click="insertWrap('*', '*', '斜体文本')" title="斜体 (Ctrl+I)">
            <span class="italic font-serif">I</span>
          </button>
          <button class="syntax-tool-btn" @click="insertWrap('~~', '~~', '删除文本')" title="删除线">
            <span class="line-through">S</span>
          </button>

          <span class="syntax-divider"></span>

          <!-- 4. 引用 / 待办 / 无序列表 / 有序列表 -->
          <button class="syntax-tool-btn" @click="insertBlockPrefix('> ')" title="引用块">
            <el-icon><component :is="'ChatLineSquare'"></component></el-icon>
          </button>
          <button class="syntax-tool-btn" @click="insertBlockPrefix('- [ ] ')" title="待办清单">
            <el-icon><component :is="'CircleCheck'"></component></el-icon>
          </button>
          <button class="syntax-tool-btn" @click="insertBlockPrefix('- ')" title="无序列表">
            <el-icon><component :is="'List'"></component></el-icon>
          </button>
          <button class="syntax-tool-btn" @click="insertBlockPrefix('1. ')" title="有序列表">
            <span class="font-mono text-xs font-bold">1.</span>
          </button>

          <span class="syntax-divider"></span>

          <!-- 5. 代码块 / 表格 / 链接 / 分割线 -->
          <button class="syntax-tool-btn" @click="insertWrap('\n```\n', '\n```\n', '代码内容')" title="代码块">
            <span class="font-mono text-xs">&lt;/&gt;</span>
          </button>
          <button class="syntax-tool-btn" @click="insertTable" title="插入表格">
            <el-icon><component :is="'Grid'"></component></el-icon>
          </button>
          <button class="syntax-tool-btn" @click="insertLink" title="插入链接">
            <el-icon><component :is="'Link'"></component></el-icon>
          </button>
          <button class="syntax-tool-btn" @click="insertWrap('\n---\n', '', '')" title="水平分割线">
            <el-icon><component :is="'SemiSelect'"></component></el-icon>
          </button>

          <span class="syntax-divider"></span>

          <!-- 6. 撤销 / 重做 / 清除格式 -->
          <button class="syntax-tool-btn" @click="undoText" title="撤销 (Ctrl+Z)">
            <el-icon><component :is="'Back'"></component></el-icon>
          </button>
          <button class="syntax-tool-btn" @click="redoText" title="重做 (Ctrl+Y)">
            <el-icon><component :is="'Right'"></component></el-icon>
          </button>
          <button class="syntax-tool-btn" @click="clearFormatting" title="清除选中格式">
            <el-icon><component :is="'Close'"></component></el-icon>
          </button>

          <!-- 7. 上传图片/附件 (靠左排列) -->
          <span class="syntax-divider"></span>
          <button
            class="syntax-tool-btn"
            :disabled="uploadingNoteFile"
            @click="triggerNoteFileUpload"
            title="上传图片或附件 (Ctrl+V 粘贴)"
          >
            <el-icon v-if="!uploadingNoteFile"><component :is="'Paperclip'"></component></el-icon>
            <el-icon v-else class="is-loading"><component :is="'Loading'"></component></el-icon>
          </button>
          <input ref="noteFileInputRef" type="file" hidden @change="onNoteFileChange" />
        </div>

        <!-- 内容分栏展示区域 (PC 端默认分栏，支持双栏同步滚动) -->
        <div class="notes-content-container" :class="viewMode">
          <!-- 1. 编辑框 -->
          <div v-show="viewMode === 'edit' || viewMode === 'split'" class="notes-editor-pane">
            <div class="notes-textarea-surface">
              <textarea
                ref="textareaRef"
                v-model="editContent"
                class="notes-native-textarea"
                placeholder="在此撰写 Markdown 笔记内容，支持快捷键 (Ctrl+B/I/S, Tab缩进, 回车智能列表)..."
                @keydown="handleTextareaKeyDown"
                @paste="handleNotesPaste"
                @scroll="onEditorScroll"
                @blur="saveNote"
              ></textarea>

              <!-- 编辑区右下角实时字数与精准保存状态指示器 -->
              <div class="editor-bottom-meta-row">
                <span class="editor-stat-text">{{ noteStats.chars }} 字符 · {{ noteStats.words }} 词</span>
                <div class="editor-save-indicator" :class="saveStatus">
                  <template v-if="saveStatus === 'saving'">
                    <el-icon class="is-loading mr-1"><component :is="'Loading'"></component></el-icon>
                    <span>正在保存...</span>
                  </template>
                  <template v-else-if="saveStatus === 'unsaved'">
                    <span class="unsaved-dot mr-1">●</span>
                    <span>未保存更改</span>
                  </template>
                  <template v-else>
                    <el-icon class="saved-icon mr-1"><component :is="'CircleCheck'"></component></el-icon>
                    <span>已保存 {{ lastSavedTime ? '于 ' + lastSavedTime : '' }}</span>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. 实时预览区 -->
          <div v-show="viewMode === 'preview' || viewMode === 'split'" class="notes-preview-pane">
            <div
              ref="previewWrapperRef"
              class="preview-scroll-wrapper"
              @scroll="onPreviewScroll"
              @click="handlePreviewClick"
            >
              <div
                v-if="editContent.trim()"
                class="ai-markdown-body"
                v-html="renderMarkdown(editContent)"
              />
              <div v-else class="preview-empty-hint">
                <el-icon class="empty-preview-icon"><component :is="'View'"></component></el-icon>
                <p>预览区域：在左侧输入 Markdown 内容即可在此实时呈现</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部状态栏 (55px 高度，左侧放视图切换，右侧严格顺序：分享 复制 导出 删除) -->
        <div class="notes-status-bar">
          <!-- 左侧：PC 端展示 [分栏 / 编辑 / 预览]；移动端展示 [编辑 / 预览] -->
          <div class="status-left">
            <!-- PC 端分栏控制组 -->
            <div v-if="!isMobile" class="notes-mode-capsule-group">
              <button
                class="notes-mode-btn"
                :class="{ active: viewMode === 'split' }"
                @click="viewMode = 'split'"
                title="双栏实时对照与同步滚动"
              >
                <el-icon class="mr-1 text-xs"><component :is="'Files'"></component></el-icon>
                <span>分栏</span>
              </button>
              <button
                class="notes-mode-btn"
                :class="{ active: viewMode === 'edit' }"
                @click="viewMode = 'edit'"
                title="纯编辑模式"
              >
                <el-icon class="mr-1 text-xs"><component :is="'EditPen'"></component></el-icon>
                <span>编辑</span>
              </button>
              <button
                class="notes-mode-btn"
                :class="{ active: viewMode === 'preview' }"
                @click="viewMode = 'preview'"
                title="纯预览模式"
              >
                <el-icon class="mr-1 text-xs"><component :is="'View'"></component></el-icon>
                <span>预览</span>
              </button>
            </div>

            <!-- 移动端模式切换 -->
            <div v-else class="notes-mode-capsule-group">
              <button
                class="notes-mode-btn"
                :class="{ active: viewMode === 'edit' }"
                @click="viewMode = 'edit'"
                title="编辑"
              >
                <el-icon class="mr-1 text-xs"><component :is="'EditPen'"></component></el-icon>
                <span>编辑</span>
              </button>
              <button
                class="notes-mode-btn"
                :class="{ active: viewMode === 'preview' }"
                @click="viewMode = 'preview'"
                title="预览"
              >
                <el-icon class="mr-1 text-xs"><component :is="'View'"></component></el-icon>
                <span>预览</span>
              </button>
            </div>
          </div>

          <!-- 右侧操作按钮组 (顺序：分享 复制 导出 删除；移动端正方形 32x32) -->
          <div class="status-right">
            <!-- 1. 分享按钮 (放置在右下角第一个) -->
            <button
              class="notes-status-act-btn"
              title="加密/限时分享此笔记"
              @click="openShareModal(selectedNote)"
            >
              <el-icon><component :is="'Share'"></component></el-icon>
              <span>分享</span>
            </button>

            <!-- 2. 复制按钮 -->
            <button
              class="notes-status-act-btn"
              @click="copyNoteContent(editContent)"
              title="复制 Markdown 全文"
            >
              <el-icon><component :is="'CopyDocument'"></component></el-icon>
              <span>复制</span>
            </button>

            <!-- 3. 导出下拉菜单 -->
            <el-dropdown trigger="click" placement="top-end">
              <button class="notes-status-act-btn" title="导出笔记文件">
                <el-icon><component :is="'Download'"></component></el-icon>
                <span>导出</span>
              </button>
              <template #dropdown>
                <el-dropdown-menu class="zenlink-custom-dropdown">
                  <el-dropdown-item @click="exportMarkdownFile">
                    <el-icon class="mr-1.5"><component :is="'Document'"></component></el-icon>导出为 Markdown (.md)
                  </el-dropdown-item>
                  <el-dropdown-item @click="exportHtmlFile">
                    <el-icon class="mr-1.5"><component :is="'Reading'"></component></el-icon>导出为网页 (.html)
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <!-- 4. 删除按钮 -->
            <button
              class="notes-status-act-btn danger-hover"
              @click="deleteNote(selectedNote)"
              title="删除此笔记"
            >
              <el-icon><component :is="'Delete'"></component></el-icon>
              <span>删除</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 笔记加密/限时分享与历史记录弹窗 (添加 align-center 垂直居中) -->
    <el-dialog
      v-model="showShareModal"
      :title="`🔗 分享笔记「${targetNoteForShare?.title || '未命名'}」`"
      width="480px"
      class="zenlink-custom-dialog"
      align-center
      append-to-body
    >
      <div class="mb-3 flex items-center gap-2 border-b border-light pb-2">
        <button
          type="button"
          class="share-tab-pill-btn"
          :class="{ active: activeShareTab === 'create' }"
          @click="activeShareTab = 'create'"
        >
          创建新分享
        </button>
        <button
          type="button"
          class="share-tab-pill-btn"
          :class="{ active: activeShareTab === 'history' }"
          @click="activeShareTab = 'history'"
        >
          历史分享 ({{ noteShareHistory.length }})
        </button>
      </div>

      <!-- 选项卡 1：创建分享 -->
      <div v-if="activeShareTab === 'create'">
        <div v-if="!createdShare" class="space-y-4 py-1">
          <div>
            <label class="block text-xs font-semibold text-muted mb-1">提取密码（可选，留空为公开免密）</label>
            <div class="flex gap-2">
              <el-input
                v-model="shareForm.password"
                placeholder="自定义密码或点击随机"
                maxlength="16"
                clearable
              />
              <el-button type="default" @click="generateRandomPassword">随机密码</el-button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-muted mb-1">有效时长</label>
            <el-select v-model="shareForm.expire_hours" class="w-full">
              <el-option :value="1" label="1 小时内有效" />
              <el-option :value="24" label="24 小时 (1天) 内有效" />
              <el-option :value="168" label="7 天内有效" />
              <el-option :value="0" label="永久有效" />
            </el-select>
          </div>

          <div class="flex items-center justify-between pt-1">
            <div>
              <div class="text-xs font-semibold">阅后即焚</div>
              <div class="text-[11px] text-muted">访问一次后立即自动销毁链接</div>
            </div>
            <el-switch v-model="shareForm.burn_after_reading" />
          </div>
        </div>

        <!-- 已生成分享结果展示 -->
        <div v-else class="space-y-3 py-1">
          <div class="p-3 bg-card border rounded-lg space-y-2">
            <div class="text-xs text-muted">分享链接：</div>
            <div class="text-xs font-mono break-all p-2 bg-main rounded border select-all">
              {{ createdShare.url }}
            </div>

            <div v-if="createdShare.password" class="text-xs flex items-center justify-between pt-1">
              <span class="text-muted">提取密码：</span>
              <span class="font-mono font-bold text-primary">{{ createdShare.password }}</span>
            </div>

            <div class="text-[11px] text-muted flex items-center justify-between pt-1 border-t">
              <span>有效期：{{ createdShare.expires_at ? formatDate(createdShare.expires_at) : '永久有效' }}</span>
              <span v-if="createdShare.burn_after_reading" class="text-red-500 font-medium">阅后即焚</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 选项卡 2：历史分享列表 -->
      <div v-else class="space-y-2.5 max-h-72 overflow-y-auto py-1">
        <div v-if="loadingHistory" class="text-center py-6 text-xs text-muted">
          <el-icon class="is-loading mr-1"><component is="Loading" /></el-icon> 加载分享历史...
        </div>
        <div v-else-if="!noteShareHistory.length" class="text-center py-8 text-xs text-muted">
          此笔记暂无历史分享记录
        </div>
        <div
          v-for="item in noteShareHistory"
          v-else
          :key="item.id"
          class="p-2.5 bg-card border rounded-lg flex items-center justify-between gap-3 text-xs"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="font-mono font-semibold text-primary truncate">
              /share/{{ item.id }}
            </div>
            <div class="flex items-center gap-2 text-[11px] text-muted flex-wrap">
              <span>密码: <strong class="text-main">{{ item.password || '免密' }}</strong></span>
              <span>访问: {{ item.views_count }} 次</span>
              <span v-if="item.burn_after_reading" class="text-red-500 font-medium">阅后即焚</span>
              <span>{{ item.expires_at ? '至 ' + formatDate(item.expires_at) : '永久有效' }}</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              class="notes-status-act-btn !h-6 !px-2 !text-[11px]"
              title="复制分享链接"
              @click="copyHistoryShare(item)"
            >
              复制
            </button>
            <button
              type="button"
              class="notes-status-act-btn danger-hover !h-6 !px-2 !text-[11px]"
              title="撤销/删除此分享"
              @click="revokeShare(item)"
            >
              撤销
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <template v-if="activeShareTab === 'create'">
            <template v-if="!createdShare">
              <el-button @click="showShareModal = false">关闭</el-button>
              <el-button
                type="primary"
                :loading="creatingShare"
                @click="submitCreateShare"
              >
                生成分享链接
              </el-button>
            </template>
            <template v-else>
              <el-button @click="createdShare = null">重新创建</el-button>
              <el-button type="primary" @click="copyShareLink(true)">
                复制链接与密码
              </el-button>
            </template>
          </template>
          <template v-else>
            <el-button @click="showShareModal = false">关闭</el-button>
          </template>
        </div>
      </template>
    </el-dialog>

    <!-- 自定义 AI 写作指令弹窗 (添加 align-center 垂直居中) -->
    <el-dialog
      v-model="showAiPromptDialog"
      title="✨ AI 自定义写作指令"
      width="440px"
      class="zenlink-custom-dialog"
      align-center
      append-to-body
    >
      <div class="space-y-3">
        <p class="text-xs text-muted">告诉 AI 您想如何处理当前笔记内容（支持扩写、转换为特定格式、风格改写等）：</p>
        <el-input
          v-model="customAiPrompt"
          type="textarea"
          :rows="3"
          placeholder="例如：将上述要点改写为生动易读的小红书/推文风格，并附带吸引人的标签..."
          autofocus
          @keydown.enter.ctrl="runAiAction('custom', customAiPrompt); showAiPromptDialog = false"
        />
      </div>
      <template #footer>
        <el-button @click="showAiPromptDialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!customAiPrompt.trim()"
          @click="runAiAction('custom', customAiPrompt); showAiPromptDialog = false"
        >
          开始执行
        </el-button>
      </template>
    </el-dialog>
  
    <!-- 图片全屏灯箱大图预览器 -->
    <el-image-viewer
      v-if="showImgViewer"
      :url-list="previewImgUrlList"
      @close="showImgViewer = false"
    />
  </div>
</template>
