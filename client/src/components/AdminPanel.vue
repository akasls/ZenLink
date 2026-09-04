<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useSiteStore, THEME_PRESETS } from '@/stores/site';
import { authApi, bookmarkApi, categoryApi, aiApi, storageApi, noteApi } from '@/api';
import { toast } from '@/components/ui/sonner';
import { confirmBox } from '@/utils/confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LogOut,
  Bookmark,
  Folder,
  Cpu,
  ShieldCheck,
  Settings,
  Search,
  Plus,
  Loader2,
  GripVertical,
  Lock,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronDown,
  RotateCw,
  CheckCircle2,
  Circle,
  Star,
  X,
  Key,
  Check,
  Upload,
  FolderOpen,
  Cloud,
  Network,
  Download,
  Sparkles,
} from 'lucide-vue-next';
import { startRegistration } from '@simplewebauthn/browser';
import Sortable from 'sortablejs';
import IconPicker from '@/components/IconPicker.vue';
import { mapIcon } from '@/utils/icon-map';
import { getAvatarChar, getAvatarColor } from '@/utils/avatar';

const authStore = useAuthStore();
const themeStore = useThemeStore();
const siteStore = useSiteStore();
const props = defineProps<{ categories: any[] }>();
const emit = defineEmits<{ refresh: [] }>();

const rowImgErrors = ref<Record<number, boolean>>({});
const modalImgError = ref(false);

const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
function onResize() {
  isMobile.value = window.innerWidth < 768;
}
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const activeTab = ref<'bookmarks' | 'categories' | 'ai' | 'security' | 'site'>('bookmarks');

// ==========================================
// 1. 书签管理 (默认 30 条 + 分页 + 拖拽排序)
// ==========================================
const bookmarks = ref<any[]>([]);
const loadingBookmarks = ref(false);
const bookmarkFilter = ref('');
const bookmarkCategoryFilter = ref<number>(0);
const showBookmarkDialog = ref(false);
const editingBookmark = ref<any>({});
const bookmarkListRef = ref<HTMLElement | null>(null);
const importInputRef = ref<HTMLInputElement | null>(null);
let bookmarkSortable: Sortable | null = null;

// 分页状态 (默认 30 条)
const currentPage = ref(1);
const pageSize = ref(30);

const filteredBookmarks = computed(() => {
  let list = bookmarks.value;
  if (bookmarkCategoryFilter.value && bookmarkCategoryFilter.value !== 0) {
    list = list.filter(b => b.category_id === bookmarkCategoryFilter.value);
  }
  if (bookmarkFilter.value) {
    const q = bookmarkFilter.value.toLowerCase();
    list = list.filter(b => (b.title && b.title.toLowerCase().includes(q)) || (b.url && b.url.toLowerCase().includes(q)));
  }
  return list;
});

const paginatedBookmarks = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredBookmarks.value.slice(start, start + pageSize.value);
});

const totalPages = computed(() => {
  return Math.ceil(filteredBookmarks.value.length / pageSize.value) || 1;
});

const visiblePages = computed(() => {
  const total = totalPages.value;
  const cur = currentPage.value;
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | string)[] = [];
  pages.push(1);
  if (cur > 3) pages.push('...');
  const start = Math.max(2, cur - 1);
  const end = Math.min(total - 1, cur + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (cur < total - 2) pages.push('...');
  pages.push(total);
  return pages;
});

watch([bookmarkFilter, bookmarkCategoryFilter], () => {
  currentPage.value = 1;
});

async function loadBookmarks() {
  loadingBookmarks.value = true;
  try {
    const { data } = await bookmarkApi.getAll();
    bookmarks.value = data.bookmarks;
  } finally {
    loadingBookmarks.value = false;
    setTimeout(() => initBookmarkSortable(), 100);
  }
}

function initBookmarkSortable() {
  nextTick(() => {
    const el = (bookmarkListRef.value as any)?.$el || bookmarkListRef.value;
    if (!el) return;
    if (bookmarkSortable) bookmarkSortable.destroy();
    bookmarkSortable = Sortable.create(el, {
      animation: 150,
      handle: '.bm-drag',
      onEnd: async (evt) => {
        if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) return;
        const pageItems = [...paginatedBookmarks.value];
        const [moved] = pageItems.splice(evt.oldIndex, 1);
        pageItems.splice(evt.newIndex, 0, moved);

        const start = (currentPage.value - 1) * pageSize.value;
        const fullItems = [...filteredBookmarks.value];
        fullItems.splice(start, pageItems.length, ...pageItems);

        try {
          await bookmarkApi.reorder(fullItems.map(b => b.id));
          toast.success('排序已更新');
          loadBookmarks();
          emit('refresh');
        } catch {}
      },
    });
  });
}

function getAdminRowFavicon(bm: any): string {
  if (!bm) return '';
  if (bm.favicon && (bm.favicon.startsWith('data:') || bm.favicon.startsWith('/api/'))) {
    return bm.favicon;
  }
  const params = new URLSearchParams();
  if (bm.url) params.set('url', bm.url);
  if (bm.favicon) params.set('icon', bm.favicon);
  if (bm.title) params.set('title', bm.title);
  return `/api/favicon?${params.toString()}`;
}

function openBookmarkDialog(bm?: any) {
  editingBookmark.value = bm ? { ...bm } : { title: '', url: '', description: '', backup_url: '', favicon: '', category_id: null, is_private: 0 };
  modalImgError.value = false;
  showBookmarkDialog.value = true;
}

async function saveBookmark() {
  const bm = editingBookmark.value;
  if (!bm.title || !bm.url) { toast.warning('请填写标题和链接'); return; }
  let finalFavicon = bm.favicon ? bm.favicon.trim() : '';
  if (!finalFavicon && bm.url) {
    finalFavicon = `/api/favicon?url=${encodeURIComponent(bm.url.trim())}`;
  }
  try {
    const p = {
      title: bm.title.trim(),
      url: bm.url.trim(),
      description: bm.description ? bm.description.trim() : '',
      backupUrl: bm.backup_url ? bm.backup_url.trim() : null,
      favicon: finalFavicon,
      categoryId: bm.category_id,
      isPrivate: !!bm.is_private
    };
    if (bm.id) await bookmarkApi.update(bm.id, p); else await bookmarkApi.create(p);
    showBookmarkDialog.value = false;
    toast.success('已保存');
    loadBookmarks(); emit('refresh');
  } catch { toast.error('保存失败'); }
}

async function fetchBookmarkMeta() {
  if (!editingBookmark.value.url) return;
  let url = editingBookmark.value.url.trim();
  if (!url.startsWith('http')) url = 'https://' + url;
  editingBookmark.value.url = url;
  modalImgError.value = false;
  try {
    const { data } = await bookmarkApi.fetchMeta(url);
    const meta = data.meta;
    const aiUsed = data.aiUsed;
    const scraped = data.scraped;
    let hasTitle = false;
    let hasDesc = false;

    if (meta.title) {
      editingBookmark.value.title = meta.title;
      hasTitle = true;
    }
    if (meta.description) {
      editingBookmark.value.description = meta.description;
      hasDesc = true;
    }
    if (meta.favicon) editingBookmark.value.favicon = meta.favicon;

    if (aiUsed && (hasTitle || hasDesc)) {
      toast.success('AI 已智能解析并提炼标题与简介');
    } else if (scraped && (hasTitle || hasDesc)) {
      toast.success('已自动抓取网站元数据并清洗');
    } else {
      toast.info('受目标站点网络或防爬限制未能抓取到详情，已根据网址生成推测标题');
    }
  } catch {
    toast.warning('未能获取到该网址信息，请手动填写');
  }
}

async function confirmDeleteBookmark(bm: any) {
  try {
    await confirmBox(`确定删除「${bm.title}」？`, '确认删除');
    await bookmarkApi.delete(bm.id);
    toast.success('已删除');
    loadBookmarks();
    emit('refresh');
  } catch {}
}

function getCategoryName(id: number | null) {
  if (!id) return '未分类';
  return props.categories.find(c => c.id === id)?.name || '未分类';
}

const categoryFilterOptions = computed(() => {
  const options: { id: number; name: string }[] = [{ id: 0, name: '全部分类' }];
  const tops = props.categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  for (const top of tops) {
    options.push({ id: top.id, name: top.name });
    const subs = props.categories.filter(c => c.parent_id === top.id).sort((a, b) => a.sort_order - b.sort_order);
    for (const sub of subs) {
      options.push({ id: sub.id, name: `└ ${sub.name}` });
    }
  }
  return options;
});

const categoryDialogOptions = computed(() => {
  const options: { id: number; name: string }[] = [];
  const tops = props.categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  for (const top of tops) {
    options.push({ id: top.id, name: top.name });
    const subs = props.categories.filter(c => c.parent_id === top.id).sort((a, b) => a.sort_order - b.sort_order);
    for (const sub of subs) {
      options.push({ id: sub.id, name: `└ ${sub.name}` });
    }
  }
  for (const c of props.categories) {
    if (!options.some(o => o.id === c.id)) {
      options.push({ id: c.id, name: c.name });
    }
  }
  return options;
});

