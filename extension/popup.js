/**
 * ZenLink Chrome 扩展 Popup 核心交互逻辑
 * 1. 0 延迟秒开：本地离线缓存 + 后台静默增量同步
 * 2. 多合一工作台：底栏左下角无缝切换 [网址导航] / [在线笔记] / [AI 智能助手]
 * 3. 完美横向平移：分类胶囊按钮支持鼠标直接抓取拖动与滚轮横向滚动，智能防误触
 * 4. 实时流式对话：AI 助手 SSE 流式输出，支持一键总结当前网页
 */

// 全局响应式状态
const state = {
  serverUrl: '',
  token: '',
  user: null,
  siteName: 'ZenLink',
  activeModule: 'nav', // 'nav' | 'notes' | 'ai'

  // 导航模块
  categories: [],
  bookmarks: [],
  selectedTopCatId: 'all',
  selectedSubCatId: 'all',
  searchQuery: '',

  // 笔记模块
  notes: [],
  notesSearchQuery: '',
  editingNoteId: null,

  // AI 模块
  aiSettings: null,
  aiConversationId: null,
  aiHistory: [],
  isAiStreaming: false,

  // 浏览器当前活动标签页
  activeTab: null,
  isSyncing: false,
};

// DOM 元素快速引用
const elements = {
  views: {
    login: document.getElementById('view-login'),
    main: document.getElementById('view-main'),
    add: document.getElementById('view-add'),
    noteEdit: document.getElementById('view-note-edit'),
    settings: document.getElementById('view-settings'),
  },
  panes: {
    nav: document.getElementById('pane-nav'),
    notes: document.getElementById('pane-notes'),
    ai: document.getElementById('pane-ai'),
  },
  toast: document.getElementById('toast'),

  // 登录视图
  loginForm: document.getElementById('login-form'),
  serverUrlInput: document.getElementById('server-url'),
  loginUsernameInput: document.getElementById('login-username'),
  loginPasswordInput: document.getElementById('login-password'),
  totpGroup: document.getElementById('totp-group'),
  loginTotpInput: document.getElementById('login-totp'),
  loginAlert: document.getElementById('login-alert'),
  btnLogin: document.getElementById('btn-login'),

  // 顶栏通用
  siteTitle: document.getElementById('display-site-name'),
  btnMainAction: document.getElementById('btn-main-action'),
  txtMainAction: document.getElementById('txt-main-action'),
  btnToSettings: document.getElementById('btn-to-settings'),

  // 底栏通用
  footerNavTabs: document.querySelectorAll('.footer-tab-btn'),
  statCount: document.getElementById('stat-count'),
  btnRefresh: document.getElementById('btn-refresh'),

  // 导航面板
  tabFavicon: document.getElementById('tab-favicon'),
  tabTitle: document.getElementById('tab-title'),
  btnQuickCollect: document.getElementById('btn-quick-collect'),
  searchInput: document.getElementById('search-input'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  categoryPills: document.getElementById('category-pills'),
  subcategoryContainer: document.getElementById('subcategory-container'),
  subcategoryPills: document.getElementById('subcategory-pills'),
  bookmarkList: document.getElementById('bookmark-list'),
  emptyState: document.getElementById('empty-state'),

  // 笔记面板
  noteClipTitle: document.getElementById('note-clip-title'),
  btnQuickClipNote: document.getElementById('btn-quick-clip-note'),
  notesSearchInput: document.getElementById('notes-search-input'),
  btnClearNotesSearch: document.getElementById('btn-clear-notes-search'),
  notesList: document.getElementById('notes-list'),
  notesEmptyState: document.getElementById('notes-empty-state'),

  // 笔记编辑视图
  btnBackFromNote: document.getElementById('btn-back-from-note'),
  noteEditHeaderTitle: document.getElementById('note-edit-header-title'),
  noteEditForm: document.getElementById('note-edit-form'),
  noteTitleInput: document.getElementById('note-title-input'),
  noteTagsInput: document.getElementById('note-tags-input'),
  noteContentInput: document.getElementById('note-content-input'),
  notePinnedInput: document.getElementById('note-pinned-input'),
  noteEditAlert: document.getElementById('note-edit-alert'),
  btnCancelNote: document.getElementById('btn-cancel-note'),
  btnSubmitNote: document.getElementById('btn-submit-note'),

  // AI 面板
  aiModelName: document.getElementById('ai-model-name'),
  btnAiNewChat: document.getElementById('btn-ai-new-chat'),
  aiQuickPrompts: document.getElementById('ai-quick-prompts'),
  aiChatMessages: document.getElementById('ai-chat-messages'),
  aiPromptInput: document.getElementById('ai-prompt-input'),
  btnAiSend: document.getElementById('btn-ai-send'),

  // 添加书签视图
  btnBackFromAdd: document.getElementById('btn-back-from-add'),
  addForm: document.getElementById('add-bookmark-form'),
  bmUrl: document.getElementById('bm-url'),
  bmTitle: document.getElementById('bm-title'),
  btnFetchMeta: document.getElementById('btn-fetch-meta'),
  bmCategory: document.getElementById('bm-category'),
  bmDesc: document.getElementById('bm-desc'),
  bmFavicon: document.getElementById('bm-favicon'),
  bmFaviconPreview: document.getElementById('bm-favicon-preview'),
  bmPrivate: document.getElementById('bm-private'),
  addAlert: document.getElementById('add-alert'),
  btnCancelAdd: document.getElementById('btn-cancel-add'),
  btnSubmitAdd: document.getElementById('btn-submit-add'),

  // 设置视图
  btnBackFromSettings: document.getElementById('btn-back-from-settings'),
  stServerUrl: document.getElementById('st-server-url'),
  stUsername: document.getElementById('st-username'),
  btnOpenWeb: document.getElementById('btn-open-web'),
  btnSyncAll: document.getElementById('btn-sync-all'),
  btnLogout: document.getElementById('btn-logout'),
};

// ==================== 实用工具函数 ====================

function showToast(message, duration = 2200) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  clearTimeout(elements.toast._timer);
  elements.toast._timer = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, duration);
}

function switchView(viewName) {
  Object.keys(elements.views).forEach((name) => {
    if (elements.views[name]) {
      if (name === viewName) {
        elements.views[name].classList.remove('hidden');
      } else {
        elements.views[name].classList.add('hidden');
      }
    }
  });
}

