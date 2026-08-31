<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useSiteStore } from '@/stores/site';
import { authApi, bookmarkApi, categoryApi, aiApi, storageApi, noteApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';
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
    if (!bookmarkListRef.value) return;
    if (bookmarkSortable) bookmarkSortable.destroy();
    bookmarkSortable = Sortable.create(bookmarkListRef.value, {
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
          ElMessage.success('排序已更新');
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
  if (!bm.title || !bm.url) { ElMessage.warning('请填写标题和链接'); return; }
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
    ElMessage.success('已保存');
    loadBookmarks(); emit('refresh');
  } catch { ElMessage.error('保存失败'); }
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
      ElMessage.success('AI 已智能解析并提炼标题与简介');
    } else if (scraped && (hasTitle || hasDesc)) {
      ElMessage.success('已自动抓取网站元数据并清洗');
    } else {
      ElMessage.info('受目标站点网络或防爬限制未能抓取到详情，已根据网址生成推测标题');
    }
  } catch {
    ElMessage.warning('未能获取到该网址信息，请手动填写');
  }
}

function confirmDeleteBookmark(bm: any) {
  ElMessageBox.confirm(`确定删除「${bm.title}」？`, '确认删除', {
    type: 'warning',
    customClass: 'zenlink-custom-msgbox',
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    confirmButtonClass: 'el-button--danger',
  })
    .then(async () => { await bookmarkApi.delete(bm.id); ElMessage.success('已删除'); loadBookmarks(); emit('refresh'); })
    .catch(() => {});
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
  if (!cat.name) { ElMessage.warning('请填写分类名称'); return; }
  try {
    const p = { name: cat.name, icon: cat.icon || 'Folder', parentId: cat.parent_id || null, isPrivate: !!cat.is_private };
    if (cat.id) await categoryApi.update(cat.id, p); else await categoryApi.create(p);
    showCategoryDialog.value = false;
    ElMessage.success('已保存');
    emit('refresh');
  } catch { ElMessage.error('保存失败'); }
}

function confirmDeleteCategory(cat: any) {
  ElMessageBox.confirm(`确定删除分类「${cat.name}」？其下书签将变为未分类。`, '确认删除', {
    type: 'warning',
    customClass: 'zenlink-custom-msgbox',
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    confirmButtonClass: 'el-button--danger',
  })
    .then(async () => { await categoryApi.delete(cat.id); ElMessage.success('已删除'); emit('refresh'); })
    .catch(() => {});
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
        ElMessage.success('分类排序已更新');
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
        ElMessage.success('子分类排序已更新');
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
  ElMessage.success(`已删除模型「${modelId}」`);
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
      ElMessage.success(`成功读取到 ${data.models.length} 个模型`);
    } else {
      ElMessage.warning('未能读取到模型列表');
    }
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '读取模型失败，请检查 Base URL 与 API Key');
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
  ElMessage.success(`已将「${modelId}」设为默认模型`);
}

function selectAllModels() {
  aiSettings.value.available_models = [...allFetchedModels.value];
}

function clearAllModels() {
  allFetchedModels.value = [];
  aiSettings.value.available_models = [];
  aiSettings.value.model = '';
  ElMessage.success('已清空模型列表');
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
  ElMessage.success(`已添加: ${m}`);
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
    ElMessage.success('AI 模型配置已保存');
    loadAiSettings();
  loadStorageSettings();
  } catch {
    ElMessage.error('保存失败');
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
    ElMessage.success(data.message || 'Cloudflare R2 存储桶连通成功！');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '连接 Cloudflare R2 失败，请检查配置');
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
    ElMessage.success('附件存储配置已保存');
    loadStorageSettings();
  } catch {
    ElMessage.error('保存存储配置失败');
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
      ElMessage.warning('修改密码需填写当前密码');
      return;
    }
    if (f.newPassword !== f.confirmPassword) {
      ElMessage.warning('两次新密码输入不一致');
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
    ElMessage.success('账户安全信息更新成功');
    showAccountDialog.value = false;
    authStore.fetchUser();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '更新失败');
  } finally {
    savingAccount.value = false;
  }
}

async function startTotpSetup() {
  settingUpTotp.value = true;
  try {
    const { data } = await authApi.setupTotp();
    totpSetup.value = { secret: data.secret, qrCodeUrl: data.qrCodeUrl };
  } catch { ElMessage.error('获取 2FA 配置失败'); }
  finally { settingUpTotp.value = false; }
}

async function confirmTotp() {
  if (!totpCode.value || totpCode.value.length !== 6) { ElMessage.warning('请输入 6 位验证码'); return; }
  try {
    await authApi.verifyTotp(totpCode.value);
    ElMessage.success('TOTP 两步验证已启用');
    totpSetup.value = null;
    totpCode.value = '';
    authStore.fetchUser();
  } catch (e: any) { ElMessage.error(e?.response?.data?.message || '验证码错误'); }
}