// ==========================================
// 2. 分类管理 (一键展开/收起 + 一二级拖拽排序)
// ==========================================
const showCategoryDialog = ref(false);
const editingCategory = ref<any>({});
const expandedCategories = ref<number[]>([]);
const categoryListRef = ref<HTMLElement | null>(null);
let categorySortable: Sortable | null = null;
const subSortables: Sortable[] = [];

const categoryTree = computed(() => {
  const tops = props.categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  return tops.map(t => ({ ...t, children: props.categories.filter(c => c.parent_id === t.id).sort((a, b) => a.sort_order - b.sort_order) }));
});

const isAllExpanded = computed(() => {
  return categoryTree.value.length > 0 && expandedCategories.value.length >= categoryTree.value.length;
});

function toggleExpandAll() {
  if (isAllExpanded.value) {
    expandedCategories.value = [];
  } else {
    expandedCategories.value = categoryTree.value.map(c => c.id);
  }
  nextTick(initSubCategorySortables);
}

function toggleExpand(id: number) {
  const idx = expandedCategories.value.indexOf(id);
  if (idx >= 0) expandedCategories.value.splice(idx, 1);
  else expandedCategories.value.push(id);
  nextTick(initSubCategorySortables);
}

function openCategoryDialog(cat?: any, parentId?: number) {
  editingCategory.value = cat
    ? { ...cat }
    : { name: '', icon: 'Folder', parent_id: parentId !== undefined ? parentId : null, is_private: 0 };
  showCategoryDialog.value = true;
}

async function saveCategory() {
  const cat = editingCategory.value;
  if (!cat.name) { toast.warning('请填写分类名称'); return; }
  try {
    const p = { name: cat.name, icon: cat.icon || 'Folder', parentId: cat.parent_id || null, isPrivate: !!cat.is_private };
    if (cat.id) await categoryApi.update(cat.id, p); else await categoryApi.create(p);
    showCategoryDialog.value = false;
    toast.success('已保存');
    emit('refresh');
  } catch { toast.error('保存失败'); }
}

async function confirmDeleteCategory(cat: any) {
  try {
    await confirmBox(`确定删除分类「${cat.name}」？其下书签将变为未分类。`, '确认删除');
    await categoryApi.delete(cat.id);
    toast.success('已删除');
    emit('refresh');
  } catch {}
}

function initCategorySortable() {
  nextTick(() => {
    if (!categoryListRef.value) return;
    if (categorySortable) categorySortable.destroy();
    categorySortable = Sortable.create(categoryListRef.value, {
      animation: 150,
      handle: '.cat-drag',
      onEnd: async (evt) => {
        if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) return;
        const tops = [...categoryTree.value];
        const [moved] = tops.splice(evt.oldIndex, 1);
        tops.splice(evt.newIndex, 0, moved);
        for (let i = 0; i < tops.length; i++) {
          await categoryApi.update(tops[i].id, { sortOrder: i + 1 });
        }
        toast.success('分类排序已更新');
        emit('refresh');
      },
    });
    initSubCategorySortables();
  });
}

function initSubCategorySortables() {
  while (subSortables.length > 0) {
    const s = subSortables.pop();
    s?.destroy();
  }
  document.querySelectorAll('.cat-sub-sortable-container').forEach((containerEl) => {
    const parentId = Number(containerEl.getAttribute('data-parent-id'));
    const sort = Sortable.create(containerEl as HTMLElement, {
      animation: 150,
      handle: '.sub-drag',
      onEnd: async (evt) => {
        if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) return;
        const parent = categoryTree.value.find(c => c.id === parentId);
        if (!parent) return;
        const subs = [...parent.children];
        const [moved] = subs.splice(evt.oldIndex, 1);
        subs.splice(evt.newIndex, 0, moved);
        for (let i = 0; i < subs.length; i++) {
          await categoryApi.update(subs[i].id, { sortOrder: i + 1 });
        }
        toast.success('子分类排序已更新');
        emit('refresh');
      },
    });
    subSortables.push(sort);
  });
}

function topCategories() { return props.categories.filter(c => !c.parent_id); }

// ==========================================
// 3. AI 模型 (URL在上/Key在下 + 获取 + 框内+添加 + 星标默认)
// ==========================================
const aiSettings = ref({
  api_key: '',
  base_url: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  writing_model: 'deepseek-chat',
  bookmark_model: 'gpt-5.5',
  system_prompt: '你是一个知识渊博、高效简洁的智能全能助理。',
  has_api_key: 'false',
  api_key_masked: '',
  available_models: ['deepseek-chat', 'deepseek-reasoner'] as string[],
  temperature: 0.7,
  top_p: 0.95,
  max_tokens: 4096,
  reasoning_mode: false,
});

const savingAiSettings = ref(false);
const fetchingModels = ref(false);
const allFetchedModels = ref<string[]>([]);
const customModelName = ref('');

async function loadAiSettings() {
  try {
    const { data } = await aiApi.getSettings();
    if (data && data.settings) {
      aiSettings.value = { ...aiSettings.value, ...data.settings };
      if (data.settings.available_models !== undefined) {
        aiSettings.value.available_models = Array.isArray(data.settings.available_models)
          ? data.settings.available_models
          : (data.settings.available_models ? JSON.parse(data.settings.available_models) : []);
      }
      if (data.settings.all_models !== undefined) {
        allFetchedModels.value = Array.isArray(data.settings.all_models)
          ? data.settings.all_models
          : (data.settings.all_models ? JSON.parse(data.settings.all_models) : []);
      } else if (data.settings.available_models !== undefined) {
        allFetchedModels.value = [...aiSettings.value.available_models];
      } else {
        allFetchedModels.value = ['deepseek-chat', 'deepseek-reasoner'];
        aiSettings.value.available_models = ['deepseek-chat', 'deepseek-reasoner'];
      }
    }
  } catch (e) {
    console.error('加载 AI 设置失败', e);
  }
}

function removeModel(modelId: string) {
  const fIdx = allFetchedModels.value.indexOf(modelId);
  if (fIdx >= 0) {
    allFetchedModels.value.splice(fIdx, 1);
  }
  const aIdx = (aiSettings.value.available_models || []).indexOf(modelId);
  if (aIdx >= 0) {
    aiSettings.value.available_models.splice(aIdx, 1);
  }
  if (aiSettings.value.model === modelId) {
    aiSettings.value.model = aiSettings.value.available_models[0] || allFetchedModels.value[0] || '';
  }
  toast.success(`已删除模型「${modelId}」`);
  saveAdminAiSettings();
}

async function fetchOnlineModels() {
  fetchingModels.value = true;
  try {
    const { data } = await aiApi.fetchModels({
      base_url: aiSettings.value.base_url,
      api_key: aiSettings.value.api_key || undefined,
    });
    if (data && data.models && data.models.length > 0) {
      allFetchedModels.value = Array.from(new Set([
        ...data.models,
        ...aiSettings.value.available_models,
      ])).filter(Boolean).sort();
      if (!aiSettings.value.available_models || aiSettings.value.available_models.length === 0) {
        aiSettings.value.available_models = [...data.models];
      }
      toast.success(`成功读取到 ${data.models.length} 个模型`);
    } else {
      toast.warning('未能读取到模型列表');
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.error || '读取模型失败，请检查 Base URL 与 API Key');
  } finally {
    fetchingModels.value = false;
  }
}

function toggleModelCheck(modelId: string) {
  const list = aiSettings.value.available_models || [];
  const idx = list.indexOf(modelId);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(modelId);
  }
  if (list.length > 0 && !list.includes(aiSettings.value.model)) {
    aiSettings.value.model = list[0];
  }
}

function setDefaultModel(modelId: string) {
  aiSettings.value.model = modelId;
  if (!aiSettings.value.available_models.includes(modelId)) {
    aiSettings.value.available_models.push(modelId);
  }
  toast.success(`已将「${modelId}」设为默认模型`);
}

function selectAllModels() {
  aiSettings.value.available_models = [...allFetchedModels.value];
}

function clearAllModels() {
  allFetchedModels.value = [];
  aiSettings.value.available_models = [];
  aiSettings.value.model = '';
  toast.success('已清空模型列表');
  saveAdminAiSettings();
}

function addCustomModel() {
  const m = customModelName.value.trim();
  if (!m) return;
  if (!allFetchedModels.value.includes(m)) {
    allFetchedModels.value.push(m);
  }
  if (!aiSettings.value.available_models.includes(m)) {
    aiSettings.value.available_models.push(m);
  }
  customModelName.value = '';
  toast.success(`已添加: ${m}`);
}