function normalizeUrl(url) {
  if (!url) return '';
  let trimmed = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'http://' + trimmed;
  }
  return trimmed;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setButtonLoading(btn, loading, text) {
  if (!btn) return;
  btn.disabled = loading;
  const textEl = btn.querySelector('.btn-text');
  const spinnerEl = btn.querySelector('.btn-spinner');
  if (textEl && text) textEl.textContent = text;
  if (spinnerEl) {
    if (loading) spinnerEl.classList.remove('hidden');
    else spinnerEl.classList.add('hidden');
  }
}

// ==================== 终极丝滑横向滑动与拖拽 ====================

/**
 * 为容器赋予横向鼠标滚轮与抓取拖动能力。
 * 解决在分类按钮上点击按住无法拖拽的问题，同时通过移动距离阈值（>5px）区分拖拽与点击。
 */
function enableSmoothDragAndWheel(container) {
  if (!container) return;

  // 1. 鼠标滚轮竖向滚动映射为横向滚动
  container.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // 2. 鼠标按住拖拽滚动（允许在子元素如 button 上抓取）
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let hasDragged = false;

  container.addEventListener('mousedown', (e) => {
    // 允许在分类胶囊按钮上直接按住拖拽
    isDown = true;
    hasDragged = false;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });

  window.addEventListener('mouseup', () => {
    if (isDown) {
      isDown = false;
      // 延迟清除 hasDragged，让后续触发的 click 事件能读取到
      setTimeout(() => {
        hasDragged = false;
      }, 50);
    }
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 4) {
      hasDragged = true;
      e.preventDefault();
      container.scrollLeft = scrollLeft - walk;
    }
  });

  // 3. 捕获阶段拦截点击事件：如果是拖拽行为，则阻止触发按钮的 click
  container.addEventListener('click', (e) => {
    if (hasDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

// ==================== API 请求客户端 ====================

async function request(path, options = {}) {
  const url = `${state.serverUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => null);

    if (res.status === 401) {
      if (path !== '/api/auth/login') {
        showToast('登录已过期，请重新登录');
        handleLogout();
      }
      throw new Error((data && data.error) || '未授权或登录已过期');
    }

    if (!res.ok) {
      throw new Error((data && data.error) || `请求失败 (${res.status})`);
    }

    return data;
  } catch (err) {
    if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
      throw new Error('无法连接到服务端，请检查服务端地址是否正确且运行正常');
    }
    throw err;
  }
}

// ==================== 初始化与秒开架构 ====================

async function init() {
  // 1. 读取本地缓存，瞬间呈现界面
  const stored = await chrome.storage.local.get([
    'serverUrl',
    'authToken',
    'authUser',
    'siteName',
    'cachedCategories',
    'cachedBookmarks',
    'cachedNotes',
    'selectedTopCatId',
    'selectedSubCatId',
    'activeModule',
  ]);

  state.serverUrl = stored.serverUrl || '';
  state.token = stored.authToken || '';
  state.user = stored.authUser || null;
  state.siteName = stored.siteName || 'ZenLink';
  state.categories = Array.isArray(stored.cachedCategories) ? stored.cachedCategories : [];
  state.bookmarks = Array.isArray(stored.cachedBookmarks) ? stored.cachedBookmarks : [];
  state.notes = Array.isArray(stored.cachedNotes) ? stored.cachedNotes : [];
  state.selectedTopCatId = stored.selectedTopCatId || 'all';
  state.selectedSubCatId = stored.selectedSubCatId || 'all';
  state.activeModule = stored.activeModule || 'nav';

  if (elements.siteTitle) {
    elements.siteTitle.textContent = state.siteName;
  }

  // 绑定横向拖拽与滚轮
  enableSmoothDragAndWheel(elements.categoryPills);
  enableSmoothDragAndWheel(elements.subcategoryPills);
  bindEvents();

  // 2. 检查登录态
  if (state.serverUrl && state.token) {
    switchView('main');
    switchModule(state.activeModule);
    renderCategoryPills();
    renderSubCategoryPills();
    renderBookmarks();
    renderNotes();

    // 3. 读取当前浏览器活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab) {
        state.activeTab = tab;
        updateActiveTabBanners(tab);
      }
    }).catch(() => {});

    // 4. 后台静默增量拉取最新数据
    silentSyncData();
    // 异步加载 AI 配置
    initAiSettings();
  } else {
    prepareLoginView(state.serverUrl || 'http://127.0.0.1:3000');
  }
}

function updateActiveTabBanners(tab) {
  const title = tab.title || tab.url || '未知页面';
  if (elements.tabTitle) {
    elements.tabTitle.textContent = title;
    elements.tabTitle.title = title;
  }
  if (elements.tabFavicon) {
    elements.tabFavicon.src = tab.favIconUrl || 'icons/icon16.png';
    elements.tabFavicon.onerror = () => { elements.tabFavicon.src = 'icons/icon16.png'; };
  }
  if (elements.noteClipTitle) {
    elements.noteClipTitle.textContent = `剪藏「${title.slice(0, 30)}${title.length > 30 ? '...' : ''}」`;
    elements.noteClipTitle.title = title;
  }
}

function prepareLoginView(defaultUrl) {
  switchView('login');
  if (elements.serverUrlInput) elements.serverUrlInput.value = defaultUrl || '';
  if (elements.loginAlert) elements.loginAlert.classList.add('hidden');
  if (elements.totpGroup) elements.totpGroup.classList.add('hidden');
}

// ==================== 模块切换 (左下角 Dock) ====================

function switchModule(modName) {
  if (!['nav', 'notes', 'ai'].includes(modName)) modName = 'nav';
  state.activeModule = modName;
  chrome.storage.local.set({ activeModule: modName });

  // 切换底栏高亮
  elements.footerNavTabs.forEach((btn) => {
    if (btn.dataset.mod === modName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 切换主内容面板
  Object.keys(elements.panes).forEach((paneKey) => {
    const paneEl = elements.panes[paneKey];
    if (paneEl) {
      if (paneKey === modName) {
        paneEl.classList.remove('hidden');
      } else {
        paneEl.classList.add('hidden');
      }
    }
  });

  // 更新顶栏右上角主操作按钮的文案与图标
  updateMainActionButton();

  // 更新底栏状态文字
  updateFooterStat();
}

function updateMainActionButton() {
  if (!elements.btnMainAction || !elements.txtMainAction) return;

  if (state.activeModule === 'nav') {
    elements.txtMainAction.textContent = '添加书签';
    elements.btnMainAction.title = '添加书签至导航';
    elements.btnMainAction.classList.remove('hidden');
  } else if (state.activeModule === 'notes') {
    elements.txtMainAction.textContent = '新建笔记';
    elements.btnMainAction.title = '新建在线笔记';
    elements.btnMainAction.classList.remove('hidden');
  } else if (state.activeModule === 'ai') {
    elements.txtMainAction.textContent = '新对话';
    elements.btnMainAction.title = '开启新 AI 会话';
    elements.btnMainAction.classList.remove('hidden');
  }
}

function updateFooterStat() {
  if (!elements.statCount) return;
  if (state.activeModule === 'nav') {
    elements.statCount.textContent = `共 ${state.bookmarks.length} 个书签`;
  } else if (state.activeModule === 'notes') {
    elements.statCount.textContent = `共 ${state.notes.length} 条笔记`;
  } else if (state.activeModule === 'ai') {
    const model = (state.aiSettings && state.aiSettings.model) || 'AI 已连接';
    elements.statCount.textContent = model;
  }
}

// ==================== 后台同步数据 ====================

async function silentSyncData() {
  if (state.isSyncing) return;
  state.isSyncing = true;

  try {
    const [catRes, bmRes, notesRes, settingsRes] = await Promise.all([
      request('/api/categories').catch(() => null),
      request('/api/bookmarks').catch(() => null),
      request('/api/notes').catch(() => null),
      request('/api/settings').catch(() => null),
    ]);

    let hasChanges = false;

    if (catRes && catRes.categories) {
      state.categories = catRes.categories;
      hasChanges = true;
    }
    if (bmRes && bmRes.bookmarks) {
      state.bookmarks = bmRes.bookmarks;
      hasChanges = true;
    }
    if (notesRes && notesRes.notes) {
      state.notes = notesRes.notes;
      hasChanges = true;
    }
    if (settingsRes && settingsRes.settings && settingsRes.settings.site_name) {
      state.siteName = settingsRes.settings.site_name;
      if (elements.siteTitle) elements.siteTitle.textContent = state.siteName;
    }

    if (hasChanges) {
      await chrome.storage.local.set({
        cachedCategories: state.categories,
        cachedBookmarks: state.bookmarks,
        cachedNotes: state.notes,
        siteName: state.siteName,
      });
      renderCategoryPills();
      renderSubCategoryPills();
      renderBookmarks();
      renderNotes();
      updateFooterStat();
    }
  } catch (err) {
    console.warn('静默同步失败:', err);
  } finally {
    state.isSyncing = false;
  }
}

async function loadData(showSuccessToast = false) {
  if (elements.statCount) elements.statCount.textContent = '正在同步最新数据...';

  try {
    const [catRes, bmRes, notesRes] = await Promise.all([
      request('/api/categories'),
      request('/api/bookmarks'),
      request('/api/notes'),
    ]);

    state.categories = (catRes && catRes.categories) || [];
    state.bookmarks = (bmRes && bmRes.bookmarks) || [];
    state.notes = (notesRes && notesRes.notes) || [];

    await chrome.storage.local.set({
      cachedCategories: state.categories,
      cachedBookmarks: state.bookmarks,
      cachedNotes: state.notes,
    });

    renderCategoryPills();
    renderSubCategoryPills();
    renderBookmarks();
    renderNotes();
    updateFooterStat();

    if (showSuccessToast) showToast('已成功同步全站最新数据');
  } catch (err) {
    showToast(err.message || '加载数据失败');
    if (elements.statCount) elements.statCount.textContent = '同步遇到问题，显示离线缓存';
  }
}

// ==================== 登录与登出 ====================

async function handleLogin(e) {
  e.preventDefault();
  const serverUrl = normalizeUrl(elements.serverUrlInput.value);
  const username = elements.loginUsernameInput.value.trim();
  const password = elements.loginPasswordInput.value;
  const totpCode = elements.loginTotpInput ? elements.loginTotpInput.value.trim() : '';

  if (!serverUrl) {
    showLoginAlert('请输入有效的服务端地址', 'error');
    return;
  }
  if (!username || !password) {
    showLoginAlert('请输入用户名和密码', 'error');
    return;
  }

  state.serverUrl = serverUrl;
  setButtonLoading(elements.btnLogin, true, '正在登录...');
  showLoginAlert('', '');

  try {
    const payload = { username, password };
    if (totpCode) payload.totp_code = totpCode;

    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res && res.token) {
      state.token = res.token;
      state.user = res.user || { username };

      await chrome.storage.local.set({
        serverUrl: state.serverUrl,
        authToken: state.token,
        authUser: state.user,
      });

      showToast('登录成功，正在进入');
      switchView('main');
      switchModule('nav');
      await loadData();
      initAiSettings();
    } else {
      throw new Error('未能获取到有效的登录令牌');
    }
  } catch (err) {
    const msg = err.message || '登录失败';
    if (msg.includes('两步验证') || msg.includes('2FA') || msg.includes('TOTP') || msg.includes('totp')) {
      if (elements.totpGroup) {
        elements.totpGroup.classList.remove('hidden');
        elements.loginTotpInput.focus();
      }
    }
    showLoginAlert(msg, 'error');
  } finally {
    setButtonLoading(elements.btnLogin, false, '连接并登录');
  }
}

function showLoginAlert(msg, type = 'error') {
  if (!elements.loginAlert) return;
  if (!msg) {
    elements.loginAlert.classList.add('hidden');
    elements.loginAlert.textContent = '';
    return;
  }
  elements.loginAlert.textContent = msg;
  elements.loginAlert.className = `alert-box alert-${type}`;
}

async function handleLogout() {
  state.token = '';
  state.user = null;
  state.bookmarks = [];
  state.categories = [];
  state.notes = [];
  await chrome.storage.local.remove(['authToken', 'authUser', 'cachedCategories', 'cachedBookmarks', 'cachedNotes']);
  prepareLoginView(state.serverUrl);
  showToast('已退出登录');
}

// ==================== 网址导航模块：分类与书签 ====================

function getTopCategories() {
  return state.categories
    .filter((c) => !c.parent_id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function getSubCategories(topCategoryId) {
  if (!topCategoryId || topCategoryId === 'all') return [];
  const topId = Number(topCategoryId);
  return state.categories
    .filter((c) => c.parent_id === topId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function getCategoryFamilyIds(topCategoryId) {
  const topId = Number(topCategoryId);
  const ids = new Set([topId]);
  state.categories.forEach((c) => {
    if (c.parent_id === topId) ids.add(c.id);
  });
  return ids;
}

function renderCategoryPills() {
  if (!elements.categoryPills) return;

  const topCats = getTopCategories();
  const totalBookmarksCount = state.bookmarks.length;

  let html = `<button class="pill ${state.selectedTopCatId === 'all' ? 'active' : ''}" data-id="all">
    <span>全部</span>
    <span class="text-[10px] opacity-75">(${totalBookmarksCount})</span>
  </button>`;

  topCats.forEach((cat) => {
    const familyIds = getCategoryFamilyIds(cat.id);
    const count = state.bookmarks.filter((b) => b.category_id && familyIds.has(b.category_id)).length;
    const isActive = String(state.selectedTopCatId) === String(cat.id);

    html += `<button class="pill ${isActive ? 'active' : ''}" data-id="${cat.id}">
      <span>${escapeHtml(cat.name)}</span>
      <span class="text-[10px] opacity-75">(${count})</span>
    </button>`;
  });

  elements.categoryPills.innerHTML = html;

  elements.categoryPills.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.id;
      state.selectedTopCatId = catId === 'all' ? 'all' : Number(catId);
      state.selectedSubCatId = 'all';

      chrome.storage.local.set({
        selectedTopCatId: state.selectedTopCatId,
        selectedSubCatId: state.selectedSubCatId,
      });

      renderCategoryPills();
      renderSubCategoryPills();
      renderBookmarks();
    });
  });
}

function renderSubCategoryPills() {
  if (!elements.subcategoryContainer || !elements.subcategoryPills) return;

  if (state.selectedTopCatId === 'all') {
    elements.subcategoryContainer.classList.add('hidden');
    elements.subcategoryPills.innerHTML = '';
    return;
  }

  const subs = getSubCategories(state.selectedTopCatId);
  if (subs.length === 0) {
    elements.subcategoryContainer.classList.add('hidden');
    elements.subcategoryPills.innerHTML = '';
    return;
  }

  elements.subcategoryContainer.classList.remove('hidden');

  const familyIds = getCategoryFamilyIds(state.selectedTopCatId);
  const totalInTop = state.bookmarks.filter((b) => b.category_id && familyIds.has(b.category_id)).length;

  let html = `<button class="sub-pill ${state.selectedSubCatId === 'all' ? 'active' : ''}" data-subid="all">
    <span>全部子项</span>
    <span class="text-[9px] opacity-75">(${totalInTop})</span>
  </button>`;

  subs.forEach((sub) => {
    const count = state.bookmarks.filter((b) => b.category_id === sub.id).length;
    const isActive = String(state.selectedSubCatId) === String(sub.id);

    html += `<button class="sub-pill ${isActive ? 'active' : ''}" data-subid="${sub.id}">
      <span>${escapeHtml(sub.name)}</span>
      <span class="text-[9px] opacity-75">(${count})</span>
    </button>`;
  });

  elements.subcategoryPills.innerHTML = html;

  elements.subcategoryPills.querySelectorAll('.sub-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const subId = btn.dataset.subid;
      state.selectedSubCatId = subId === 'all' ? 'all' : Number(subId);

      chrome.storage.local.set({
        selectedSubCatId: state.selectedSubCatId,
      });

      renderSubCategoryPills();
      renderBookmarks();
    });
  });
}

function renderBookmarks() {
  if (!elements.bookmarkList) return;

  const query = state.searchQuery.trim().toLowerCase();

  let allowedCatIds = null;
  if (state.selectedTopCatId !== 'all') {
    if (state.selectedSubCatId !== 'all') {
      allowedCatIds = new Set([Number(state.selectedSubCatId)]);
    } else {
      allowedCatIds = getCategoryFamilyIds(state.selectedTopCatId);
    }
  }

  const filtered = state.bookmarks.filter((bm) => {
    if (allowedCatIds && (!bm.category_id || !allowedCatIds.has(bm.category_id))) {
      return false;
    }
    if (query) {
      const matchTitle = (bm.title || '').toLowerCase().includes(query);
      const matchDesc = (bm.description || '').toLowerCase().includes(query);
      const matchUrl = (bm.url || '').toLowerCase().includes(query);
      if (!matchTitle && !matchDesc && !matchUrl) return false;
    }
    return true;
  });

  if (state.activeModule === 'nav' && elements.statCount) {
    elements.statCount.textContent = `共 ${state.bookmarks.length} 个书签 (当前显示 ${filtered.length})`;
  }

  if (filtered.length === 0) {
    elements.bookmarkList.innerHTML = '';
    if (elements.emptyState) elements.emptyState.classList.remove('hidden');
    return;
  }

  if (elements.emptyState) elements.emptyState.classList.add('hidden');

  const catMap = new Map();
  state.categories.forEach((c) => catMap.set(c.id, c.name));

  let html = '';
  const renderList = filtered.slice(0, 80);

  renderList.forEach((bm) => {
    const catName = catMap.get(bm.category_id) || '未归类';
    let iconSrc = bm.favicon || '';
    if (!iconSrc && bm.url) {
      iconSrc = `${state.serverUrl}/api/favicon?url=${encodeURIComponent(bm.url)}`;
    }
    if (!iconSrc) iconSrc = 'icons/icon16.png';

    html += `
      <div class="bookmark-card" data-url="${escapeHtml(bm.url)}" title="${escapeHtml(bm.title)}\n${escapeHtml(bm.url)}">
        <div class="bm-icon-wrapper">
          <img class="bm-icon" src="${escapeHtml(iconSrc)}" loading="lazy" alt="" onerror="this.src='icons/icon16.png'" />
        </div>
        <div class="bm-main">
          <div class="bm-title-row">
            <span class="bm-title">${escapeHtml(bm.title || '无标题')}</span>
            <span class="bm-tag">${escapeHtml(catName)}</span>
            ${bm.is_private ? '<span class="bm-private-badge" title="私密书签">🔒</span>' : ''}
          </div>
          <span class="bm-desc">${escapeHtml(bm.description || bm.url)}</span>
        </div>
        <div class="bm-actions">
          <button class="action-btn btn-copy" title="复制链接" data-copy="${escapeHtml(bm.url)}">
            <svg class="icon-sm" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button class="action-btn btn-open" title="在新标签页打开" data-open="${escapeHtml(bm.url)}">
            <svg class="icon-sm" viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          </button>
        </div>
      </div>
    `;
  });

  if (filtered.length > 80) {
    html += `<div class="text-center py-2 text-[10px] text-muted-foreground">余下 ${filtered.length - 80} 条请在上方输入关键词搜索</div>`;
  }

  elements.bookmarkList.innerHTML = html;

  // 绑定交互
  elements.bookmarkList.querySelectorAll('.bookmark-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.action-btn')) return;
      const url = card.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  });

  elements.bookmarkList.querySelectorAll('.btn-copy').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.dataset.copy;
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          showToast('已复制网址到剪贴板');
        });
      }
    });
  });

  elements.bookmarkList.querySelectorAll('.btn-open').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.open;
      if (url) chrome.tabs.create({ url });
    });
  });
}

// ==================== 在线笔记模块 ====================

function renderNotes() {
  if (!elements.notesList) return;

  const query = state.notesSearchQuery.trim().toLowerCase();

  const filtered = state.notes.filter((note) => {
    if (!query) return true;
    const matchTitle = (note.title || '').toLowerCase().includes(query);
    const matchContent = (note.content || '').toLowerCase().includes(query);
    const matchTags = Array.isArray(note.tags) ? note.tags.some(t => String(t).toLowerCase().includes(query)) : false;
    return matchTitle || matchContent || matchTags;
  });

  if (state.activeModule === 'notes' && elements.statCount) {
    elements.statCount.textContent = `共 ${state.notes.length} 篇笔记 (当前显示 ${filtered.length})`;
  }

  if (filtered.length === 0) {
    elements.notesList.innerHTML = '';
    if (elements.notesEmptyState) elements.notesEmptyState.classList.remove('hidden');
    return;
  }

  if (elements.notesEmptyState) elements.notesEmptyState.classList.add('hidden');

  let html = '';
  filtered.forEach((note) => {
    const tags = Array.isArray(note.tags) ? note.tags : [];
    const dateStr = note.updated_at ? new Date(note.updated_at).toLocaleDateString() : '';
    const cleanSnippet = (note.content || '').replace(/[#*`~>[\]]/g, '').trim().slice(0, 90);

    html += `
      <div class="note-card" data-note-id="${note.id}">
        <div class="note-header-row">
          <div class="note-title-wrap">
            ${note.is_pinned ? '<span class="note-pin-badge" title="置顶笔记">📌</span>' : ''}
            <span class="note-title">${escapeHtml(note.title || '无标题笔记')}</span>
          </div>
          <span class="note-date">${dateStr}</span>
        </div>
        <p class="note-snippet">${escapeHtml(cleanSnippet || '暂无详细内容...')}</p>
        <div class="note-footer-row">
          <div class="note-tags-list">
            ${tags.map(t => `<span class="note-tag">#${escapeHtml(t)}</span>`).join('')}
          </div>
          <div class="note-actions">
            <button class="action-btn btn-edit-note" title="编辑笔记" data-id="${note.id}">
              <svg class="icon-sm" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button class="action-btn btn-copy-note" title="复制正文" data-id="${note.id}">
              <svg class="icon-sm" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  elements.notesList.innerHTML = html;

  // 绑定笔记交互
  elements.notesList.querySelectorAll('.note-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.action-btn')) return;
      const noteId = card.dataset.noteId;
      openNoteEditView(Number(noteId));
    });
  });

  elements.notesList.querySelectorAll('.btn-edit-note').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const noteId = btn.dataset.id;
      openNoteEditView(Number(noteId));
    });
  });

  elements.notesList.querySelectorAll('.btn-copy-note').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const noteId = Number(btn.dataset.id);
      const target = state.notes.find(n => n.id === noteId);
      if (target && target.content) {
        navigator.clipboard.writeText(target.content).then(() => {
          showToast('已复制笔记正文');
        });
      }
    });
  });
}