async function registerPasskey() {
  registeringPasskey.value = true;
  try {
    const { data: options } = await authApi.getWebAuthnRegisterOptions();
    const regResult = await startRegistration(options);
    await authApi.verifyWebAuthnRegister(regResult);
    ElMessage.success('Passkey 绑定成功');
    authStore.fetchUser();
  } catch (e: any) {
    if (e.name !== 'NotAllowedError') {
      ElMessage.error(e?.response?.data?.message || 'Passkey 注册失败');
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

const colorPresets = [
  { name: '经典不凡红', color: '#f1404b' },
  { name: '科技极光蓝', color: '#3b82f6' },
  { name: '灵动翡翠绿', color: '#10b981' },
  { name: '幻影极客紫', color: '#8b5cf6' },
  { name: '暖阳琥珀橙', color: '#f59e0b' },
  { name: '曜石暗夜黑', color: '#18181b' },
];

const siteForm = ref({
  siteName: siteStore.siteName,
  siteDesc: siteStore.siteDesc,
  siteLogo: siteStore.siteLogo || '',
  defaultEngine: siteStore.defaultEngine,
  searchBgMode: siteStore.searchBgMode || 'dynamic',
  searchBgImage: siteStore.searchBgImage || '',
  themePrimaryColor: siteStore.themePrimaryColor || '#f1404b',
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
    ElMessage.success('网站图标上传成功并已即时生效');
  } catch {
    ElMessage.error('网站图标上传失败');
  } finally {
    uploadingLogo.value = false;
    target.value = '';
  }
}

function clearCustomLogo() {
  siteForm.value.siteLogo = '';
  siteStore.setSiteLogo('');
  ElMessage.success('已恢复为默认首字母图标');
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
    ElMessage.success('背景图片上传成功并已实时预览');
  } catch {
    ElMessage.error('背景图片上传失败');
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
  ElMessage.success('已重置为默认动态海洋背景');
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
    ElMessage.success('站点设置已保存并即时生效');
  } catch {
    ElMessage.error('保存失败');
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
    ElMessage.success('导出成功');
  } catch { ElMessage.error('导出失败'); }
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
        ElMessage.success(`成功导入 ${count} 个书签`);
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
      ElMessage.success(`成功导入 ${count} 个 HTML 书签`);
      loadBookmarks(); emit('refresh');
    }
  } catch (err) {
    ElMessage.error('导入解析失败，请检查文件格式');
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
  ElMessage.success('已退出管理登录');
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
  <div class="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
    <!-- 1. 顶栏 -->
    <div class="h-12 px-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">系统管理中心</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="h-7 px-2.5 rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 text-slate-600 dark:text-slate-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          @click="handleLogout()"
          title="退出管理账户"
        >
          <el-icon class="text-xs"><component is="SwitchButton" /></el-icon>
          <span>退出登录</span>
        </button>
      </div>
    </div>

    <!-- 2. 主体自适应工作区 -->
    <div class="flex-1 p-4 sm:p-5 max-w-5xl w-full mx-auto space-y-4">
      <!-- 页面内部一级 Tab 菜单栏 -->
      <div class="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto scrollbar-none">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          :class="[
            activeTab === 'bookmarks'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          ]"
          @click="activeTab = 'bookmarks'"
        >
          <el-icon class="text-xs"><component is="Collection" /></el-icon>
          <span>书签管理</span>
        </button>

        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          :class="[
            activeTab === 'categories'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          ]"
          @click="activeTab = 'categories'"
        >
          <el-icon class="text-xs"><component is="Folder" /></el-icon>
          <span>分类管理</span>
        </button>

        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          :class="[
            activeTab === 'ai'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          ]"
          @click="activeTab = 'ai'"
        >
          <el-icon class="text-xs"><component is="Cpu" /></el-icon>
          <span>AI 模型</span>
        </button>

        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          :class="[
            activeTab === 'security'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          ]"
          @click="activeTab = 'security'"
        >
          <el-icon class="text-xs"><component is="Lock" /></el-icon>
          <span>安全中心</span>
        </button>

        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          :class="[
            activeTab === 'site'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          ]"
          @click="activeTab = 'site'"
        >
          <el-icon class="text-xs"><component is="Setting" /></el-icon>
          <span>站点设置</span>
        </button>
      </div>

      <!-- Tab 1：书签管理 -->
      <div v-if="activeTab === 'bookmarks'" class="space-y-3">
        <!-- 统一单行工具栏 -->
        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-subtle">
          <!-- 1. 搜索框 -->
          <div class="flex-1 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1 min-w-[180px]">
            <el-icon class="text-xs text-slate-400 mr-1.5"><component is="Search" /></el-icon>
            <input
              v-model="bookmarkFilter"
              type="text"
              class="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none placeholder-slate-400 dark:placeholder-slate-500"
              placeholder="搜索书签标题或网址..."
            />
          </div>

          <!-- 2. 分类下拉 -->
          <el-select
            v-model="bookmarkCategoryFilter"
            size="small"
            class="w-36 flex-shrink-0"
            placeholder="所属分类"
          >
            <el-option
              v-for="opt in categoryFilterOptions"
              :key="opt.id"
              :label="opt.name"
              :value="opt.id"
            />
          </el-select>

          <!-- 3. 添加按钮 -->
          <button
            type="button"
            class="h-7 px-3 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-white flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
            @click="openBookmarkDialog()"
          >
            <el-icon class="text-xs"><component is="Plus" /></el-icon>
            <span>添加书签</span>
          </button>
        </div>

        <!-- 链接列表 -->
        <div v-if="loadingBookmarks" class="py-12 text-center text-slate-400">
          <el-icon class="is-loading text-xl"><component is="Loading" /></el-icon>
        </div>
        <div v-else-if="!filteredBookmarks.length" class="py-12 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg">
          <el-empty description="暂无符合条件的导航书签" />
        </div>
        <div v-else class="space-y-2">
          <div ref="bookmarkListRef" class="space-y-1.5">
            <div
              v-for="bm in paginatedBookmarks"
              :key="bm.id"
              class="group flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-md transition-colors"
            >
              <!-- 左侧：拖拽 + 图标 + 标题 + 分类 + 私有锁 -->
              <div class="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                <span class="bm-drag text-slate-400 hover:text-slate-600 cursor-grab flex items-center" title="拖拽排序">
                  <el-icon class="text-xs"><component is="Rank" /></el-icon>
                </span>
                <div class="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
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

                <span class="text-xs font-medium text-slate-800 dark:text-slate-200 truncate" :title="bm.title">{{ bm.title }}</span>
                <span class="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex-shrink-0 font-normal">
                  {{ getCategoryName(bm.category_id) }}
                </span>
                <el-icon v-if="bm.is_private" class="text-xs text-amber-500 flex-shrink-0" title="私有书签"><component is="Lock" /></el-icon>
              </div>

              <!-- 右侧操作 (编辑 + 删除) -->
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  @click="openBookmarkDialog(bm)"
                  title="编辑书签"
                >
                  <el-icon class="text-xs"><component is="EditPen" /></el-icon>
                </button>
                <button
                  type="button"
                  class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  @click="confirmDeleteBookmark(bm)"
                  title="删除书签"
                >
                  <el-icon class="text-xs"><component is="Delete" /></el-icon>
                </button>
              </div>
            </div>
          </div>

          <!-- 分页栏 -->
          <div v-if="filteredBookmarks.length > pageSize" class="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs text-slate-500">
            <div class="text-[11px] text-slate-400">
              共 <strong class="font-semibold text-slate-700 dark:text-slate-300">{{ filteredBookmarks.length }}</strong> 条 · 第 <strong class="font-semibold text-slate-700 dark:text-slate-300">{{ currentPage }}</strong> / <strong>{{ totalPages }}</strong> 页
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="w-7 h-7 rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                :disabled="currentPage <= 1"
                @click="currentPage--"
                title="上一页"
              >
                <el-icon class="text-[10px]"><component is="ArrowLeft" /></el-icon>
              </button>

              <template v-for="(p, idx) in visiblePages" :key="idx">
                <span v-if="p === '...'" class="px-1 text-slate-400 text-xs">...</span>
                <button
                  v-else
                  type="button"
                  class="w-7 h-7 rounded text-xs font-medium flex items-center justify-center transition-colors cursor-pointer"
                  :class="[
                    currentPage === p
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold'
                      : 'border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  ]"
                  @click="currentPage = Number(p)"
                >
                  {{ p }}
                </button>
              </template>

              <button
                type="button"
                class="w-7 h-7 rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                :disabled="currentPage >= totalPages"
                @click="currentPage++"
                title="下一页"
              >
                <el-icon class="text-[10px]"><component is="ArrowRight" /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 2：分类管理 -->
      <div v-if="activeTab === 'categories'" class="space-y-3">
        <div class="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-subtle">
          <button
            type="button"
            class="h-7 px-2.5 rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            @click="toggleExpandAll"
          >
            <el-icon class="text-xs"><component :is="isAllExpanded ? 'Fold' : 'Expand'" /></el-icon>
            <span>{{ isAllExpanded ? '收起所有分类' : '一键展开所有分类' }}</span>
          </button>

          <button
            type="button"
            class="h-7 px-3 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-white flex items-center gap-1 transition-colors cursor-pointer"
            @click="openCategoryDialog()"
          >
            <el-icon class="text-xs"><component is="Plus" /></el-icon>
            <span>新建一级分类</span>
          </button>
        </div>

        <div ref="categoryListRef" class="space-y-2">
          <div v-for="cat in categoryTree" :key="cat.id" class="bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800 shadow-subtle overflow-hidden">
            <!-- 一级分类行 -->
            <div class="group flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
                <span class="cat-drag text-slate-400 hover:text-slate-600 cursor-grab flex items-center" title="拖拽排序">
                  <el-icon class="text-xs"><component is="Rank" /></el-icon>
                </span>
                <button type="button" class="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer" @click.stop="toggleExpand(cat.id)">
                  <el-icon class="text-xs"><component :is="expandedCategories.includes(cat.id) ? 'ArrowDown' : 'ArrowRight'" /></el-icon>
                </button>
                <el-icon class="text-xs text-slate-500 flex-shrink-0"><component :is="mapIcon(cat.icon)" /></el-icon>
                <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{{ cat.name }}</span>
                <span v-if="cat.is_private" class="text-[10px] px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-medium">私有</span>
                <span class="text-[11px] text-slate-400 dark:text-slate-500 font-normal">({{ cat.children.length }} 个子分类)</span>
              </div>

              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  @click.stop="openCategoryDialog(undefined, cat.id)"
                  title="添加子分类"
                >
                  <el-icon class="text-xs"><component is="Plus" /></el-icon>
                </button>
                <button
                  type="button"
                  class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  @click.stop="openCategoryDialog(cat)"
                  title="编辑分类"
                >
                  <el-icon class="text-xs"><component is="EditPen" /></el-icon>
                </button>
                <button
                  type="button"
                  class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                  @click.stop="confirmDeleteCategory(cat)"
                  title="删除分类"
                >
                  <el-icon class="text-xs"><component is="Delete" /></el-icon>
                </button>
              </div>
            </div>

            <!-- 二级子分类列表 -->
            <div v-show="expandedCategories.includes(cat.id)" class="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 p-2 space-y-1">
              <div class="cat-sub-sortable-container space-y-1" :data-parent-id="cat.id">
                <div
                  v-for="sub in cat.children"
                  :key="sub.id"
                  class="group flex items-center justify-between px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
                    <span class="sub-drag text-slate-400 hover:text-slate-600 cursor-grab flex items-center" title="拖拽排序">
                      <el-icon class="text-xs"><component is="Rank" /></el-icon>
                    </span>
                    <span class="text-slate-400 text-xs font-mono">└</span>
                    <el-icon class="text-xs text-slate-500 flex-shrink-0"><component :is="mapIcon(sub.icon)" /></el-icon>
                    <span class="text-xs text-slate-700 dark:text-slate-300 truncate">{{ sub.name }}</span>
                    <span v-if="sub.is_private" class="text-[10px] px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-medium">私有</span>
                  </div>

                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      @click="openCategoryDialog(sub)"
                      title="编辑子分类"
                    >
                      <el-icon class="text-xs"><component is="EditPen" /></el-icon>
                    </button>
                    <button
                      type="button"
                      class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      @click="confirmDeleteCategory(sub)"
                      title="删除子分类"
                    >
                      <el-icon class="text-xs"><component is="Delete" /></el-icon>
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="!cat.children.length" class="text-center py-2 text-[11px] text-slate-400 dark:text-slate-500">
                暂无二级子分类
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 3：AI 模型与推理参数 -->
      <div v-if="activeTab === 'ai'" class="space-y-3">
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg p-4 sm:p-5 shadow-subtle space-y-4">
          <el-form label-position="top" size="small" class="space-y-3.5">
            <!-- 1. API Base URL -->
            <el-form-item label="API Base URL">
              <el-input v-model="aiSettings.base_url" placeholder="https://api.deepseek.com/v1" />
            </el-form-item>

            <!-- 2. API Key -->
            <el-form-item label="API Key">
              <el-input
                v-model="aiSettings.api_key"
                type="password"
                show-password
                :placeholder="aiSettings.has_api_key === 'true' ? `已配置 (${aiSettings.api_key_masked})，输入新密钥可覆盖` : 'sk-...'"
              />
            </el-form-item>

            <!-- 3. 启用模型 -->
            <div class="space-y-2 p-3 rounded-md bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/70">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-xs text-slate-800 dark:text-slate-200">启用模型列表</span>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="h-6 px-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    :disabled="fetchingModels"
                    @click="fetchOnlineModels"
                  >
                    <el-icon class="mr-1" :class="{ 'is-loading': fetchingModels }"><component :is="fetchingModels ? 'Loading' : 'Refresh'" /></el-icon>
                    <span>{{ fetchingModels ? '获取中...' : '获取' }}</span>
                  </button>
                  <button type="button" class="h-6 px-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" @click="selectAllModels">全选</button>
                  <button type="button" class="h-6 px-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" @click="clearAllModels">清空</button>
                </div>
              </div>

              <!-- 模型芯片网格 -->
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-1">
                <div v-if="allFetchedModels.length === 0" class="text-xs text-slate-400 py-2 col-span-full text-center">
                  暂无模型，可点击上方「获取」或在下方输入名称添加
                </div>
                <div
                  v-for="m in allFetchedModels"
                  :key="m"
                  class="flex items-center justify-between px-2.5 py-1.5 rounded border transition-colors cursor-pointer"
                  :class="[
                    (aiSettings.available_models || []).includes(m)
                      ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-medium'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  ]"
                  @click="toggleModelCheck(m)"
                >
                  <div class="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
                    <el-icon class="text-xs"><component :is="(aiSettings.available_models || []).includes(m) ? 'CircleCheckFilled' : 'CircleCheck'" /></el-icon>
                    <span class="text-xs truncate">{{ m }}</span>
                  </div>

                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      class="w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer"
                      :class="aiSettings.model === m ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'"
                      @click.stop="setDefaultModel(m)"
                      :title="aiSettings.model === m ? '当前默认模型' : '点击设为默认模型'"
                    >
                      <el-icon class="text-xs"><component :is="aiSettings.model === m ? 'StarFilled' : 'Star'" /></el-icon>
                    </button>
                    <button
                      type="button"
                      class="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                      @click.stop="removeModel(m)"
                      title="删除此模型"
                    >
                      <el-icon class="text-[10px]"><component is="Close" /></el-icon>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 手动添加模型 -->
              <div class="flex items-center gap-2 mt-1">
                <input
                  v-model="customModelName"
                  type="text"
                  class="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none"
                  placeholder="手动添加模型名称 (如 qwen-plus)"
                  @keyup.enter="addCustomModel"
                />
                <button
                  type="button"
                  class="h-7 px-2.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  @click="addCustomModel"
                  title="添加模型"
                >
                  <el-icon class="text-xs"><component is="Plus" /></el-icon>
                  <span>添加</span>
                </button>
              </div>
            </div>

            <!-- 专属模型 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <el-form-item label="在线笔记写作专属模型">
                <el-select
                  v-model="aiSettings.writing_model"
                  class="w-full"
                  placeholder="选择或输入笔记写作专属模型"
                  filterable
                  allow-create
                  default-first-option
                >
                  <el-option
                    v-for="m in allFetchedModels"
                    :key="m"
                    :label="m"
                    :value="m"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="导航书签解析专属模型">
                <el-select
                  v-model="aiSettings.bookmark_model"
                  class="w-full"
                  placeholder="选择或输入导航书签解析专属模型"
                  filterable
                  allow-create
                  default-first-option
                >
                  <el-option
                    v-for="m in allFetchedModels"
                    :key="m"
                    :label="m"
                    :value="m"
                  />
                </el-select>
              </el-form-item>
            </div>

            <!-- 深度思考开关 -->
            <div class="flex items-center justify-between p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <div>
                <div class="text-xs font-semibold text-slate-800 dark:text-slate-200">深度思考 (Reasoning CoT)</div>
                <div class="text-[11px] text-slate-400">开启后大模型将展开深入步骤思考</div>
              </div>
              <el-switch v-model="aiSettings.reasoning_mode" />
            </div>

            <!-- 采样温度 -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
                  采样温度 (Temperature): <span class="font-mono font-semibold text-slate-900 dark:text-slate-100">{{ aiSettings.temperature }}</span>
                </label>
                <span class="text-[11px] text-slate-400">
                  {{ aiSettings.temperature < 0.4 ? '严谨精准' : aiSettings.temperature > 1.0 ? '创意发散' : '通用平衡' }}
                </span>
              </div>
              <el-slider v-model="aiSettings.temperature" :min="0" :max="2" :step="0.05" />
            </div>

            <!-- Top-P -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
                  核采样 (Top-P): <span class="font-mono font-semibold text-slate-900 dark:text-slate-100">{{ aiSettings.top_p }}</span>
                </label>
              </div>
              <el-slider v-model="aiSettings.top_p" :min="0.1" :max="1" :step="0.05" />
            </div>

            <!-- Max Tokens -->
            <el-form-item label="单次最大生成 Token 数 (Max Tokens)">
              <el-input-number v-model="aiSettings.max_tokens" :min="256" :max="16384" :step="512" class="w-full" />
            </el-form-item>

            <!-- 全局系统提示词 -->
            <el-form-item label="全局系统提示词 (System Prompt)">
              <el-input
                v-model="aiSettings.system_prompt"
                type="textarea"
                :rows="3"
                placeholder="设置 AI 助手的全局角色定位与回复规范"
              />
            </el-form-item>
          </el-form>

          <div class="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-slate-800">
            <span class="text-xs text-slate-400">当前默认模型：<strong class="text-slate-700 dark:text-slate-300 font-semibold">{{ aiSettings.model || '未设定' }}</strong></span>
            <button
              type="button"
              class="h-8 px-4 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
              :disabled="savingAiSettings"
              @click="saveAdminAiSettings"
            >
              <el-icon v-if="savingAiSettings" class="is-loading mr-1"><component is="Loading" /></el-icon>
              <span>{{ savingAiSettings ? '保存中...' : '保存配置' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab 4：安全中心 -->
      <div v-if="activeTab === 'security'" class="space-y-3">
        <!-- 1. 账户卡片 -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg p-4 sm:p-5 shadow-subtle flex justify-between items-center">
          <div>
            <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100 m-0">账户与登录密码</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">当前账户: <strong class="text-slate-800 dark:text-slate-200 font-semibold">{{ authStore.user?.username }}</strong></p>
          </div>
          <button
            type="button"
            class="h-7 px-2.5 rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            @click="openAccountDialog"
          >
            <el-icon class="text-xs"><component is="EditPen" /></el-icon>
            <span>修改用户名与密码</span>
          </button>
        </div>

        <!-- 2. 多重身份认证卡片 -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg p-4 sm:p-5 shadow-subtle space-y-4">
          <!-- 上部：两步验证 (TOTP) -->
          <div class="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100 m-0">两步验证 (TOTP)</h3>
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  :class="authStore.user?.totp_enabled ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'"
                >
                  {{ authStore.user?.totp_enabled ? '已启用' : '未启用' }}
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">基于 Authenticator 动态验证码</p>
            </div>
            <button
              v-if="!authStore.user?.totp_enabled"
              type="button"
              class="h-7 px-3 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-white flex items-center gap-1 transition-colors cursor-pointer"
              :disabled="settingUpTotp"
              @click="startTotpSetup"
            >
              <el-icon class="text-xs"><component is="Lock" /></el-icon>
              <span>配置 2FA</span>
            </button>
          </div>

          <!-- TOTP 配置中区域 -->
          <div v-if="!authStore.user?.totp_enabled && totpSetup" class="space-y-3 py-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex justify-center"><img :src="totpSetup.qrCodeUrl" class="w-32 h-32 border rounded-md" /></div>
            <p class="text-[11px] text-slate-400 text-center break-all font-mono">{{ totpSetup.secret }}</p>
            <div class="flex gap-2 max-w-sm mx-auto">
              <el-input v-model="totpCode" placeholder="输入 6 位验证码" maxlength="6" size="small" class="flex-1" />
              <button type="button" class="h-7 px-3 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium" @click="confirmTotp">确认绑定</button>
            </div>
          </div>

          <!-- 下部：Passkey 免密登录 -->
          <div class="flex justify-between items-center">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100 m-0">Passkey 免密登录</h3>
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  :class="authStore.user?.webauthn_enabled ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'"
                >
                  {{ authStore.user?.webauthn_enabled ? '已绑定' : '未绑定' }}
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">指纹 / Face ID / Windows Hello 硬件免密</p>
            </div>
            <button
              type="button"
              class="h-7 px-2.5 rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              :disabled="registeringPasskey"
              @click="registerPasskey"
            >
              <el-icon class="text-xs"><component is="Key" /></el-icon>
              <span>绑定 Passkey</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab 5：站点设置 -->
      <div v-if="activeTab === 'site'" class="space-y-3">
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg p-4 sm:p-5 shadow-subtle space-y-4">
          <el-form label-position="top" size="small" class="space-y-3">
            <!-- 1. 外观深浅模式 -->
            <el-form-item label="外观主题">
              <el-radio-group :model-value="themeStore.mode" @change="themeStore.setMode($event as any)">
                <el-radio-button value="system">跟随系统</el-radio-button>
                <el-radio-button value="light">日间浅色</el-radio-button>
                <el-radio-button value="dark">夜间深色</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <!-- 2. 主品牌色 -->
            <el-form-item label="系统主品牌色 (实时生效)">
              <div class="flex items-center gap-2 flex-wrap">
                <button
                  v-for="p in colorPresets"
                  :key="p.color"
                  type="button"
                  class="w-6 h-6 rounded-md flex items-center justify-center transition-transform cursor-pointer"
                  :class="{ 'ring-2 ring-offset-2 ring-slate-400 scale-105': siteForm.themePrimaryColor === p.color }"
                  :style="{ backgroundColor: p.color }"
                  :title="p.name"
                  @click="selectThemeColor(p.color)"
                >
                  <el-icon v-if="siteForm.themePrimaryColor === p.color" class="text-white text-xs"><component is="Check" /></el-icon>
                </button>

                <div class="flex items-center gap-2 ml-1">
                  <el-color-picker
                    v-model="siteForm.themePrimaryColor"
                    size="small"
                    @change="siteStore.setThemePrimaryColor($event as any)"
                  />
                  <span class="text-xs font-mono text-slate-400">{{ siteForm.themePrimaryColor }}</span>
                </div>
              </div>
            </el-form-item>

            <!-- 3. 搜索背景图 -->
            <el-form-item label="导航主页搜索组件背景图">
              <div class="space-y-2 p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 w-full">
                <div class="flex items-center gap-2">
                  <el-input
                    v-model="siteForm.searchBgImage"
                    placeholder="输入背景图片 URL 或点击右侧上传..."
                    clearable
                    @input="siteStore.searchBgImage = siteForm.searchBgImage"
                  />
                  <button
                    type="button"
                    class="h-7 px-2.5 rounded-md border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                    :disabled="uploadingBg"
                    @click="bgUploadInputRef?.click()"
                  >
                    <el-icon class="text-xs" :class="{ 'is-loading': uploadingBg }"><component :is="uploadingBg ? 'Loading' : 'Upload'" /></el-icon>
                    <span>{{ uploadingBg ? '上传中...' : '上传图片' }}</span>
                  </button>
                  <input ref="bgUploadInputRef" type="file" accept="image/*" hidden @change="handleBgUpload" />
                </div>

                <div v-if="siteForm.searchBgImage" class="relative rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 h-24 flex items-center justify-center">
                  <img :src="siteForm.searchBgImage" alt="搜索背景图" class="w-full h-full object-cover" />
                  <button
                    type="button"
                    class="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 text-white text-xs hover:bg-slate-900 transition-colors cursor-pointer"
                    title="清除背景图"
                    @click="clearCustomBg"
                  >
                    <el-icon><component is="Close" /></el-icon>
                  </button>
                </div>
              </div>
            </el-form-item>

            <el-form-item label="站点名称">
              <el-input v-model="siteForm.siteName" placeholder="ZenLink" />
            </el-form-item>

            <el-form-item label="站点描述">
              <el-input v-model="siteForm.siteDesc" placeholder="干净简洁的导航！" />
            </el-form-item>

            <!-- 网站 Logo -->
            <el-form-item label="网站图标与站标 (Logo / Favicon)">
              <div class="space-y-2 p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 w-full">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden relative group">
                    <img v-if="siteForm.siteLogo" :src="siteForm.siteLogo" alt="Logo" class="w-full h-full object-cover" />
                    <span v-else class="font-bold text-sm text-slate-800 dark:text-slate-200">{{ (siteForm.siteName || 'Z').trim().charAt(0) }}</span>
                    <button
                      v-if="siteForm.siteLogo"
                      type="button"
                      class="absolute inset-0 bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                      title="清除"
                      @click="clearCustomLogo"
                    >
                      <el-icon><component is="Delete" /></el-icon>
                    </button>
                  </div>

                  <div class="flex-1 space-y-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <el-input
                        v-model="siteForm.siteLogo"
                        placeholder="输入图片 URL 或点击右侧上传..."
                        clearable
                        @input="siteStore.setSiteLogo(siteForm.siteLogo)"
                      />
                      <button
                        type="button"
                        class="h-7 px-2.5 rounded-md border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                        :disabled="uploadingLogo"
                        @click="logoUploadInputRef?.click()"
                      >
                        <el-icon class="text-xs" :class="{ 'is-loading': uploadingLogo }"><component :is="uploadingLogo ? 'Loading' : 'Upload'" /></el-icon>
                        <span>{{ uploadingLogo ? '上传中...' : '上传' }}</span>
                      </button>
                      <input ref="logoUploadInputRef" type="file" accept="image/*" hidden @change="handleLogoUpload" />
                    </div>
                    <p class="text-[11px] text-slate-400 m-0">支持 PNG/SVG/ICO/JPG 格式</p>
                  </div>
                </div>
              </div>
            </el-form-item>

            <el-form-item label="默认搜索引擎">
              <el-select v-model="siteForm.defaultEngine" class="w-full">
                <el-option label="Google" value="google" />
                <el-option label="Bing" value="bing" />
                <el-option label="DuckDuckGo" value="duckduckgo" />
              </el-select>
            </el-form-item>

            <!-- 功能模块开关 -->
            <el-form-item label="功能模块开关">
              <div class="space-y-2 p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 w-full">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-xs font-semibold text-slate-800 dark:text-slate-200">开启 AI 助手</div>
                    <div class="text-[11px] text-slate-400">开启后可在侧边栏使用 AI 助手</div>
                  </div>
                  <el-switch v-model="siteForm.enableAi" />
                </div>

                <div class="border-t border-slate-200/60 dark:border-slate-800/60 pt-2 flex items-center justify-between">
                  <div>
                    <div class="text-xs font-semibold text-slate-800 dark:text-slate-200">开启在线笔记</div>
                    <div class="text-[11px] text-slate-400">开启后可在侧边栏使用在线笔记</div>
                  </div>
                  <el-switch v-model="siteForm.enableNotes" />
                </div>
              </div>
            </el-form-item>
          </el-form>

          <div class="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              class="h-8 px-4 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
              @click="saveSiteSettings"
            >
              <el-icon class="mr-1"><component is="Check" /></el-icon>
              <span>保存设置</span>
            </button>
          </div>
        </div>

        <!-- 存储驱动 -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg p-4 sm:p-5 shadow-subtle space-y-3">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100 m-0">附件存储驱动设置</h3>

          <el-form label-position="top" size="small" class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">当前存储位置</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div
                  class="p-3 rounded-md border cursor-pointer transition-colors flex items-center justify-between"
                  :class="storageSettings.storage_type === 'local' ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30'"
                  @click="storageSettings.storage_type = 'local'"
                >
                  <div class="flex items-center gap-2">
                    <el-icon class="text-base text-indigo-500"><component is="FolderOpened" /></el-icon>
                    <div>
                      <div class="text-xs font-semibold text-slate-800 dark:text-slate-200">本地服务器存储 (Local)</div>
                      <div class="text-[11px] text-slate-400">文件保存在 data/uploads 目录</div>
                    </div>
                  </div>
                  <el-icon v-if="storageSettings.storage_type === 'local'" class="text-indigo-500"><component is="Check" /></el-icon>
                </div>

                <div
                  class="p-3 rounded-md border cursor-pointer transition-colors flex items-center justify-between"
                  :class="storageSettings.storage_type === 'r2' ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30'"
                  @click="storageSettings.storage_type = 'r2'"
                >
                  <div class="flex items-center gap-2">
                    <el-icon class="text-base text-indigo-500"><component is="Cloudy" /></el-icon>
                    <div>
                      <div class="text-xs font-semibold text-slate-800 dark:text-slate-200">Cloudflare R2 对象存储</div>
                      <div class="text-[11px] text-slate-400">全球 CDN 直链加速</div>
                    </div>
                  </div>
                  <el-icon v-if="storageSettings.storage_type === 'r2'" class="text-indigo-500"><component is="Check" /></el-icon>
                </div>
              </div>
            </div>

            <!-- R2 参数 -->
            <div v-if="storageSettings.storage_type === 'r2'" class="space-y-3 p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
              <div class="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">Cloudflare R2 凭据配置</span>
                <button
                  type="button"
                  class="h-6 px-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  :disabled="testingR2"
                  @click="testR2"
                >
                  <el-icon class="mr-1" :class="{ 'is-loading': testingR2 }"><component :is="testingR2 ? 'Loading' : 'Connection'" /></el-icon>
                  <span>{{ testingR2 ? '测试中...' : '测试连接' }}</span>
                </button>
              </div>

              <el-form-item label="Cloudflare Account ID">
                <el-input v-model="storageSettings.r2_account_id" placeholder="例如：a1b2c3d4e5f6..." />
              </el-form-item>

              <el-form-item label="R2 存储桶名称 (Bucket Name)">
                <el-input v-model="storageSettings.r2_bucket_name" placeholder="例如：zenlink-notes" />
              </el-form-item>

              <el-form-item label="Access Key ID">
                <el-input v-model="storageSettings.r2_access_key_id" placeholder="R2 Access Key ID" />
              </el-form-item>

              <el-form-item label="Secret Access Key">
                <el-input
                  v-model="storageSettings.r2_secret_access_key"
                  type="password"
                  show-password
                  :placeholder="storageSettings.r2_secret_access_key_masked ? `已配置 (${storageSettings.r2_secret_access_key_masked})，输入新密钥可覆盖` : 'R2 Secret Access Key'"
                />
              </el-form-item>

              <el-form-item label="公开访问域名 / 自定义 CDN 域名 (可选)">
                <el-input v-model="storageSettings.r2_public_domain" placeholder="https://pub-xxxx.r2.dev 或 https://cdn.yourdomain.com" />
              </el-form-item>
            </div>
          </el-form>

          <div class="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-slate-800">
            <span class="text-xs text-slate-400">当前存储驱动：<strong class="text-slate-700 dark:text-slate-300 font-semibold">{{ storageSettings.storage_type === 'r2' ? 'Cloudflare R2' : '本地服务器' }}</strong></span>
            <button
              type="button"
              class="h-8 px-4 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
              :disabled="savingStorage"
              @click="saveStorage"
            >
              <el-icon class="mr-1"><component is="Check" /></el-icon>
              <span>{{ savingStorage ? '保存中...' : '保存存储设置' }}</span>
            </button>
          </div>
        </div>

        <!-- 数据备份 -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg p-4 sm:p-5 shadow-subtle">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100 m-0 mb-3">数据备份与导入</h3>
          <div class="flex gap-2 flex-wrap">
            <button
              type="button"
              class="h-7 px-3 rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              @click="exportBookmarks"
            >
              <el-icon class="text-xs"><component is="Download" /></el-icon>
              <span>导出 JSON</span>
            </button>
            <button
              type="button"
              class="h-7 px-3 rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              @click="importInputRef?.click()"
            >
              <el-icon class="text-xs"><component is="Upload" /></el-icon>
              <span>导入 (HTML / JSON)</span>
            </button>
            <input ref="importInputRef" type="file" accept=".json,.html,.htm" hidden @change="handleImportBookmarks" />
          </div>
        </div>
      </div>
    </div>

    <!-- 对话框：账户安全 -->
    <el-dialog
      v-model="showAccountDialog"
      title="账户安全设置"
      :width="isMobile ? '92%' : '420px'"
      align-center
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-position="top" size="small" class="space-y-3">
        <el-form-item label="用户名">
          <el-input v-model="accountForm.username" placeholder="管理员用户名" />
        </el-form-item>

        <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
          <p class="text-xs text-slate-400 mb-2">如无需修改密码，以下密码项留空即可：</p>
          <el-form-item label="当前密码">
            <el-input v-model="accountForm.currentPassword" type="password" show-password placeholder="修改密码时需验证当前密码" />
          </el-form-item>
          <el-form-item label="新密码">
            <el-input v-model="accountForm.newPassword" type="password" show-password placeholder="输入新密码" />
          </el-form-item>
          <el-form-item label="确认新密码">
            <el-input v-model="accountForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="showAccountDialog = false">取消</el-button>
          <el-button type="primary" :loading="savingAccount" @click="saveAccountSettings">保存修改</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 对话框：书签添加/编辑 -->
    <el-dialog
      v-model="showBookmarkDialog"
      :title="editingBookmark.id ? '编辑书签' : '添加书签'"
      :width="isMobile ? '92%' : '460px'"
      align-center
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-position="top" size="small" class="space-y-3">
        <el-form-item label="网址链接 *">
          <div class="flex gap-2 w-full">
            <el-input v-model="editingBookmark.url" placeholder="https://..." class="flex-1" />
            <el-button type="primary" plain @click="fetchBookmarkMeta">
              <span>AI 解析</span>
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="标题 *">
          <el-input v-model="editingBookmark.title" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editingBookmark.description" type="textarea" :rows="2" resize="none" />
        </el-form-item>
        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="图标 URL">
            <div class="flex items-center gap-2 w-full">
              <el-input v-model="editingBookmark.favicon" placeholder="留空自动抓取" class="flex-1" />
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
          </el-form-item>
          <el-form-item label="备用链接">
            <el-input v-model="editingBookmark.backup_url" />
          </el-form-item>
        </div>
        <el-form-item label="所属分类">
          <el-select v-model="editingBookmark.category_id" placeholder="选择分类" clearable class="w-full">
            <el-option
              v-for="opt in categoryDialogOptions"
              :key="opt.id"
              :label="opt.name"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="editingBookmark.is_private" :true-value="1" :false-value="0">私有书签（仅登录后可见）</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="showBookmarkDialog = false">取消</el-button>
          <el-button type="primary" @click="saveBookmark">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 对话框：分类新建/编辑 -->
    <el-dialog
      v-model="showCategoryDialog"
      :title="editingCategory.id ? '编辑分类' : '新建分类'"
      :width="isMobile ? '92%' : '400px'"
      align-center
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-position="top" size="small" class="space-y-3">
        <el-form-item label="分类名称 *">
          <el-input v-model="editingCategory.name" />
        </el-form-item>
        <el-form-item label="图标">
          <IconPicker v-model="editingCategory.icon" />
        </el-form-item>
        <el-form-item label="上级分类">
          <el-select v-model="editingCategory.parent_id" placeholder="无 (一级分类)" clearable class="w-full">
            <el-option v-for="cat in topCategories()" :key="cat.id" :label="cat.name" :value="cat.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="editingCategory.is_private" :true-value="1" :false-value="0">私有分类</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="showCategoryDialog = false">取消</el-button>
          <el-button type="primary" @click="saveCategory">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