async function saveAdminAiSettings() {
  savingAiSettings.value = true;
  try {
    await aiApi.saveSettings({
      api_key: aiSettings.value.api_key || undefined,
      base_url: aiSettings.value.base_url,
      model: aiSettings.value.model,
      writing_model: aiSettings.value.writing_model,
      bookmark_model: aiSettings.value.bookmark_model,
      system_prompt: aiSettings.value.system_prompt,
      available_models: aiSettings.value.available_models,
      all_models: allFetchedModels.value,
      temperature: aiSettings.value.temperature,
      top_p: aiSettings.value.top_p,
      max_tokens: aiSettings.value.max_tokens,
      reasoning_mode: aiSettings.value.reasoning_mode,
    });
    toast.success('AI 模型配置已保存');
    loadAiSettings();
  loadStorageSettings();
  } catch {
    toast.error('保存失败');
  } finally {
    savingAiSettings.value = false;
  }
}

// ==========================================

// ==========================================
// 3.1 传输助手 (Cloudflare R2 对象存储 / 本地存储)
// ==========================================
const storageSettings = ref({
  storage_type: 'local',
  r2_account_id: '',
  r2_access_key_id: '',
  r2_secret_access_key: '',
  r2_bucket_name: '',
  r2_public_domain: '',
  r2_secret_access_key_masked: '',
});
const savingStorage = ref(false);
const testingR2 = ref(false);

async function loadStorageSettings() {
  try {
    const { data } = await storageApi.getSettings();
    if (data && data.settings) {
      storageSettings.value = { ...storageSettings.value, ...data.settings };
    }
  } catch (e) {
    console.error('加载存储配置失败', e);
  }
}

async function testR2() {
  testingR2.value = true;
  try {
    const { data } = await storageApi.testConnection({
      r2_account_id: storageSettings.value.r2_account_id,
      r2_access_key_id: storageSettings.value.r2_access_key_id,
      r2_secret_access_key: storageSettings.value.r2_secret_access_key || undefined,
      r2_bucket_name: storageSettings.value.r2_bucket_name,
    });
    toast.success(data.message || 'Cloudflare R2 存储桶连通成功！');
  } catch (err: any) {
    toast.error(err.response?.data?.error || '连接 Cloudflare R2 失败，请检查配置');
  } finally {
    testingR2.value = false;
  }
}

async function saveStorage() {
  savingStorage.value = true;
  try {
    await storageApi.saveSettings({
      storage_type: storageSettings.value.storage_type,
      r2_account_id: storageSettings.value.r2_account_id,
      r2_access_key_id: storageSettings.value.r2_access_key_id,
      r2_secret_access_key: storageSettings.value.r2_secret_access_key || undefined,
      r2_bucket_name: storageSettings.value.r2_bucket_name,
      r2_public_domain: storageSettings.value.r2_public_domain,
    });
    toast.success('附件存储配置已保存');
    loadStorageSettings();
  } catch {
    toast.error('保存存储配置失败');
  } finally {
    savingStorage.value = false;
  }
}

// 4. 安全中心 (合并修改用户名与密码弹窗 + 统一2FA卡片)
// ==========================================
const showAccountDialog = ref(false);
const accountForm = ref({
  username: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const savingAccount = ref(false);

const totpSetup = ref<{ secret: string; qrCodeUrl: string } | null>(null);
const totpCode = ref('');
const settingUpTotp = ref(false);
const registeringPasskey = ref(false);

function openAccountDialog() {
  accountForm.value = {
    username: authStore.user?.username || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };
  showAccountDialog.value = true;
}

async function saveAccountSettings() {
  const f = accountForm.value;
  const usernameChanged = f.username.trim() && f.username.trim() !== authStore.user?.username;
  const passwordChanged = !!f.newPassword;

  if (!usernameChanged && !passwordChanged) {
    showAccountDialog.value = false;
    return;
  }

  if (passwordChanged) {
    if (!f.currentPassword) {
      toast.warning('修改密码需填写当前密码');
      return;
    }
    if (f.newPassword !== f.confirmPassword) {
      toast.warning('两次新密码输入不一致');
      return;
    }
  }

  savingAccount.value = true;
  try {
    if (usernameChanged) {
      await authApi.changeUsername({ newUsername: f.username.trim() });
    }
    if (passwordChanged) {
      await authApi.changePassword({ currentPassword: f.currentPassword, newPassword: f.newPassword });
    }
    toast.success('账户安全信息更新成功');
    showAccountDialog.value = false;
    authStore.fetchUser();
  } catch (e: any) {
    toast.error(e?.response?.data?.message || '更新失败');
  } finally {
    savingAccount.value = false;
  }
}

async function startTotpSetup() {
  settingUpTotp.value = true;
  try {
    const { data } = await authApi.setupTotp();
    totpSetup.value = { secret: data.secret, qrCodeUrl: data.qrCodeUrl };
  } catch { toast.error('获取 2FA 配置失败'); }
  finally { settingUpTotp.value = false; }
}

async function confirmTotp() {
  if (!totpCode.value || totpCode.value.length !== 6) { toast.warning('请输入 6 位验证码'); return; }
  try {
    await authApi.verifyTotp(totpCode.value);
    toast.success('TOTP 两步验证已启用');
    totpSetup.value = null;
    totpCode.value = '';
    authStore.fetchUser();
  } catch (e: any) { toast.error(e?.response?.data?.message || '验证码错误'); }
}

async function registerPasskey() {
  registeringPasskey.value = true;
  try {
    const { data: options } = await authApi.getWebAuthnRegisterOptions();
    const regResult = await startRegistration(options);
    await authApi.verifyWebAuthnRegister(regResult);
    toast.success('Passkey 绑定成功');
    authStore.fetchUser();
  } catch (e: any) {
    if (e.name !== 'NotAllowedError') {
      toast.error(e?.response?.data?.message || 'Passkey 注册失败');
    }
  } finally { registeringPasskey.value = false; }
}

// ==========================================
// 5. 站点设置 (精简版 + 实时生效)
// ==========================================
const logoUploadInputRef = ref<HTMLInputElement | null>(null);
const uploadingLogo = ref(false);
const bgUploadInputRef = ref<HTMLInputElement | null>(null);
const uploadingBg = ref(false);

const colorPresets = THEME_PRESETS;

const siteForm = ref({
  siteName: siteStore.siteName,
  siteDesc: siteStore.siteDesc,
  siteLogo: siteStore.siteLogo || '',
  defaultEngine: siteStore.defaultEngine,
  searchBgMode: siteStore.searchBgMode || 'dynamic',
  searchBgImage: siteStore.searchBgImage || '',
  themePrimaryColor: siteStore.themePrimaryColor || '#6366f1',
  enableAi: (siteStore as any).enableAi ?? true,
  enableNotes: (siteStore as any).enableNotes ?? true,
});

watch(() => [siteStore.siteName, siteStore.siteDesc, siteStore.siteLogo, siteStore.defaultEngine, siteStore.searchBgMode, siteStore.searchBgImage, siteStore.themePrimaryColor, (siteStore as any).enableAi, (siteStore as any).enableNotes], () => {
  siteForm.value.siteName = siteStore.siteName;
  siteForm.value.siteDesc = siteStore.siteDesc;
  siteForm.value.siteLogo = siteStore.siteLogo || '';
  siteForm.value.defaultEngine = siteStore.defaultEngine;
  siteForm.value.searchBgMode = siteStore.searchBgMode || 'dynamic';
  siteForm.value.searchBgImage = siteStore.searchBgImage || '';
  siteForm.value.themePrimaryColor = siteStore.themePrimaryColor || '#f1404b';
  siteForm.value.enableAi = (siteStore as any).enableAi ?? true;
  siteForm.value.enableNotes = (siteStore as any).enableNotes ?? true;
}, { immediate: true });

async function handleLogoUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  uploadingLogo.value = true;
  try {
    const { data } = await noteApi.uploadAttachment(file);
    const url = data.file?.url || ('/api/notes/raw/' + data.file?.path);
    siteForm.value.siteLogo = url;
    siteStore.setSiteLogo(url);
    toast.success('网站图标上传成功并已即时生效');
  } catch {
    toast.error('网站图标上传失败');
  } finally {
    uploadingLogo.value = false;
    target.value = '';
  }
}

function clearCustomLogo() {
  siteForm.value.siteLogo = '';
  siteStore.setSiteLogo('');
  toast.success('已恢复为默认首字母图标');
}

function selectThemeColor(color: string) {
  siteForm.value.themePrimaryColor = color;
  siteStore.setThemePrimaryColor(color);
}

async function handleBgUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  uploadingBg.value = true;
  try {
    const { data } = await noteApi.uploadAttachment(file);
    const url = data.file?.url || ('/api/notes/raw/' + data.file?.path);
    siteForm.value.searchBgImage = url;
    siteForm.value.searchBgMode = 'custom_image';
    siteStore.searchBgImage = url;
    siteStore.searchBgMode = 'custom_image';
    toast.success('背景图片上传成功并已实时预览');
  } catch {
    toast.error('背景图片上传失败');
  } finally {
    uploadingBg.value = false;
    target.value = '';
  }
}