function openNoteEditView(noteId = null) {
  state.editingNoteId = noteId;
  switchView('noteEdit');
  if (elements.noteEditAlert) elements.noteEditAlert.classList.add('hidden');

  if (noteId) {
    if (elements.noteEditHeaderTitle) elements.noteEditHeaderTitle.textContent = '编辑笔记';
    const note = state.notes.find(n => n.id === noteId);
    if (note) {
      if (elements.noteTitleInput) elements.noteTitleInput.value = note.title || '';
      if (elements.noteTagsInput) elements.noteTagsInput.value = Array.isArray(note.tags) ? note.tags.join(', ') : '';
      if (elements.noteContentInput) elements.noteContentInput.value = note.content || '';
      if (elements.notePinnedInput) elements.notePinnedInput.checked = !!note.is_pinned;
    }
  } else {
    if (elements.noteEditHeaderTitle) elements.noteEditHeaderTitle.textContent = '新建笔记';
    if (elements.noteTitleInput) elements.noteTitleInput.value = '';
    if (elements.noteTagsInput) elements.noteTagsInput.value = '';
    if (elements.noteContentInput) elements.noteContentInput.value = '';
    if (elements.notePinnedInput) elements.notePinnedInput.checked = false;
  }

  setTimeout(() => {
    if (elements.noteTitleInput) elements.noteTitleInput.focus();
  }, 80);
}

// 快速剪藏当前网页为笔记
async function handleQuickClipNote() {
  const tab = state.activeTab;
  if (!tab) {
    openNoteEditView();
    return;
  }

  openNoteEditView();
  if (elements.noteTitleInput) elements.noteTitleInput.value = tab.title || '网页剪藏';
  if (elements.noteTagsInput) elements.noteTagsInput.value = '网页剪藏, 待读';

  let clipContent = `> 来源网页: [${tab.title || tab.url}](${tab.url})\n> 剪藏时间: ${new Date().toLocaleString()}\n\n`;

  // 尝试抓取当前页面用户选中的高亮文本
  try {
    const [selectionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    });
    if (selectionResult && selectionResult.result && selectionResult.result.trim()) {
      clipContent += `### 摘录内容\n\n${selectionResult.result.trim()}\n\n`;
    }
  } catch {
    // 忽略特定页面权限限制错误
  }

  if (elements.noteContentInput) elements.noteContentInput.value = clipContent;
  showToast('已载入当前网页信息，可直接编辑并保存');
}

// 提交保存笔记
async function handleNoteSubmit(e) {
  e.preventDefault();
  const title = elements.noteTitleInput ? elements.noteTitleInput.value.trim() : '';
  const content = elements.noteContentInput ? elements.noteContentInput.value : '';
  const tagsStr = elements.noteTagsInput ? elements.noteTagsInput.value.trim() : '';
  const isPinned = elements.notePinnedInput ? (elements.notePinnedInput.checked ? 1 : 0) : 0;

  if (!title) {
    showNoteEditAlert('请输入笔记标题', 'error');
    return;
  }

  const tags = tagsStr ? tagsStr.split(/[,，\s]+/).filter(Boolean) : [];

  setButtonLoading(elements.btnSubmitNote, true, '正在保存...');
  showNoteEditAlert('', '');

  try {
    let res;
    if (state.editingNoteId) {
      // 更新现有笔记
      res = await request(`/api/notes/${state.editingNoteId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content, isPinned, tags }),
      });
      if (res && res.note) {
        showToast('✅ 笔记更新成功');
        const idx = state.notes.findIndex(n => n.id === state.editingNoteId);
        if (idx !== -1) state.notes[idx] = res.note;
      }
    } else {
      // 创建新笔记
      res = await request('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ title, content, tags }),
      });
      if (res && res.note) {
        showToast('🎉 笔记创建成功');
        state.notes.unshift(res.note);
      }
    }

    await chrome.storage.local.set({ cachedNotes: state.notes });
    renderNotes();
    switchView('main');
    switchModule('notes');
  } catch (err) {
    showNoteEditAlert(err.message || '保存笔记失败', 'error');
  } finally {
    setButtonLoading(elements.btnSubmitNote, false, '保存笔记');
  }
}

function showNoteEditAlert(msg, type = 'error') {
  if (!elements.noteEditAlert) return;
  if (!msg) {
    elements.noteEditAlert.classList.add('hidden');
    elements.noteEditAlert.textContent = '';
    return;
  }
  elements.noteEditAlert.textContent = msg;
  elements.noteEditAlert.className = `alert-box alert-${type}`;
}

// ==================== AI 智能助手模块 ====================

async function initAiSettings() {
  try {
    const res = await request('/api/ai/settings').catch(() => null);
    if (res && res.settings) {
      state.aiSettings = res.settings;
      const model = res.settings.model || (res.settings.available_models && res.settings.available_models[0]) || 'AI 助手';
      if (elements.aiModelName) elements.aiModelName.textContent = model;
    }
  } catch (err) {
    console.warn('获取 AI 设置失败:', err);
  }
}

function startNewAiChat() {
  state.aiConversationId = null;
  state.aiHistory = [];
  if (elements.aiChatMessages) {
    elements.aiChatMessages.innerHTML = `
      <div class="ai-msg ai-msg-assistant">
        <div class="ai-msg-bubble">
          你好！我是你的 ZenLink 智能助手。你可以随时与我对话，或点击上方快速总结当前浏览的网页！
        </div>
      </div>
    `;
  }
  if (elements.aiPromptInput) {
    elements.aiPromptInput.value = '';
    elements.aiPromptInput.focus();
  }
  showToast('已开启新对话');
}

function appendAiMessage(role, content) {
  if (!elements.aiChatMessages) return null;
  const msgDiv = document.createElement('div');
  msgDiv.className = `ai-msg ai-msg-${role}`;

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'ai-msg-bubble';
  bubbleDiv.textContent = content;

  msgDiv.appendChild(bubbleDiv);
  elements.aiChatMessages.appendChild(msgDiv);
  elements.aiChatMessages.scrollTop = elements.aiChatMessages.scrollHeight;

  return bubbleDiv;
}

// 发送 AI 对话并流式处理
async function sendAiMessage(userPrompt) {
  if (state.isAiStreaming) return;
  const prompt = (userPrompt || (elements.aiPromptInput ? elements.aiPromptInput.value : '')).trim();
  if (!prompt) return;

  if (elements.aiPromptInput) elements.aiPromptInput.value = '';

  // 渲染用户消息
  appendAiMessage('user', prompt);
  state.aiHistory.push({ role: 'user', content: prompt });

  // 渲染 AI 占位气泡
  const aiBubble = appendAiMessage('assistant', '思考中...');
  state.isAiStreaming = true;
  if (elements.btnAiSend) elements.btnAiSend.disabled = true;

  try {
    const url = `${state.serverUrl}/api/ai/chat`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.token}`,
    };

    const payload = {
      message: prompt,
      stream: true,
      conversation_id: state.aiConversationId || undefined,
      model: (state.aiSettings && state.aiSettings.model) || undefined,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error((errJson && errJson.error) || `请求失败 (${response.status})`);
    }

    let fullAnswer = '';
    aiBubble.textContent = '';

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.replace(/^data:\s*/, '');
        if (dataStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.conversation_id && !state.aiConversationId) {
            state.aiConversationId = parsed.conversation_id;
          }
          if (parsed.text) {
            fullAnswer += parsed.text;
            aiBubble.textContent = fullAnswer;
            elements.aiChatMessages.scrollTop = elements.aiChatMessages.scrollHeight;
          }
        } catch {
          // 非 JSON SSE 行忽略
        }
      }
    }

    if (!fullAnswer) {
      aiBubble.textContent = '已接收响应但内容为空，请检查模型配置';
    } else {
      state.aiHistory.push({ role: 'assistant', content: fullAnswer });
    }
  } catch (err) {
    aiBubble.textContent = `⚠️ 对话异常: ${err.message || '请检查服务端 AI 配置与网络连接'}`;
  } finally {
    state.isAiStreaming = false;
    if (elements.btnAiSend) elements.btnAiSend.disabled = false;
    if (elements.aiPromptInput) elements.aiPromptInput.focus();
  }
}