function clearCustomBg() {
  siteForm.value.searchBgImage = '';
  siteForm.value.searchBgMode = 'dynamic';
  siteStore.searchBgImage = '';
  siteStore.searchBgMode = 'dynamic';
  toast.success('已重置为默认动态海洋背景');
}

async function saveSiteSettings() {
  try {
    await siteStore.saveSettings({
      site_name: siteForm.value.siteName,
      site_desc: siteForm.value.siteDesc,
      site_logo: siteForm.value.siteLogo,
      default_engine: siteForm.value.defaultEngine,
      search_bg_mode: siteForm.value.searchBgMode,
      search_bg_image: siteForm.value.searchBgImage,
      theme_primary_color: siteForm.value.themePrimaryColor,
    });
    toast.success('站点设置已保存并即时生效');
  } catch {
    toast.error('保存失败');
  }
}

async function exportBookmarks() {
  try {
    const { data } = await bookmarkApi.getAll();
    const blob = new Blob([JSON.stringify(data.bookmarks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zenlink-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  } catch { toast.error('导出失败'); }
}

async function handleImportBookmarks(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    if (file.name.endsWith('.json')) {
      const items = JSON.parse(text);
      if (Array.isArray(items)) {
        let count = 0;
        for (const item of items) {
          if (item.title && item.url) {
            await bookmarkApi.create({
              title: item.title,
              url: item.url,
              description: item.description || '',
              favicon: item.favicon || '',
              categoryId: null,
            });
            count++;
          }
        }
        toast.success(`成功导入 ${count} 个书签`);
        loadBookmarks(); emit('refresh');
      }
    } else {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const links = doc.querySelectorAll('a');
      let count = 0;
      for (const a of links) {
        const href = a.getAttribute('href');
        const title = a.textContent?.trim();
        const icon = a.getAttribute('icon');
        if (href && title && !href.startsWith('place:') && !href.startsWith('javascript:')) {
          await bookmarkApi.create({
            title: title || href,
            url: href,
            description: '',
            favicon: icon || '',
            categoryId: null,
          });
          count++;
        }
      }
      toast.success(`成功导入 ${count} 个 HTML 书签`);
      loadBookmarks(); emit('refresh');
    }
  } catch (err) {
    toast.error('导入解析失败，请检查文件格式');
  } finally {
    target.value = '';
  }
}

watch(activeTab, (t) => {
  if (t === 'bookmarks') initBookmarkSortable();
  if (t === 'categories') initCategorySortable();
  if (t === 'ai') loadAiSettings();
});

function handleLogout() {
  authStore.logout();
  toast.success('已退出管理登录');
  emit('refresh');
}

onMounted(() => {
  loadBookmarks();
  loadAiSettings();
  siteStore.fetchSettings();
  props.categories.filter(c => !c.parent_id).forEach(c => expandedCategories.value.push(c.id));
});
</script>

<template>
  <div class="flex flex-col min-h-screen bg-background text-foreground">
    <!-- 1. 顶栏 -->
    <div class="h-12 px-4 border-b border-border bg-card flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-foreground tracking-tight">系统管理中心</span>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-7 px-2.5 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          @click="handleLogout()"
          title="退出管理账户"
        >
          <LogOut class="h-3.5 w-3.5 mr-1" />
          <span>退出登录</span>
        </Button>
      </div>
    </div>

    <!-- 2. 主体自适应工作区 -->
    <div class="flex-1 p-4 sm:p-5 max-w-5xl w-full mx-auto space-y-4">
      <Tabs v-model="activeTab" class="w-full space-y-4">
        <!-- 页面内部一级 Tab 菜单栏 -->
        <TabsList class="grid grid-cols-5 w-full h-9 p-1 bg-muted">
          <TabsTrigger value="bookmarks" class="gap-1.5 text-xs font-medium">
            <Bookmark class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">书签管理</span>
            <span class="sm:hidden">书签</span>
          </TabsTrigger>
          <TabsTrigger value="categories" class="gap-1.5 text-xs font-medium">
            <Folder class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">分类管理</span>
            <span class="sm:hidden">分类</span>
          </TabsTrigger>
          <TabsTrigger value="ai" class="gap-1.5 text-xs font-medium">
            <Cpu class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">AI 模型</span>
            <span class="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger value="security" class="gap-1.5 text-xs font-medium">
            <ShieldCheck class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">安全中心</span>
            <span class="sm:hidden">安全</span>
          </TabsTrigger>
          <TabsTrigger value="site" class="gap-1.5 text-xs font-medium">
            <Settings class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">站点设置</span>
            <span class="sm:hidden">设置</span>
          </TabsTrigger>
        </TabsList>

        <!-- Tab 1：书签管理 -->
        <TabsContent value="bookmarks" class="space-y-3 mt-0">
          <!-- 统一单行工具栏 -->
          <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap bg-card p-2.5 rounded-lg border border-border shadow-xs">
            <!-- 1. 搜索框 -->
            <div class="relative flex-1 min-w-[180px]">
              <Search class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                v-model="bookmarkFilter"
                type="text"
                class="pl-8 h-8 text-xs bg-background"
                placeholder="搜索书签标题或网址..."
              />
            </div>

            <!-- 2. 分类下拉 -->
            <Select :model-value="String(bookmarkCategoryFilter)" @update:model-value="bookmarkCategoryFilter = Number($event)">
              <SelectTrigger class="h-8 w-36 text-xs flex-shrink-0">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in categoryFilterOptions"
                  :key="opt.id"
                  :value="String(opt.id)"
                >
                  {{ opt.name }}
                </SelectItem>
              </SelectContent>
            </Select>

            <!-- 3. 添加按钮 -->
            <Button
              size="sm"
              class="h-8 px-3 text-xs gap-1 flex-shrink-0"
              @click="openBookmarkDialog()"
            >
              <Plus class="h-3.5 w-3.5" />
              <span>添加书签</span>
            </Button>
          </div>

          <!-- 链接列表 -->
          <div v-if="loadingBookmarks" class="py-12 text-center text-muted-foreground">
            <Loader2 class="h-6 w-6 animate-spin mx-auto text-primary" />
          </div>
          <div v-else-if="!filteredBookmarks.length" class="py-12 bg-card border border-border rounded-lg text-center">
            <p class="text-xs text-muted-foreground">暂无符合条件的导航书签</p>
          </div>
          <div v-else class="space-y-3">
            <div class="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow class="bg-muted/40 hover:bg-muted/40">
                    <TableHead class="w-10 text-center"></TableHead>
                    <TableHead class="w-10 text-center">图标</TableHead>
                    <TableHead>标题 / 网址</TableHead>
                    <TableHead class="w-32">分类</TableHead>
                    <TableHead class="w-20 text-center">状态</TableHead>
                    <TableHead class="w-24 text-right pr-4">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody ref="bookmarkListRef">
                  <TableRow
                    v-for="bm in paginatedBookmarks"
                    :key="bm.id"
                    class="group hover:bg-muted/40 transition-colors"
                  >
                    <!-- 拖拽手柄 -->
                    <TableCell class="text-center py-2.5">
                      <span class="bm-drag text-muted-foreground/60 hover:text-foreground cursor-grab inline-flex items-center" title="拖拽排序">
                        <GripVertical class="h-3.5 w-3.5" />
                      </span>
                    </TableCell>

                    <!-- 图标 -->
                    <TableCell class="py-2.5 text-center">
                      <div class="w-6 h-6 rounded-md bg-muted flex items-center justify-center overflow-hidden mx-auto border border-border/50">
                        <img
                          v-if="!rowImgErrors[bm.id]"
                          :src="getAdminRowFavicon(bm)"
                          class="w-full h-full object-contain"
                          alt=""
                          @error="rowImgErrors[bm.id] = true"
                        />
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center text-white text-[9px] font-bold uppercase"
                          :style="{ backgroundColor: getAvatarColor(bm.title || bm.url) }"
                        >
                          {{ getAvatarChar(bm.title, bm.url) }}
                        </div>
                      </div>
                    </TableCell>

                    <!-- 标题 / 网址 -->
                    <TableCell class="py-2.5">
                      <div class="flex flex-col min-w-0 max-w-xs sm:max-w-md">
                        <span class="text-xs font-medium text-foreground truncate" :title="bm.title">{{ bm.title }}</span>
                        <span class="text-[11px] text-muted-foreground truncate font-mono" :title="bm.url">{{ bm.url }}</span>
                      </div>
                    </TableCell>

                    <!-- 分类 -->
                    <TableCell class="py-2.5">
                      <Badge variant="secondary" class="font-normal text-[11px] px-2 py-0.5">
                        {{ getCategoryName(bm.category_id) }}
                      </Badge>
                    </TableCell>

                    <!-- 状态 -->
                    <TableCell class="text-center py-2.5">
                      <Badge v-if="bm.is_private" variant="outline" class="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px] gap-0.5">
                        <Lock class="h-2.5 w-2.5" /> 私有
                      </Badge>
                      <span v-else class="text-[11px] text-muted-foreground">公开</span>
                    </TableCell>

                    <!-- 操作 -->
                    <TableCell class="text-right py-2.5 pr-4">
                      <div class="flex items-center justify-end gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="text-muted-foreground hover:text-foreground"
                          title="编辑书签"
                          @click="openBookmarkDialog(bm)"
                        >
                          <Pencil class="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="删除书签"
                          @click="confirmDeleteBookmark(bm)"
                        >
                          <Trash2 class="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <!-- 分页栏 -->
            <div v-if="filteredBookmarks.length > pageSize" class="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <div class="text-[11px] text-muted-foreground">
                共 <strong class="font-semibold text-foreground">{{ filteredBookmarks.length }}</strong> 条 · 第 <strong class="font-semibold text-foreground">{{ currentPage }}</strong> / <strong>{{ totalPages }}</strong> 页
              </div>
              <div class="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-xs"
                  class="h-7 w-7"
                  :disabled="currentPage <= 1"
                  @click="currentPage--"
                  title="上一页"
                >
                  <ChevronLeft class="h-3.5 w-3.5" />
                </Button>

                <template v-for="(p, idx) in visiblePages" :key="idx">
                  <span v-if="p === '...'" class="px-1 text-muted-foreground text-xs">...</span>
                  <Button
                    v-else
                    :variant="currentPage === p ? 'default' : 'outline'"
                    size="icon-xs"
                    class="h-7 w-7 text-xs"
                    @click="currentPage = Number(p)"
                  >
                    {{ p }}
                  </Button>
                </template>

                <Button
                  variant="outline"
                  size="icon-xs"
                  class="h-7 w-7"
                  :disabled="currentPage >= totalPages"
                  @click="currentPage++"
                  title="下一页"
                >
                  <ChevronRight class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <!-- Tab 2：分类管理 -->
        <TabsContent value="categories" class="space-y-3 mt-0">
          <div class="flex items-center justify-between bg-card p-2.5 rounded-lg border border-border shadow-xs">
            <Button
              variant="outline"
              size="sm"
              class="h-8 gap-1.5 text-xs font-medium"
              @click="toggleExpandAll"
            >
              <ChevronsUpDown class="h-3.5 w-3.5" />
              <span>{{ isAllExpanded ? '收起所有分类' : '一键展开所有分类' }}</span>
            </Button>

            <Button
              size="sm"
              class="h-8 px-3 text-xs gap-1 font-medium"
              @click="openCategoryDialog()"
            >
              <Plus class="h-3.5 w-3.5" />
              <span>新建一级分类</span>
            </Button>
          </div>

          <div ref="categoryListRef" class="space-y-2">
            <div v-for="cat in categoryTree" :key="cat.id" class="bg-card rounded-lg border border-border shadow-xs overflow-hidden">
              <!-- 一级分类行 -->
              <div class="group flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors">
                <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
                  <span class="cat-drag text-muted-foreground/60 hover:text-foreground cursor-grab inline-flex items-center" title="拖拽排序">
                    <GripVertical class="h-3.5 w-3.5" />
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="h-5 w-5 text-muted-foreground hover:text-foreground"
                    @click.stop="toggleExpand(cat.id)"
                  >
                    <ChevronDown v-if="expandedCategories.includes(cat.id)" class="h-3.5 w-3.5" />
                    <ChevronRight v-else class="h-3.5 w-3.5" />
                  </Button>
                  <component :is="mapIcon(cat.icon)" class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span class="text-xs font-semibold text-foreground truncate">{{ cat.name }}</span>
                  <Badge v-if="cat.is_private" variant="outline" class="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px] px-1 py-0">私有</Badge>
                  <span class="text-[11px] text-muted-foreground font-normal">({{ cat.children.length }} 个子分类)</span>
                </div>

                <div class="flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-foreground"
                    @click.stop="openCategoryDialog(undefined, cat.id)"
                    title="添加子分类"
                  >
                    <Plus class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-foreground"
                    @click.stop="openCategoryDialog(cat)"
                    title="编辑分类"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    @click.stop="confirmDeleteCategory(cat)"
                    title="删除分类"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <!-- 二级子分类列表 -->
              <div v-show="expandedCategories.includes(cat.id)" class="border-t border-border/60 bg-muted/20 p-2 space-y-1">
                <div class="cat-sub-sortable-container space-y-1" :data-parent-id="cat.id">
                  <div
                    v-for="sub in cat.children"
                    :key="sub.id"
                    class="group flex items-center justify-between px-3 py-1.5 rounded-md bg-card border border-border/60 hover:bg-muted/40 transition-colors"
                  >
                    <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
                      <span class="sub-drag text-muted-foreground/60 hover:text-foreground cursor-grab inline-flex items-center" title="拖拽排序">
                        <GripVertical class="h-3.5 w-3.5" />
                      </span>
                      <span class="text-muted-foreground text-xs font-mono">└</span>
                      <component :is="mapIcon(sub.icon)" class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span class="text-xs text-foreground/90 truncate">{{ sub.name }}</span>
                      <Badge v-if="sub.is_private" variant="outline" class="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px] px-1 py-0">私有</Badge>
                    </div>

                    <div class="flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        class="text-muted-foreground hover:text-foreground"
                        @click.stop="openCategoryDialog(sub)"
                        title="编辑子分类"
                      >
                        <Pencil class="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        @click.stop="confirmDeleteCategory(sub)"
                        title="删除子分类"
                      >
                        <Trash2 class="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div v-if="!cat.children.length" class="text-center py-2 text-[11px] text-muted-foreground">
                  暂无二级子分类
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <!-- Tab 3：AI 模型与推理参数 -->
        <TabsContent value="ai" class="space-y-4 mt-0">
          <Card>
            <CardHeader class="pb-3">
              <CardTitle class="text-sm font-semibold flex items-center gap-2">
                <Cpu class="h-4 w-4 text-primary" />
                <span>AI 模型与推理参数</span>
              </CardTitle>
              <CardDescription class="text-xs">
                配置兼容 OpenAI / DeepSeek 标准的 API 端点、密钥以及推理参数
              </CardDescription>
            </CardHeader>

            <CardContent class="space-y-4">
              <!-- 1. API Base URL -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">API Base URL</label>
                <Input v-model="aiSettings.base_url" placeholder="https://api.deepseek.com/v1" />
              </div>

              <!-- 2. API Key -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">API Key</label>
                <Input
                  v-model="aiSettings.api_key"
                  type="password"
                  :placeholder="aiSettings.has_api_key === 'true' ? `已配置 (${aiSettings.api_key_masked})，输入新密钥可覆盖` : 'sk-...'"
                />
              </div>

              <!-- 3. 启用模型 -->
              <div class="space-y-2 p-3 rounded-md bg-muted/40 border border-border/70">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-xs text-foreground">启用模型列表</span>
                  <div class="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-6 px-2 text-[11px] font-medium gap-1"
                      :disabled="fetchingModels"
                      @click="fetchOnlineModels"
                    >
                      <Loader2 v-if="fetchingModels" class="h-3 w-3 animate-spin text-primary" />
                      <RotateCw v-else class="h-3 w-3 text-muted-foreground" />
                      <span>{{ fetchingModels ? '获取中...' : '获取' }}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-6 px-2 text-[11px] font-medium"
                      @click="selectAllModels"
                    >
                      全选
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-6 px-2 text-[11px] font-medium"
                      @click="clearAllModels"
                    >
                      清空
                    </Button>
                  </div>
                </div>

                <!-- 模型芯片网格 -->
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-1">
                  <div v-if="allFetchedModels.length === 0" class="text-xs text-muted-foreground py-2 col-span-full text-center">
                    暂无模型，可点击上方「获取」或在下方输入名称添加
                  </div>
                  <div
                    v-for="m in allFetchedModels"
                    :key="m"
                    class="flex items-center justify-between px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer"
                    :class="[
                      (aiSettings.available_models || []).includes(m)
                        ? 'bg-muted border-primary/40 text-foreground font-medium'
                        : 'bg-card border-border text-muted-foreground hover:border-border/80'
                    ]"
                    @click="toggleModelCheck(m)"
                  >
                    <div class="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
                      <CheckCircle2 v-if="(aiSettings.available_models || []).includes(m)" class="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <Circle v-else class="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span class="text-xs truncate">{{ m }}</span>
                    </div>

                    <div class="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        class="cursor-pointer"
                        :class="aiSettings.model === m ? 'text-amber-500 hover:text-amber-500' : 'text-muted-foreground hover:text-foreground'"
                        @click.stop="setDefaultModel(m)"
                        :title="aiSettings.model === m ? '当前默认模型' : '点击设为默认模型'"
                      >
                        <Star class="h-3.5 w-3.5" :class="aiSettings.model === m ? 'fill-amber-500 text-amber-500' : ''" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        class="text-muted-foreground hover:text-destructive cursor-pointer"
                        @click.stop="removeModel(m)"
                        title="删除此模型"
                      >
                        <X class="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <!-- 手动添加模型 -->
                <div class="flex items-center gap-2 mt-1">
                  <Input
                    v-model="customModelName"
                    placeholder="手动添加模型名称 (如 qwen-plus)"
                    class="h-8 text-xs"
                    @keyup.enter="addCustomModel"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    class="h-8 px-2.5 text-xs font-medium gap-1 shrink-0"
                    @click="addCustomModel"
                  >
                    <Plus class="h-3.5 w-3.5" />
                    <span>添加</span>
                  </Button>
                </div>
              </div>

              <!-- 专属模型 -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-foreground/90">在线笔记写作专属模型</label>
                  <Select
                    :model-value="aiSettings.writing_model || '__default__'"
                    @update:model-value="aiSettings.writing_model = $event === '__default__' ? '' : $event"
                  >
                    <SelectTrigger class="w-full h-9 text-xs">
                      <SelectValue placeholder="跟随全局默认" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">跟随全局默认</SelectItem>
                      <SelectItem v-for="m in allFetchedModels" :key="m" :value="m">{{ m }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-foreground/90">导航书签解析专属模型</label>
                  <Select
                    :model-value="aiSettings.bookmark_model || '__default__'"
                    @update:model-value="aiSettings.bookmark_model = $event === '__default__' ? '' : $event"
                  >
                    <SelectTrigger class="w-full h-9 text-xs">
                      <SelectValue placeholder="跟随全局默认" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">跟随全局默认</SelectItem>
                      <SelectItem v-for="m in allFetchedModels" :key="m" :value="m">{{ m }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <!-- 深度思考开关 -->
              <div class="flex items-center justify-between p-3 rounded-md border border-border bg-muted/30">
                <div>
                  <div class="text-xs font-semibold text-foreground">深度思考 (Reasoning CoT)</div>
                  <div class="text-[11px] text-muted-foreground">开启后大模型将展开深入步骤思考</div>
                </div>
                <Switch :checked="aiSettings.reasoning_mode" @update:checked="aiSettings.reasoning_mode = $event" />
              </div>

              <!-- 采样温度 -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-xs font-medium text-muted-foreground">
                    采样温度 (Temperature): <span class="font-mono font-semibold text-foreground">{{ aiSettings.temperature }}</span>
                  </label>
                  <span class="text-[11px] text-muted-foreground">
                    {{ aiSettings.temperature < 0.4 ? '严谨精准' : aiSettings.temperature > 1.0 ? '创意发散' : '通用平衡' }}
                  </span>
                </div>
                <Slider
                  :model-value="[aiSettings.temperature]"
                  :min="0"
                  :max="2"
                  :step="0.05"
                  @update:model-value="aiSettings.temperature = $event?.[0] ?? 0.7"
                />
              </div>

              <!-- Top-P -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-xs font-medium text-muted-foreground">
                    核采样 (Top-P): <span class="font-mono font-semibold text-foreground">{{ aiSettings.top_p }}</span>
                  </label>
                </div>
                <Slider
                  :model-value="[aiSettings.top_p]"
                  :min="0.1"
                  :max="1"
                  :step="0.05"
                  @update:model-value="aiSettings.top_p = $event?.[0] ?? 0.95"
                />
              </div>

              <!-- Max Tokens -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">单次最大生成 Token 数 (Max Tokens)</label>
                <Input v-model.number="aiSettings.max_tokens" type="number" :min="256" :max="16384" :step="512" class="w-full" />
              </div>

              <!-- 全局系统提示词 -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">全局系统提示词 (System Prompt)</label>
                <Textarea
                  v-model="aiSettings.system_prompt"
                  :rows="3"
                  placeholder="设置 AI 助手的全局角色定位与回复规范"
                />
              </div>
            </CardContent>

            <CardFooter class="border-t pt-3 flex items-center justify-between">
              <span class="text-xs text-muted-foreground">当前默认模型：<strong class="text-foreground font-semibold">{{ aiSettings.model || '未设定' }}</strong></span>
              <Button
                size="sm"
                class="gap-1.5"
                :disabled="savingAiSettings"
                @click="saveAdminAiSettings"
              >
                <Loader2 v-if="savingAiSettings" class="h-3.5 w-3.5 animate-spin" />
                <span>{{ savingAiSettings ? '保存中...' : '保存配置' }}</span>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <!-- Tab 4：安全中心 -->
        <TabsContent value="security" class="space-y-4 mt-0">
          <!-- 1. 账户卡片 -->
          <Card>
            <CardHeader class="pb-4">
              <div class="flex justify-between items-center">
                <div>
                  <CardTitle class="text-sm font-semibold">账户与登录密码</CardTitle>
                  <CardDescription class="text-xs mt-0.5">
                    当前账户: <strong class="text-foreground font-semibold">{{ authStore.user?.username }}</strong>
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1.5 text-xs font-medium"
                  @click="openAccountDialog"
                >
                  <Pencil class="h-3.5 w-3.5" />
                  <span>修改用户名与密码</span>
                </Button>
              </div>
            </CardHeader>
          </Card>

          <!-- 2. 多重身份认证卡片 -->
          <Card>
            <CardHeader class="pb-3">
              <CardTitle class="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck class="h-4 w-4 text-primary" />
                <span>多重身份认证 (MFA)</span>
              </CardTitle>
              <CardDescription class="text-xs">
                通过 TOTP 动态口令及 WebAuthn / Passkey 保护系统免受未授权访问
              </CardDescription>
            </CardHeader>

            <CardContent class="space-y-4">
              <!-- 上部：两步验证 (TOTP) -->
              <div class="flex justify-between items-center pb-3 border-b border-border/60">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-foreground">两步验证 (TOTP)</span>
                    <Badge
                      :variant="authStore.user?.totp_enabled ? 'default' : 'secondary'"
                      class="text-[10px] px-1.5 py-0"
                    >
                      {{ authStore.user?.totp_enabled ? '已启用' : '未启用' }}
                    </Badge>
                  </div>
                  <p class="text-xs text-muted-foreground mt-0.5">基于 Google Authenticator、1Password 等动态验证码应用</p>
                </div>
                <Button
                  v-if="!authStore.user?.totp_enabled"
                  size="sm"
                  class="h-8 gap-1 text-xs"
                  :disabled="settingUpTotp"
                  @click="startTotpSetup"
                >
                  <Lock class="h-3.5 w-3.5" />
                  <span>配置 2FA</span>
                </Button>
              </div>

              <!-- TOTP 配置中区域 -->
              <div v-if="!authStore.user?.totp_enabled && totpSetup" class="space-y-3 py-3 border-b border-border/60">
                <div class="flex justify-center"><img :src="totpSetup.qrCodeUrl" class="w-32 h-32 border rounded-md" /></div>
                <p class="text-[11px] text-muted-foreground text-center break-all font-mono">{{ totpSetup.secret }}</p>
                <div class="flex gap-2 max-w-sm mx-auto">
                  <Input v-model="totpCode" placeholder="输入 6 位验证码" maxlength="6" class="flex-1 h-8 text-xs" />
                  <Button size="sm" class="h-8 text-xs" @click="confirmTotp">确认绑定</Button>
                </div>
              </div>

              <!-- 下部：Passkey 免密登录 -->
              <div class="flex justify-between items-center">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-foreground">Passkey 免密登录</span>
                    <Badge
                      :variant="authStore.user?.webauthn_enabled ? 'default' : 'secondary'"
                      class="text-[10px] px-1.5 py-0"
                    >
                      {{ authStore.user?.webauthn_enabled ? '已绑定' : '未绑定' }}
                    </Badge>
                  </div>
                  <p class="text-xs text-muted-foreground mt-0.5">指纹 / Face ID / Windows Hello 硬件免密</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1.5 text-xs font-medium"
                  :disabled="registeringPasskey"
                  @click="registerPasskey"
                >
                  <Key class="h-3.5 w-3.5" />
                  <span>绑定 Passkey</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Tab 5：站点设置 -->
        <TabsContent value="site" class="space-y-4 mt-0">
          <Card>
            <CardHeader class="pb-3">
              <CardTitle class="text-sm font-semibold flex items-center gap-2">
                <Settings class="h-4 w-4 text-primary" />
                <span>站点设置与外观定制</span>
              </CardTitle>
              <CardDescription class="text-xs">
                自定义站点名称、主题色系、主页背景及搜索引擎
              </CardDescription>
            </CardHeader>

            <CardContent class="space-y-4">
              <!-- 1. 外观深浅模式 -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">外观主题</label>
                <Tabs :model-value="themeStore.mode" @update:model-value="(val) => themeStore.setMode(val as any)">
                  <TabsList class="h-8">
                    <TabsTrigger value="system" class="text-xs px-3">跟随系统</TabsTrigger>
                    <TabsTrigger value="light" class="text-xs px-3">日间浅色</TabsTrigger>
                    <TabsTrigger value="dark" class="text-xs px-3">夜间深色</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <!-- 2. 主品牌色 -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">系统主品牌色 (实时生效)</label>
                <div class="flex items-center gap-2 flex-wrap">
                  <Button
                    v-for="p in colorPresets"
                    :key="p.color"
                    variant="outline"
                    size="sm"
                    class="h-7 rounded-full gap-1.5 px-2.5 text-xs cursor-pointer"
                    :class="{ 'border-primary ring-2 ring-primary/20 font-semibold text-foreground bg-accent/60': siteForm.themePrimaryColor === p.color }"
                    @click="selectThemeColor(p.color)"
                  >
                    <span class="w-3 h-3 rounded-full shrink-0 shadow-xs" :style="{ backgroundColor: p.color }"></span>
                    <span class="text-[11px]">{{ p.name }}</span>
                    <Check v-if="siteForm.themePrimaryColor === p.color" class="h-3 w-3 text-primary shrink-0" />
                  </Button>

                  <div class="flex items-center gap-2 ml-1">
                    <input
                      type="color"
                      :value="siteForm.themePrimaryColor"
                      class="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                      @input="siteStore.setThemePrimaryColor(($event.target as HTMLInputElement).value)"
                    />
                    <span class="text-xs font-mono text-muted-foreground">{{ siteForm.themePrimaryColor }}</span>
                  </div>
                </div>
              </div>

              <!-- 3. 搜索背景图 -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">导航主页搜索组件背景图</label>
                <div class="space-y-2 p-3 rounded-md border border-border bg-muted/30 w-full">
                  <div class="flex items-center gap-2">
                    <Input
                      v-model="siteForm.searchBgImage"
                      placeholder="输入背景图片 URL 或点击右侧上传..."
                      class="flex-1"
                      @input="siteStore.searchBgImage = siteForm.searchBgImage"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-9 px-2.5 text-xs gap-1 shrink-0"
                      :disabled="uploadingBg"
                      @click="bgUploadInputRef?.click()"
                    >
                      <Loader2 v-if="uploadingBg" class="h-3 w-3 animate-spin text-primary" />
                      <Upload v-else class="h-3 w-3 text-muted-foreground" />
                      <span>{{ uploadingBg ? '上传中...' : '上传图片' }}</span>
                    </Button>
                    <input ref="bgUploadInputRef" type="file" accept="image/*" hidden @change="handleBgUpload" />
                  </div>

                  <div v-if="siteForm.searchBgImage" class="relative rounded-md overflow-hidden border border-border h-24 flex items-center justify-center">
                    <img :src="siteForm.searchBgImage" alt="搜索背景图" class="w-full h-full object-cover" />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      class="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white hover:bg-black/80"
                      title="清除背景图"
                      @click="clearCustomBg"
                    >
                      <X class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">站点名称</label>
                <Input v-model="siteForm.siteName" placeholder="ZenLink" />
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">站点描述</label>
                <Input v-model="siteForm.siteDesc" placeholder="干净简洁的导航！" />
              </div>

              <!-- 网站 Logo -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">网站图标与站标 (Logo / Favicon)</label>
                <div class="space-y-2 p-3 rounded-md border border-border bg-muted/30 w-full">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center flex-shrink-0 overflow-hidden relative group">
                      <img v-if="siteForm.siteLogo" :src="siteForm.siteLogo" alt="Logo" class="w-full h-full object-cover" />
                      <span v-else class="font-bold text-sm text-foreground">{{ (siteForm.siteName || 'Z').trim().charAt(0) }}</span>
                      <Button
                        v-if="siteForm.siteLogo"
                        variant="ghost"
                        size="icon"
                        class="absolute inset-0 w-full h-full bg-black/60 text-white rounded-none hover:bg-black/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="清除"
                        @click="clearCustomLogo"
                      >
                        <Trash2 class="h-4 w-4" />
                      </Button>
                    </div>

                    <div class="flex-1 space-y-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <Input
                          v-model="siteForm.siteLogo"
                          placeholder="输入图片 URL 或点击右侧上传..."
                          class="flex-1"
                          @input="siteStore.setSiteLogo(siteForm.siteLogo)"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          class="h-9 px-2.5 text-xs gap-1 shrink-0"
                          :disabled="uploadingLogo"
                          @click="logoUploadInputRef?.click()"
                        >
                          <Loader2 v-if="uploadingLogo" class="h-3 w-3 animate-spin text-primary" />
                          <Upload v-else class="h-3 w-3 text-muted-foreground" />
                          <span>{{ uploadingLogo ? '上传中...' : '上传' }}</span>
                        </Button>
                        <input ref="logoUploadInputRef" type="file" accept="image/*" hidden @change="handleLogoUpload" />
                      </div>
                      <p class="text-[11px] text-muted-foreground m-0">支持 PNG/SVG/ICO/JPG 格式</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">默认搜索引擎</label>
                <Select v-model="siteForm.defaultEngine">
                  <SelectTrigger class="w-full h-9 text-xs">
                    <SelectValue placeholder="选择默认搜索引擎" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="bing">Bing</SelectItem>
                    <SelectItem value="duckduckgo">DuckDuckGo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- 功能模块开关 -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-foreground/90">功能模块开关</label>
                <div class="space-y-2 p-3 rounded-md border border-border bg-muted/30 w-full">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-xs font-semibold text-foreground">开启 AI 助手</div>
                      <div class="text-[11px] text-muted-foreground">开启后可在侧边栏使用 AI 助手</div>
                    </div>
                    <Switch :checked="siteForm.enableAi" @update:checked="siteForm.enableAi = $event" />
                  </div>

                  <div class="border-t border-border/60 pt-2 flex items-center justify-between">
                    <div>
                      <div class="text-xs font-semibold text-foreground">开启在线笔记</div>
                      <div class="text-[11px] text-muted-foreground">开启后可在侧边栏使用在线笔记</div>
                    </div>
                    <Switch :checked="siteForm.enableNotes" @update:checked="siteForm.enableNotes = $event" />
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter class="border-t pt-3 flex justify-end">
              <Button
                size="sm"
                class="gap-1.5"
                @click="saveSiteSettings"
              >
                <Check class="h-3.5 w-3.5" />
                <span>保存设置</span>
              </Button>
            </CardFooter>
          </Card>

          <!-- 存储驱动 -->
          <Card>
            <CardHeader class="pb-3">
              <CardTitle class="text-sm font-semibold flex items-center gap-2">
                <Cloud class="h-4 w-4 text-primary" />
                <span>附件存储驱动设置</span>
              </CardTitle>
              <CardDescription class="text-xs">
                配置文件与在线笔记附件的持久化存储驱动
              </CardDescription>
            </CardHeader>

            <CardContent class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-foreground/90 mb-1.5">当前存储位置</label>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    class="p-3 rounded-md border cursor-pointer transition-colors flex items-center justify-between"
                    :class="storageSettings.storage_type === 'local' ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'"
                    @click="storageSettings.storage_type = 'local'"
                  >
                    <div class="flex items-center gap-2">
                      <FolderOpen class="h-5 w-5 text-primary" />
                      <div>
                        <div class="text-xs font-semibold text-foreground">本地服务器存储 (Local)</div>
                        <div class="text-[11px] text-muted-foreground">文件保存在 data/uploads 目录</div>
                      </div>
                    </div>
                    <Check v-if="storageSettings.storage_type === 'local'" class="h-4 w-4 text-primary" />
                  </div>

                  <div
                    class="p-3 rounded-md border cursor-pointer transition-colors flex items-center justify-between"
                    :class="storageSettings.storage_type === 'r2' ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'"
                    @click="storageSettings.storage_type = 'r2'"
                  >
                    <div class="flex items-center gap-2">
                      <Cloud class="h-5 w-5 text-primary" />
                      <div>
                        <div class="text-xs font-semibold text-foreground">Cloudflare R2 对象存储</div>
                        <div class="text-[11px] text-muted-foreground">全球 CDN 直链加速</div>
                      </div>
                    </div>
                    <Check v-if="storageSettings.storage_type === 'r2'" class="h-4 w-4 text-primary" />
                  </div>
                </div>
              </div>

              <!-- R2 参数 -->
              <div v-if="storageSettings.storage_type === 'r2'" class="space-y-3 p-3.5 rounded-md border border-border bg-muted/30">
                <div class="flex items-center justify-between pb-2 border-b border-border/60">
                  <span class="text-xs font-semibold text-foreground">Cloudflare R2 凭据配置</span>
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-6 px-2 text-[11px] font-medium gap-1"
                    :disabled="testingR2"
                    @click="testR2"
                  >
                    <Loader2 v-if="testingR2" class="h-3 w-3 animate-spin text-primary" />
                    <Network v-else class="h-3 w-3 text-muted-foreground" />
                    <span>{{ testingR2 ? '测试中...' : '测试连接' }}</span>
                  </Button>
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-foreground/90">Cloudflare Account ID</label>
                  <Input v-model="storageSettings.r2_account_id" placeholder="例如：a1b2c3d4e5f6..." />
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-foreground/90">R2 存储桶名称 (Bucket Name)</label>
                  <Input v-model="storageSettings.r2_bucket_name" placeholder="例如：zenlink-notes" />
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-foreground/90">Access Key ID</label>
                  <Input v-model="storageSettings.r2_access_key_id" placeholder="R2 Access Key ID" />
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-foreground/90">Secret Access Key</label>
                  <Input
                    v-model="storageSettings.r2_secret_access_key"
                    type="password"
                    :placeholder="storageSettings.r2_secret_access_key_masked ? `已配置 (${storageSettings.r2_secret_access_key_masked})，输入新密钥可覆盖` : 'R2 Secret Access Key'"
                  />
                </div>

                <div class="space-y-1.5">
                  <label class="block text-xs font-medium text-foreground/90">公开访问域名 / 自定义 CDN 域名 (可选)</label>
                  <Input v-model="storageSettings.r2_public_domain" placeholder="https://pub-xxxx.r2.dev 或 https://cdn.yourdomain.com" />
                </div>
              </div>
            </CardContent>

            <CardFooter class="border-t pt-3 flex items-center justify-between">
              <span class="text-xs text-muted-foreground">当前存储驱动：<strong class="text-foreground font-semibold">{{ storageSettings.storage_type === 'r2' ? 'Cloudflare R2' : '本地服务器' }}</strong></span>
              <Button
                size="sm"
                class="gap-1.5"
                :disabled="savingStorage"
                @click="saveStorage"
              >
                <Loader2 v-if="savingStorage" class="h-3.5 w-3.5 animate-spin" />
                <Check v-else class="h-3.5 w-3.5" />
                <span>{{ savingStorage ? '保存中...' : '保存存储设置' }}</span>
              </Button>
            </CardFooter>
          </Card>

          <!-- 数据备份 -->
          <Card>
            <CardHeader class="pb-3">
              <CardTitle class="text-sm font-semibold flex items-center gap-2">
                <Download class="h-4 w-4 text-primary" />
                <span>数据备份与导入</span>
              </CardTitle>
              <CardDescription class="text-xs">
                导出系统完整数据备份，或从浏览器书签导入
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div class="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1.5 text-xs font-medium"
                  @click="exportBookmarks"
                >
                  <Download class="h-3.5 w-3.5" />
                  <span>导出 JSON</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1.5 text-xs font-medium"
                  @click="importInputRef?.click()"
                >
                  <Upload class="h-3.5 w-3.5" />
                  <span>导入 (HTML / JSON)</span>
                </Button>
                <input ref="importInputRef" type="file" accept=".json,.html,.htm" hidden @change="handleImportBookmarks" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>

    <!-- 对话框：账户安全 -->
    <Dialog :open="showAccountDialog" @update:open="showAccountDialog = $event">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>账户安全设置</DialogTitle>
        </DialogHeader>
        <div class="space-y-3 py-2 text-xs">
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">用户名</label>
            <Input v-model="accountForm.username" placeholder="管理员用户名" class="h-8 text-xs" />
          </div>

          <div class="pt-2 border-t border-border/60 space-y-3">
            <p class="text-xs text-muted-foreground">如无需修改密码，以下密码项留空即可：</p>
            <div class="space-y-1.5">
              <label class="font-medium text-foreground/90">当前密码</label>
              <Input v-model="accountForm.currentPassword" type="password" placeholder="修改密码时需验证当前密码" class="h-8 text-xs" />
            </div>
            <div class="space-y-1.5">
              <label class="font-medium text-foreground/90">新密码</label>
              <Input v-model="accountForm.newPassword" type="password" placeholder="输入新密码" class="h-8 text-xs" />
            </div>
            <div class="space-y-1.5">
              <label class="font-medium text-foreground/90">确认新密码</label>
              <Input v-model="accountForm.confirmPassword" type="password" placeholder="再次输入新密码" class="h-8 text-xs" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="showAccountDialog = false">取消</Button>
          <Button size="sm" :disabled="savingAccount" @click="saveAccountSettings">
            <Loader2 v-if="savingAccount" class="h-3.5 w-3.5 animate-spin mr-1" />
            <span>保存修改</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 对话框：书签添加/编辑 -->
    <Dialog :open="showBookmarkDialog" @update:open="showBookmarkDialog = $event">
      <DialogContent class="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{{ editingBookmark.id ? '编辑书签' : '添加书签' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-3 py-2 text-xs">
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">网址链接 <span class="text-red-500">*</span></label>
            <div class="flex gap-2 w-full">
              <Input v-model="editingBookmark.url" placeholder="https://..." class="flex-1 h-8 text-xs" />
              <Button variant="outline" size="sm" class="h-8 text-xs shrink-0" @click="fetchBookmarkMeta">
                <Sparkles class="h-3.5 w-3.5 mr-1 text-primary" />
                <span>AI 解析</span>
              </Button>
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">标题 <span class="text-red-500">*</span></label>
            <Input v-model="editingBookmark.title" placeholder="书签标题" class="h-8 text-xs" />
          </div>
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">描述</label>
            <Textarea v-model="editingBookmark.description" placeholder="书签描述..." class="text-xs resize-none h-16" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <label class="font-medium text-foreground/90">图标 URL</label>
              <div class="flex items-center gap-2 w-full">
                <Input v-model="editingBookmark.favicon" placeholder="留空自动抓取" class="flex-1 h-8 text-xs" />
                <div class="w-5 h-5 flex items-center justify-center rounded-full overflow-hidden flex-shrink-0">
                  <img
                    v-if="!modalImgError && (editingBookmark.url || editingBookmark.favicon)"
                    :src="getAdminRowFavicon(editingBookmark)"
                    class="w-full h-full object-contain rounded-full"
                    alt=""
                    @error="modalImgError = true"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center text-white text-[10px] font-bold rounded-full"
                    :style="{ backgroundColor: getAvatarColor(editingBookmark.title || editingBookmark.url) }"
                  >
                    {{ getAvatarChar(editingBookmark.title, editingBookmark.url) }}
                  </div>
                </div>
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="font-medium text-foreground/90">备用链接</label>
              <Input v-model="editingBookmark.backup_url" placeholder="备用链接" class="h-8 text-xs" />
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">所属分类</label>
            <Select
              :model-value="editingBookmark.category_id ? String(editingBookmark.category_id) : '__none__'"
              @update:model-value="editingBookmark.category_id = $event === '__none__' ? null : Number($event)"
            >
              <SelectTrigger class="w-full h-8 text-xs">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">选择分类</SelectItem>
                <SelectItem
                  v-for="opt in categoryDialogOptions"
                  :key="opt.id"
                  :value="String(opt.id)"
                >
                  {{ opt.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label class="flex items-center gap-2 cursor-pointer text-xs select-none pt-1">
            <Checkbox
              :checked="editingBookmark.is_private === 1"
              @update:checked="editingBookmark.is_private = $event ? 1 : 0"
            />
            <span>私有书签（仅登录后可见）</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="showBookmarkDialog = false">取消</Button>
          <Button size="sm" @click="saveBookmark">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 对话框：分类新建/编辑 -->
    <Dialog :open="showCategoryDialog" @update:open="showCategoryDialog = $event">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{{ editingCategory.id ? '编辑分类' : '新建分类' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-3 py-2 text-xs">
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">分类名称 <span class="text-red-500">*</span></label>
            <Input v-model="editingCategory.name" placeholder="分类名称" class="h-8 text-xs" />
          </div>
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">图标</label>
            <IconPicker v-model="editingCategory.icon" />
          </div>
          <div class="space-y-1.5">
            <label class="font-medium text-foreground/90">上级分类</label>
            <Select
              :model-value="editingCategory.parent_id ? String(editingCategory.parent_id) : '__none__'"
              @update:model-value="editingCategory.parent_id = $event === '__none__' ? null : Number($event)"
            >
              <SelectTrigger class="w-full h-8 text-xs">
                <SelectValue placeholder="无 (一级分类)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">无 (一级分类)</SelectItem>
                <SelectItem v-for="cat in topCategories()" :key="cat.id" :value="String(cat.id)">
                  {{ cat.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label class="flex items-center gap-2 cursor-pointer text-xs select-none pt-1">
            <Checkbox
              :checked="editingCategory.is_private === 1"
              @update:checked="editingCategory.is_private = $event ? 1 : 0"
            />
            <span>私有分类</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="showCategoryDialog = false">取消</Button>
          <Button size="sm" @click="saveCategory">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