// 快速快捷指令处理
async function handleQuickPrompt(type) {
  const tab = state.activeTab;
  let pageContext = '';

  if (tab) {
    pageContext = `当前网页标题: ${tab.title || ''}\n网页 URL: ${tab.url || ''}\n`;
    try {
      const [selectionResult] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString(),
      });
      if (selectionResult && selectionResult.result && selectionResult.result.trim()) {
        pageContext += `网页选中文本: \n"""\n${selectionResult.result.trim()}\n"""\n`;
      }
    } catch {}
  }

  let prompt = '';
  if (type === 'summary_page') {
    prompt = pageContext
      ? `${pageContext}\n请用简明扼要的中文条列总结以上网页的核心内容、主要观点及核心价值。`
      : '请总结当前网页的核心内容。';
  } else if (type === 'explain_page') {
    prompt = pageContext
      ? `${pageContext}\n请针对以上网页内容提炼出 3-5 个最具参考价值的核心知识点或操作步骤。`
      : '请提炼当前内容的核心知识点。';
  } else if (type === 'translate_zh') {
    prompt = pageContext
      ? `${pageContext}\n请将上述内容准确、通顺、地道地翻译为高质量中文。`
      : '请帮我将内容翻译成高质量中文。';
  }

  if (prompt) {
    sendAiMessage(prompt);
  }
}

// ==================== 新增书签视图 ====================

function openAddBookmarkView(prefillTab = state.activeTab) {
  switchView('add');
  if (elements.addAlert) elements.addAlert.classList.add('hidden');

  if (elements.bmCategory) {
    let catOptions = '<option value="">默认分类 (未归类)</option>';
    const tops = getTopCategories();

    let defaultSelected = '';
    if (state.selectedSubCatId !== 'all') {
      defaultSelected = String(state.selectedSubCatId);
    } else if (state.selectedTopCatId !== 'all') {
      defaultSelected = String(state.selectedTopCatId);
    }

    for (const top of tops) {
      const isTopSel = defaultSelected === String(top.id) ? 'selected' : '';
      catOptions += `<option value="${top.id}" ${isTopSel}>📁 ${escapeHtml(top.name)}</option>`;

      const subs = getSubCategories(top.id);
      for (const sub of subs) {
        const isSubSel = defaultSelected === String(sub.id) ? 'selected' : '';
        catOptions += `<option value="${sub.id}" ${isSubSel}>&nbsp;&nbsp;&nbsp;&nbsp;└ 📄 ${escapeHtml(sub.name)}</option>`;
      }
    }

    elements.bmCategory.innerHTML = catOptions;
  }

  if (prefillTab) {
    if (elements.bmUrl) elements.bmUrl.value = prefillTab.url || '';
    if (elements.bmTitle) elements.bmTitle.value = prefillTab.title || '';
    if (elements.bmFavicon) elements.bmFavicon.value = prefillTab.favIconUrl || '';
    if (elements.bmFaviconPreview) {
      elements.bmFaviconPreview.src = prefillTab.favIconUrl || 'icons/icon16.png';
      elements.bmFaviconPreview.onerror = () => { elements.bmFaviconPreview.src = 'icons/icon16.png'; };
    }
  } else {
    if (elements.bmUrl) elements.bmUrl.value = '';
    if (elements.bmTitle) elements.bmTitle.value = '';
    if (elements.bmFavicon) elements.bmFavicon.value = '';
    if (elements.bmFaviconPreview) elements.bmFaviconPreview.src = 'icons/icon16.png';
  }

  if (elements.bmDesc) elements.bmDesc.value = '';
  if (elements.bmPrivate) elements.bmPrivate.checked = false;

  setTimeout(() => {
    if (elements.bmTitle) elements.bmTitle.focus();
  }, 80);
}

async function fetchMetaForActiveTab() {
  const url = elements.bmUrl ? elements.bmUrl.value.trim() : '';
  if (!url) {
    showAddAlert('请先输入网址后再提取元数据', 'error');
    return;
  }

  const btn = elements.btnFetchMeta;
  setButtonLoading(btn, true, '识别中...');
  showAddAlert('', '');

  try {
    const res = await request('/api/bookmarks/fetch-meta', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });

    if (res) {
      if (res.title && elements.bmTitle) elements.bmTitle.value = res.title;
      if (res.description && elements.bmDesc) elements.bmDesc.value = res.description;
      if (res.favicon && elements.bmFavicon) {
        elements.bmFavicon.value = res.favicon;
        if (elements.bmFaviconPreview) elements.bmFaviconPreview.src = res.favicon;
      }
      showToast(res.aiUsed ? '已由 AI 提炼精准标题与简介' : '已成功抓取网站元信息');
    }
  } catch (err) {
    showAddAlert(`自动提取提示: ${err.message || '抓取失败，请手动输入'}`, 'error');
  } finally {
    setButtonLoading(btn, false, 'AI / 自动识别');
  }
}

async function handleAddSubmit(e) {
  e.preventDefault();
  const url = elements.bmUrl.value.trim();
  const title = elements.bmTitle.value.trim();
  const description = elements.bmDesc ? elements.bmDesc.value.trim() : '';
  const favicon = elements.bmFavicon ? elements.bmFavicon.value.trim() : '';
  const categoryId = elements.bmCategory && elements.bmCategory.value ? Number(elements.bmCategory.value) : null;
  const isPrivate = elements.bmPrivate ? elements.bmPrivate.checked : false;

  if (!url || !title) {
    showAddAlert('请填写网址和标题', 'error');
    return;
  }

  setButtonLoading(elements.btnSubmitAdd, true, '保存中...');
  showAddAlert('', '');

  try {
    const payload = {
      title,
      url,
      description,
      favicon,
      categoryId,
      isPrivate,
    };

    const res = await request('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res && res.bookmark) {
      showToast('🎉 书签已成功保存至 ZenLink');
      state.bookmarks.unshift(res.bookmark);
      await chrome.storage.local.set({ cachedBookmarks: state.bookmarks });
      renderCategoryPills();
      renderSubCategoryPills();
      renderBookmarks();
      switchView('main');
      switchModule('nav');
    } else {
      throw new Error('保存失败，服务端未返回有效结果');
    }
  } catch (err) {
    showAddAlert(err.message || '保存书签失败', 'error');
  } finally {
    setButtonLoading(elements.btnSubmitAdd, false, '保存至导航');
  }
}

function showAddAlert(msg, type = 'error') {
  if (!elements.addAlert) return;
  if (!msg) {
    elements.addAlert.classList.add('hidden');
    elements.addAlert.textContent = '';
    return;
  }
  elements.addAlert.textContent = msg;
  elements.addAlert.className = `alert-box alert-${type}`;
}

// ==================== 设置与账号视图 ====================

function openSettingsView() {
  switchView('settings');
  if (elements.stServerUrl) elements.stServerUrl.textContent = state.serverUrl || '--';
  if (elements.stUsername) elements.stUsername.textContent = (state.user && state.user.username) || '已连接';
}

// ==================== 事件监听绑定 ====================

function bindEvents() {
  // 1. 登录表单
  if (elements.loginForm) {
    elements.loginForm.addEventListener('submit', handleLogin);
  }

  // 2. 顶栏操作
  if (elements.btnMainAction) {
    elements.btnMainAction.addEventListener('click', () => {
      if (state.activeModule === 'nav') {
        openAddBookmarkView(state.activeTab);
      } else if (state.activeModule === 'notes') {
        openNoteEditView();
      } else if (state.activeModule === 'ai') {
        startNewAiChat();
      }
    });
  }
  if (elements.btnToSettings) {
    elements.btnToSettings.addEventListener('click', openSettingsView);
  }

  // 3. 底栏左下角模块切换 Dock
  elements.footerNavTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mod = btn.dataset.mod;
      if (mod) switchModule(mod);
    });
  });

  // 底栏刷新按钮
  if (elements.btnRefresh) {
    elements.btnRefresh.addEventListener('click', async () => {
      elements.btnRefresh.style.transform = 'rotate(360deg)';
      elements.btnRefresh.style.transition = 'transform 0.5s ease';
      await loadData(true);
      setTimeout(() => {
        elements.btnRefresh.style.transform = '';
        elements.btnRefresh.style.transition = '';
      }, 500);
    });
  }

  // 4. 网址导航相关事件
  if (elements.btnQuickCollect) {
    elements.btnQuickCollect.addEventListener('click', () => openAddBookmarkView(state.activeTab));
  }
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (elements.btnClearSearch) {
        if (state.searchQuery) elements.btnClearSearch.classList.remove('hidden');
        else elements.btnClearSearch.classList.add('hidden');
      }
      renderBookmarks();
    });
  }
  if (elements.btnClearSearch) {
    elements.btnClearSearch.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      elements.btnClearSearch.classList.add('hidden');
      renderBookmarks();
    });
  }

  // 5. 笔记相关事件
  if (elements.btnQuickClipNote) {
    elements.btnQuickClipNote.addEventListener('click', handleQuickClipNote);
  }
  if (elements.notesSearchInput) {
    elements.notesSearchInput.addEventListener('input', (e) => {
      state.notesSearchQuery = e.target.value;
      if (elements.btnClearNotesSearch) {
        if (state.notesSearchQuery) elements.btnClearNotesSearch.classList.remove('hidden');
        else elements.btnClearNotesSearch.classList.add('hidden');
      }
      renderNotes();
    });
  }
  if (elements.btnClearNotesSearch) {
    elements.btnClearNotesSearch.addEventListener('click', () => {
      elements.notesSearchInput.value = '';
      state.notesSearchQuery = '';
      elements.btnClearNotesSearch.classList.add('hidden');
      renderNotes();
    });
  }
  if (elements.btnBackFromNote) {
    elements.btnBackFromNote.addEventListener('click', () => {
      switchView('main');
      switchModule('notes');
    });
  }
  if (elements.btnCancelNote) {
    elements.btnCancelNote.addEventListener('click', () => {
      switchView('main');
      switchModule('notes');
    });
  }
  if (elements.noteEditForm) {
    elements.noteEditForm.addEventListener('submit', handleNoteSubmit);
  }

  // 6. AI 助手相关事件
  if (elements.btnAiNewChat) {
    elements.btnAiNewChat.addEventListener('click', startNewAiChat);
  }
  if (elements.btnAiSend) {
    elements.btnAiSend.addEventListener('click', () => sendAiMessage());
  }
  if (elements.aiPromptInput) {
    elements.aiPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAiMessage();
      }
    });
    // 自动高度调整
    elements.aiPromptInput.addEventListener('input', () => {
      elements.aiPromptInput.style.height = 'auto';
      elements.aiPromptInput.style.height = Math.min(elements.aiPromptInput.scrollHeight, 120) + 'px';
    });
  }
  if (elements.aiQuickPrompts) {
    elements.aiQuickPrompts.querySelectorAll('.ai-prompt-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const promptType = chip.dataset.prompt;
        handleQuickPrompt(promptType);
      });
    });
  }

  // 7. 新增书签表单事件
  if (elements.btnBackFromAdd) {
    elements.btnBackFromAdd.addEventListener('click', () => {
      switchView('main');
      switchModule('nav');
    });
  }
  if (elements.btnCancelAdd) {
    elements.btnCancelAdd.addEventListener('click', () => {
      switchView('main');
      switchModule('nav');
    });
  }
  if (elements.btnFetchMeta) {
    elements.btnFetchMeta.addEventListener('click', fetchMetaForActiveTab);
  }
  if (elements.addForm) {
    elements.addForm.addEventListener('submit', handleAddSubmit);
  }
  if (elements.bmFavicon) {
    elements.bmFavicon.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (elements.bmFaviconPreview) {
        elements.bmFaviconPreview.src = val || 'icons/icon16.png';
      }
    });
  }

  // 8. 设置视图事件
  if (elements.btnBackFromSettings) {
    elements.btnBackFromSettings.addEventListener('click', () => switchView('main'));
  }
  if (elements.btnOpenWeb) {
    elements.btnOpenWeb.addEventListener('click', () => {
      if (state.serverUrl) chrome.tabs.create({ url: state.serverUrl });
    });
  }
  if (elements.btnSyncAll) {
    elements.btnSyncAll.addEventListener('click', async () => {
      await loadData(true);
    });
  }
  if (elements.btnLogout) {
    elements.btnLogout.addEventListener('click', handleLogout);
  }
}

// 启动入口
document.addEventListener('DOMContentLoaded', init);
