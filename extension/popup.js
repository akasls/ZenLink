/**
 * ZenLink Chrome 扩展 Popup 核心交互逻辑
 * 1. 0 延迟秒开：本地离线缓存 + 后台静默增量同步
 * 2. 多合一工作台：底栏左下角无缝切换 [我的书签] / [我的笔记] / [AI对话]
 * 3. 完美横向平移：分类胶囊按钮支持鼠标直接抓取拖动与滚轮横向滚动，智能防误触
 * 4. 实时流式对话：两行紧凑输入框 (模型选择无方框外包裹+输入+发送同一行)，副顶栏左上角展示当前会话标题 (如“新对话”)，右上角历史图标展开抽屉
 * 5. 网页真实正文智能剪藏：在真实可见 DOM 中提取文章段落排版转 Markdown，支持 Markdown 工具条与 AI 生成标题/标签
 * 6. 原生/贴边侧边栏：优先原生 Chrome Side Panel，自动降级右侧停靠工作台双重保障
 */

// 全局响应式状态
const state = {
  serverUrl: '',
  token: '',
  user: null,
  siteName: 'ZenLink',
  activeModule: 'nav', // 'nav' | 'notes' | 'ai'

  // 书签导航模块
  categories: [],
  bookmarks: [],
  selectedTopCatId: 'all',
  selectedSubCatId: 'all',
  searchQuery: '',
  editingBookmarkId: null,

  // 笔记模块
  notes: [],
  noteCategories: [],
  notesSearchQuery: '',
  editingNoteId: null,

  // AI 模块
  aiSettings: null,
  selectedAiModel: '',
  currentAiTitle: '新对话',
  aiConversationId: null,
  aiConversations: [],
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

  siteTitle: document.getElementById('display-site-name'),
  btnMainAction: document.getElementById('btn-main-action'),
  iconMainAction: document.getElementById('icon-main-action'),
  txtMainAction: document.getElementById('txt-main-action'),
  btnOpenWindow: document.getElementById('btn-open-window'),
  btnOpenSidepanel: document.getElementById('btn-open-sidepanel') || document.getElementById('btn-open-window'),
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
  btnAiGenerateNoteMeta: document.getElementById('btn-ai-generate-note-meta'),
  noteCategoryInput: document.getElementById('note-category-input'),
  noteTagsInput: document.getElementById('note-tags-input'),
  editorQuickTools: document.getElementById('editor-quick-tools'),
  noteContentInput: document.getElementById('note-content-input'),
  notePinnedInput: document.getElementById('note-pinned-input'),
  noteEditAlert: document.getElementById('note-edit-alert'),
  btnCancelNote: document.getElementById('btn-cancel-note'),
  btnSubmitNote: document.getElementById('btn-submit-note'),

  // AI 面板 (副顶栏左上角展示当前会话标题如“新对话”)
  aiSessionTitle: document.getElementById('ai-session-title'),
  btnAiHistoryToggle: document.getElementById('btn-ai-history-toggle'),
  aiChatMessages: document.getElementById('ai-chat-messages'),
  aiComposerBox: document.querySelector('.ai-composer-box'),
  aiPromptInput: document.getElementById('ai-prompt-input'),
  aiModelSelect: document.getElementById('ai-model-select'),
  btnAiSend: document.getElementById('btn-ai-send'),

  // AI 历史抽屉
  aiHistoryDrawer: document.getElementById('ai-history-drawer'),
  btnCloseHistory: document.getElementById('btn-close-history'),
  btnHistoryNew: document.getElementById('btn-history-new'),
  btnHistoryClear: document.getElementById('btn-history-clear'),
  aiHistoryList: document.getElementById('ai-history-list'),

  // 添加书签视图
  addBookmarkHeaderTitle: document.getElementById('add-bookmark-header-title'),
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
  stOpenSidepanel: document.getElementById('st-open-sidepanel'),
  stTranslateEnabled: document.getElementById('st-translate-enabled'),
  stTranslateProvider: document.getElementById('st-translate-provider'),
  btnOpenWeb: document.getElementById('btn-open-web'),
  btnSyncAll: document.getElementById('btn-sync-all'),
  btnReloadExt: document.getElementById('btn-reload-ext'),
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
  const textEl = btn.querySelector('.btn-text') || btn.querySelector('span:last-child');
  const spinnerEl = btn.querySelector('.btn-spinner');
  if (textEl && text) textEl.textContent = text;
  if (spinnerEl) {
    if (loading) spinnerEl.classList.remove('hidden');
    else spinnerEl.classList.add('hidden');
  }
}

// ==================== 终极丝滑横向滑动与拖拽 ====================

function enableSmoothDragAndWheel(container) {
  if (!container) return;

  container.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let hasDragged = false;

  container.addEventListener('mousedown', (e) => {
    isDown = true;
    hasDragged = false;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });

  window.addEventListener('mouseup', () => {
    if (isDown) {
      isDown = false;
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
  // 检查是否在全高独立伴随工作台窗口或 Chrome 侧边栏中运行
  const isSidePanel = window.location.pathname.includes('sidepanel') ||
                      window.location.search.includes('window') || 
                      window.location.search.includes('sidepanel') ||
                      (document.documentElement.classList.contains('in-sidepanel') && !document.documentElement.classList.contains('in-popup'));
  if (isSidePanel) {
    document.documentElement.classList.remove('in-popup');
    document.body.classList.remove('in-popup');
    document.documentElement.classList.add('in-sidepanel');
    document.body.classList.add('in-sidepanel');
    if (window.location.search.includes('window')) {
      document.documentElement.classList.add('in-window');
      document.body.classList.add('in-window');
    }
  } else {
    document.documentElement.classList.remove('in-sidepanel', 'in-window');
    document.body.classList.remove('in-sidepanel', 'in-window');
    document.documentElement.classList.add('in-popup');
    document.body.classList.add('in-popup');
  }

  // 1. 读取本地缓存，做到 0 延迟秒开
  const stored = await chrome.storage.local.get([
    'serverUrl',
    'authToken',
    'authUser',
    'siteName',
    'cachedCategories',
    'cachedBookmarks',
    'cachedNotes',
    'cachedNoteCategories',
    'selectedTopCatId',
    'selectedSubCatId',
    'activeModule',
    'selectedAiModel',
  ]);

  state.serverUrl = stored.serverUrl || '';
  state.token = stored.authToken || '';
  state.user = stored.authUser || null;
  state.siteName = stored.siteName || 'ZenLink';
  state.categories = Array.isArray(stored.cachedCategories) ? stored.cachedCategories : [];
  state.bookmarks = Array.isArray(stored.cachedBookmarks) ? stored.cachedBookmarks : [];
  state.notes = Array.isArray(stored.cachedNotes) ? stored.cachedNotes : [];
  state.noteCategories = Array.isArray(stored.cachedNoteCategories) ? stored.cachedNoteCategories : [];
  state.selectedTopCatId = stored.selectedTopCatId || 'all';
  state.selectedSubCatId = stored.selectedSubCatId || 'all';
  state.activeModule = stored.activeModule || 'nav';
  state.selectedAiModel = stored.selectedAiModel || '';

  // 绑定拖拽
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

    // 3. 读取当前活动标签页
    getActiveWebTab().then((tab) => {
      if (tab) {
        state.activeTab = tab;
        updateActiveTabBanners(tab);
      }
    }).catch(() => {});

    // 4. 后台静默增量拉取最新数据
    silentSyncData();
    initAiSettings();

    // 5. 检查是否存在右键菜单发起的「添加当前网页到书签」待处理任务
    try {
      const storedPending = await chrome.storage.local.get(['pendingAddBookmark']);
      if (storedPending && storedPending.pendingAddBookmark && Date.now() - storedPending.pendingAddBookmark.timestamp < 180000) {
        const pending = storedPending.pendingAddBookmark;
        await chrome.storage.local.remove(['pendingAddBookmark']);
        openAddBookmarkView(pending, false);
      }
    } catch (e) {}
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

  // 关闭 AI 历史抽屉
  closeAiHistoryDrawer();

  // 更新顶栏主操作按钮
  updateMainActionButton();
  // 更新顶栏左上角标题 (满足需求：我的书签 / 我的笔记 / AI对话)
  updateHeaderTitle();
  // 更新底栏状态文字
  updateFooterStat();
}

// 满足需求 1：左上角标题分别改成：我的书签 我的笔记 AI对话
function updateHeaderTitle() {
  if (!elements.siteTitle) return;
  if (state.activeModule === 'nav') {
    elements.siteTitle.textContent = '我的书签';
    elements.siteTitle.title = '我的书签';
  } else if (state.activeModule === 'notes') {
    elements.siteTitle.textContent = '我的笔记';
    elements.siteTitle.title = '我的笔记';
  } else if (state.activeModule === 'ai') {
    elements.siteTitle.textContent = 'AI对话';
    elements.siteTitle.title = 'AI对话';
  }
}

// 满足需求 3：AI对话页面顶栏下面的左上角显示对话标题不要显示模型名称，例如：新对话
function updateAiSessionTitle(title) {
  state.currentAiTitle = title || '新对话';
  if (elements.aiSessionTitle) {
    elements.aiSessionTitle.textContent = state.currentAiTitle;
    elements.aiSessionTitle.title = `当前会话: ${state.currentAiTitle}`;
  }
}

function updateMainActionButton() {
  if (!elements.btnMainAction || !elements.txtMainAction || !elements.iconMainAction) return;

  if (state.activeModule === 'nav') {
    elements.txtMainAction.textContent = '添加书签';
    elements.btnMainAction.title = '添加书签至导航';
    elements.iconMainAction.innerHTML = '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>';
    elements.btnMainAction.classList.remove('hidden');
  } else if (state.activeModule === 'notes') {
    elements.txtMainAction.textContent = '新建笔记';
    elements.btnMainAction.title = '新建在线笔记';
    elements.iconMainAction.innerHTML = '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>';
    elements.btnMainAction.classList.remove('hidden');
  } else if (state.activeModule === 'ai') {
    // 满足需求：在 AI 对话右上角保留之前的“新对话”按钮
    elements.txtMainAction.textContent = '新对话';
    elements.btnMainAction.title = '开启新对话';
    elements.iconMainAction.innerHTML = '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>';
    elements.btnMainAction.classList.remove('hidden');
  }
}

function updateFooterStat() {
  if (!elements.statCount) return;
  if (state.activeModule === 'nav') {
    elements.statCount.textContent = `共 ${state.bookmarks.length} 个书签`;
  } else if (state.activeModule === 'notes') {
    elements.statCount.textContent = `共 ${state.notes.length} 篇笔记`;
  } else if (state.activeModule === 'ai') {
    // 满足需求 4：右下角底栏不用显示模型名称
    elements.statCount.textContent = '已就绪';
  }
}

// ==================== 后台静默同步 ====================

async function silentSyncData() {
  if (state.isSyncing) return;
  state.isSyncing = true;

  try {
    const [catRes, bmRes, notesRes, noteCatRes, settingsRes] = await Promise.all([
      request('/api/categories').catch(() => null),
      request('/api/bookmarks').catch(() => null),
      request('/api/notes').catch(() => null),
      request('/api/note-categories').catch(() => null),
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
    if (noteCatRes && noteCatRes.categories) {
      state.noteCategories = noteCatRes.categories;
      hasChanges = true;
    }
    if (settingsRes && settingsRes.settings && settingsRes.settings.site_name) {
      state.siteName = settingsRes.settings.site_name;
    }

    if (hasChanges) {
      await chrome.storage.local.set({
        cachedCategories: state.categories,
        cachedBookmarks: state.bookmarks,
        cachedNotes: state.notes,
        cachedNoteCategories: state.noteCategories,
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
    const [catRes, bmRes, notesRes, noteCatRes] = await Promise.all([
      request('/api/categories'),
      request('/api/bookmarks'),
      request('/api/notes'),
      request('/api/note-categories').catch(() => ({ categories: [] })),
    ]);

    state.categories = (catRes && catRes.categories) || [];
    state.bookmarks = (bmRes && bmRes.bookmarks) || [];
    state.notes = (notesRes && notesRes.notes) || [];
    state.noteCategories = (noteCatRes && noteCatRes.categories) || [];

    await chrome.storage.local.set({
      cachedCategories: state.categories,
      cachedBookmarks: state.bookmarks,
      cachedNotes: state.notes,
      cachedNoteCategories: state.noteCategories,
    });

    renderCategoryPills();
    renderSubCategoryPills();
    renderBookmarks();
    renderNotes();
    updateFooterStat();

    if (showSuccessToast) showToast('已成功同步全站最新数据');
  } catch (err) {
    showToast(err.message || '加载数据失败');
    if (elements.statCount) elements.statCount.textContent = '同步遇到问题，展示离线缓存';
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
  state.noteCategories = [];
  await chrome.storage.local.remove([
    'authToken',
    'authUser',
    'cachedCategories',
    'cachedBookmarks',
    'cachedNotes',
    'cachedNoteCategories',
  ]);
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
  const renderList = filtered.slice(0, 100);

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
          <button class="action-btn btn-edit-bm" title="编辑书签" data-id="${bm.id}">
            <svg class="icon-sm" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
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

  if (filtered.length > 100) {
    html += `<div class="text-center py-2 text-[10px] text-muted-foreground">余下 ${filtered.length - 100} 条请在上方输入关键词搜索</div>`;
  }

  elements.bookmarkList.innerHTML = html;

  elements.bookmarkList.querySelectorAll('.bookmark-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.action-btn')) return;
      const url = card.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  });

  elements.bookmarkList.querySelectorAll('.btn-edit-bm').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bmId = Number(btn.dataset.id);
      const target = state.bookmarks.find((b) => b.id === bmId);
      if (target) openAddBookmarkView(target, true);
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

  renderNoteCategoryOptions(noteId);

  if (noteId) {
    if (elements.noteEditHeaderTitle) elements.noteEditHeaderTitle.textContent = '编辑笔记';
    if (elements.btnSubmitNote) elements.btnSubmitNote.textContent = '更新笔记';
    const note = state.notes.find(n => n.id === noteId);
    if (note) {
      if (elements.noteTitleInput) elements.noteTitleInput.value = note.title || '';
      if (elements.noteTagsInput) elements.noteTagsInput.value = Array.isArray(note.tags) ? note.tags.join(', ') : '';
      if (elements.noteContentInput) elements.noteContentInput.value = note.content || '';
      if (elements.notePinnedInput) elements.notePinnedInput.checked = !!note.is_pinned;
      if (elements.noteCategoryInput && note.category_id) {
        elements.noteCategoryInput.value = String(note.category_id);
      }
    }
  } else {
    if (elements.noteEditHeaderTitle) elements.noteEditHeaderTitle.textContent = '新建笔记';
    if (elements.btnSubmitNote) elements.btnSubmitNote.textContent = '保存笔记';
    if (elements.noteTitleInput) elements.noteTitleInput.value = '';
    if (elements.noteTagsInput) elements.noteTagsInput.value = '';
    if (elements.noteContentInput) elements.noteContentInput.value = '';
    if (elements.notePinnedInput) elements.notePinnedInput.checked = false;
    if (elements.noteCategoryInput) elements.noteCategoryInput.value = '';
  }

  setTimeout(() => {
    if (elements.noteTitleInput) elements.noteTitleInput.focus();
  }, 80);
}

function renderNoteCategoryOptions(noteId) {
  if (!elements.noteCategoryInput) return;
  let options = '<option value="">默认分类 (未归类)</option>';
  if (Array.isArray(state.noteCategories)) {
    state.noteCategories.forEach((cat) => {
      options += `<option value="${cat.id}">📁 ${escapeHtml(cat.name)}</option>`;
    });
  }
  elements.noteCategoryInput.innerHTML = options;
}

function insertMarkdownToEditor(type) {
  const textarea = elements.noteContentInput;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  const selected = val.substring(start, end);

  let replacement = '';
  let cursorOffset = 0;

  switch (type) {
    case 'bold':
      replacement = `**${selected || '粗体文字'}**`;
      cursorOffset = selected ? replacement.length : 2;
      break;
    case 'italic':
      replacement = `*${selected || '斜体文字'}*`;
      cursorOffset = selected ? replacement.length : 1;
      break;
    case 'heading':
      replacement = `\n### ${selected || '标题'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'code':
      replacement = `\n\`\`\`\n${selected || '代码内容'}\n\`\`\`\n`;
      cursorOffset = replacement.length;
      break;
    case 'quote':
      replacement = `\n> ${selected || '引用内容'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'list':
      replacement = `\n- ${selected || '列表项'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'task':
      replacement = `\n- [ ] ${selected || '待办清单'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'link':
      replacement = `[${selected || '链接说明'}](https://)`;
      cursorOffset = replacement.length;
      break;
  }

  textarea.value = val.substring(0, start) + replacement + val.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
}

// AI 智能分析笔记正文生成标题与标签
async function handleAiGenerateNoteMeta() {
  const content = elements.noteContentInput ? elements.noteContentInput.value.trim() : '';
  if (!content) {
    showToast('请先输入或剪藏笔记正文，再使用 AI 生成标题与标签');
    return;
  }

  const btn = elements.btnAiGenerateNoteMeta;
  setButtonLoading(btn, true, 'AI 分析中...');

  try {
    const prompt = `你是一个知识管理助手。请根据以下笔记正文内容，提炼生成一个精准简洁的笔记标题（15字以内）和2至4个最相关的分类标签。
请严格仅以纯 JSON 格式输出，不要包含任何 Markdown 语法标记或前缀后缀：
{"title": "精炼标题", "tags": ["标签1", "标签2"]}

笔记正文：
${content.slice(0, 2500)}`;

    const response = await fetch(`${state.serverUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        message: prompt,
        stream: true,
        is_private: true,
        model: state.selectedAiModel || (state.aiSettings && (state.aiSettings.writing_model || state.aiSettings.model)) || undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`请求失败 (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullOutput = '';

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
          if (parsed.text) fullOutput += parsed.text;
        } catch {}
      }
    }

    const match = fullOutput.match(/\{[\s\S]*\}/);
    if (match) {
      const result = JSON.parse(match[0]);
      if (result.title && elements.noteTitleInput) {
        elements.noteTitleInput.value = result.title;
      }
      if (Array.isArray(result.tags) && elements.noteTagsInput) {
        elements.noteTagsInput.value = result.tags.join(', ');
      }
      showToast('✨ AI 已成功提炼标题与标签');
    } else {
      throw new Error('未能提取结构化数据');
    }
  } catch (err) {
    showToast(`AI 生成提示: ${err.message || '请手动输入标题'}`);
  } finally {
    setButtonLoading(btn, false, 'AI 生成标题/标签');
  }
}

// 获取当前浏览器中用户正在查看的真实活动标签页 (排除扩展自身页面)
async function getActiveWebTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.url && !tab.url.startsWith('chrome-extension://')) {
      return tab;
    }
  } catch (e) {}

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !tab.url.startsWith('chrome-extension://')) {
      return tab;
    }
  } catch (e) {}

  try {
    const tabs = await chrome.tabs.query({ active: true });
    const webTab = tabs.find((t) => t.url && !t.url.startsWith('chrome-extension://'));
    if (webTab) return webTab;
  } catch (e) {}

  return state.activeTab;
}

// 网页智能剪藏 (支持划选截取、论坛帖子正文与主流博客文章提取)
async function handleQuickClipNote() {
  const tab = await getActiveWebTab();

  if (!tab || !tab.id) {
    openNoteEditView();
    showToast('未能定位网页，已开启空白笔记');
    return;
  }

  // 内部系统页面防护
  if (/^(chrome|edge|about|devtools):/i.test(tab.url || '')) {
    openNoteEditView();
    if (elements.noteTitleInput) elements.noteTitleInput.value = tab.title || '网页笔记';
    if (elements.noteContentInput) {
      elements.noteContentInput.value = `> 来源网页: [${tab.title || tab.url}](${tab.url})\n\n> (浏览器系统内部页面受安全策略限制无法读取正文，可在下方直接记录笔记)`;
    }
    showToast('系统内部页面已载入网址，请直接记录');
    return;
  }

  showToast('正在智能抓取网页正文内容...');

  let extractedContent = '';

  // 1. 优先通过已注入的 content.js 进行提取
  try {
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: 'CLIP_PAGE_CONTENT' }, (res) => {
        if (chrome.runtime.lastError || !res) {
          resolve(null);
        } else {
          resolve(res);
        }
      });
    });
    if (response && response.success && response.data && response.data.content) {
      extractedContent = response.data.content.trim();
    }
  } catch (e) {}

  // 2. 备用方案：若 content.js 未就绪，通过 scripting.executeScript 动态注入提取
  if (!extractedContent) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 2.1 检查用户划选文本
          const sel = window.getSelection ? window.getSelection().toString().trim() : '';
          if (sel && sel.length > 5) return sel;

          // 2.2 匹配主流文章与论坛帖子容器 (包含 NodeSeek, V2EX 等论坛和主流博客)
          const selectors = [
            '.post-content', '.post-message', '.topic-content',
            'article', '.article-content', '.entry-content',
            '#article-content', '.markdown-body', '.rich_media_content',
            '.content-body', 'main', '#content', '.content'
          ];
          let container = null;
          for (const s of selectors) {
            const el = document.querySelector(s);
            if (el) {
              const txt = (el.innerText || el.textContent || '').trim();
              if (txt.length > 10) {
                container = el;
                break;
              }
            }
          }
          if (!container) container = document.body;

          const clone = container.cloneNode(true);
          const junk = [
            'script', 'style', 'noscript', 'nav', 'header', 'footer', 
            'iframe', 'aside', '.sidebar', '.ad', '.advertisement'
          ];
          if (clone === document.body) junk.push('.comment', '.comments', '#comments');
          junk.forEach((sel) => clone.querySelectorAll(sel).forEach((el) => el.remove()));

          const blocks = clone.querySelectorAll('h1, h2, h3, h4, h5, h6, p, pre, blockquote, ul, ol, div');
          const lines = [];
          blocks.forEach((el) => {
            const hasBlockChildren = el.querySelector('h1, h2, h3, h4, h5, h6, p, pre, blockquote, ul, ol');
            if (hasBlockChildren) return;
            const t = (el.innerText || el.textContent || '').trim();
            if (!t) return;
            const tag = el.tagName.toLowerCase();
            if (tag === 'h1') lines.push(`\n# ${t}\n`);
            else if (tag === 'h2') lines.push(`\n## ${t}\n`);
            else if (tag === 'h3') lines.push(`\n### ${t}\n`);
            else if (tag === 'pre') lines.push(`\n\`\`\`\n${t}\n\`\`\`\n`);
            else if (tag === 'blockquote') lines.push(`\n> ${t}\n`);
            else lines.push(`${t}\n`);
          });

          if (lines.length >= 1) return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
          return (clone.innerText || clone.textContent || '').trim();
        },
      });

      if (result && result.result && typeof result.result === 'string') {
        extractedContent = result.result.trim();
      }
    } catch (err) {
      console.warn('动态脚本提取网页正文失败:', err);
    }
  }

  openNoteEditView();

  const title = (tab.title || '网页剪藏').replace(/\s*[-_–|].*$/, '').trim() || tab.title;
  if (elements.noteTitleInput) elements.noteTitleInput.value = title;
  if (elements.noteTagsInput) elements.noteTagsInput.value = '网页剪藏, 阅读';

  let clipMarkdown = `> 来源网页: [${tab.title || tab.url}](${tab.url})\n> 剪藏时间: ${new Date().toLocaleString()}\n\n`;
  if (extractedContent) {
    clipMarkdown += `### 正文内容\n\n${extractedContent.slice(0, 15000)}\n`;
    showToast('🎉 已成功剪藏网页正文至笔记');
  } else {
    clipMarkdown += `> (未在当前页面提取到成段正文，可在下方直接记录笔记)\n`;
    showToast('已载入网址，请直接记录');
  }

  if (elements.noteContentInput) {
    elements.noteContentInput.value = clipMarkdown;
  }
}

// 提交保存笔记
async function handleNoteSubmit(e) {
  e.preventDefault();
  const title = elements.noteTitleInput ? elements.noteTitleInput.value.trim() : '';
  const content = elements.noteContentInput ? elements.noteContentInput.value : '';
  const tagsStr = elements.noteTagsInput ? elements.noteTagsInput.value.trim() : '';
  const categoryId = elements.noteCategoryInput && elements.noteCategoryInput.value ? Number(elements.noteCategoryInput.value) : null;
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
      res = await request(`/api/notes/${state.editingNoteId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content, categoryId, isPinned, tags }),
      });
      if (res && res.note) {
        showToast('✅ 笔记已成功更新');
        const idx = state.notes.findIndex(n => n.id === state.editingNoteId);
        if (idx !== -1) state.notes[idx] = res.note;
      }
    } else {
      res = await request('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ title, content, categoryId, tags }),
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
    setButtonLoading(elements.btnSubmitNote, false, state.editingNoteId ? '更新笔记' : '保存笔记');
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
      renderAiModelSelectOptions();
    }
  } catch (err) {
    console.warn('获取 AI 设置失败:', err);
  }
}

function renderAiModelSelectOptions() {
  if (!elements.aiModelSelect) return;
  const models = (state.aiSettings && state.aiSettings.available_models) || [];
  const defaultModel = (state.aiSettings && state.aiSettings.model) || '';

  let html = '';
  if (defaultModel) {
    html += `<option value="${escapeHtml(defaultModel)}">${escapeHtml(defaultModel)}</option>`;
  } else {
    html += `<option value="">默认模型</option>`;
  }

  models.forEach((m) => {
    if (m !== defaultModel) {
      html += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`;
    }
  });

  elements.aiModelSelect.innerHTML = html;

  if (state.selectedAiModel) {
    elements.aiModelSelect.value = state.selectedAiModel;
  }
}

function startNewAiChat() {
  state.aiConversationId = null;
  state.aiHistory = [];
  updateAiSessionTitle('新对话');

  if (elements.aiChatMessages) {
    elements.aiChatMessages.innerHTML = '';
  }
  if (elements.aiPromptInput) {
    elements.aiPromptInput.value = '';
    elements.aiPromptInput.focus();
  }
  closeAiHistoryDrawer();
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

  // 若当前为新对话，更新副顶栏会话标题为首条问题摘要
  if (state.currentAiTitle === '新对话') {
    updateAiSessionTitle(prompt.slice(0, 16));
  }

  appendAiMessage('user', prompt);
  state.aiHistory.push({ role: 'user', content: prompt });

  const aiBubble = appendAiMessage('assistant', '思考中...');
  state.isAiStreaming = true;
  if (elements.btnAiSend) elements.btnAiSend.disabled = true;

  try {
    const url = `${state.serverUrl}/api/ai/chat`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.token}`,
    };

    const modelToUse = state.selectedAiModel || (elements.aiModelSelect ? elements.aiModelSelect.value : '') || undefined;

    const payload = {
      message: prompt,
      stream: true,
      conversation_id: state.aiConversationId || undefined,
      model: modelToUse,
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
        } catch {}
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

// ==================== AI 历史会话管理 ====================

function toggleAiHistoryDrawer() {
  if (!elements.aiHistoryDrawer) return;
  if (elements.aiHistoryDrawer.classList.contains('hidden')) {
    openAiHistoryDrawer();
  } else {
    closeAiHistoryDrawer();
  }
}

async function openAiHistoryDrawer() {
  if (!elements.aiHistoryDrawer) return;
  elements.aiHistoryDrawer.classList.remove('hidden');
  await loadAiConversations();
}

function closeAiHistoryDrawer() {
  if (elements.aiHistoryDrawer) {
    elements.aiHistoryDrawer.classList.add('hidden');
  }
}

async function loadAiConversations() {
  if (!elements.aiHistoryList) return;
  elements.aiHistoryList.innerHTML = '<div class="text-center py-6 text-xs text-muted-foreground">正在加载历史会话...</div>';

  try {
    const res = await request('/api/ai/conversations');
    state.aiConversations = (res && res.conversations) || [];

    if (state.aiConversations.length === 0) {
      elements.aiHistoryList.innerHTML = `
        <div class="empty-state py-8 text-center">
          <p class="empty-text text-xs text-muted-foreground">暂无历史对话记录</p>
        </div>
      `;
      return;
    }

    let html = '';
    state.aiConversations.forEach((conv) => {
      const isActive = state.aiConversationId === conv.id;
      const dateStr = conv.updated_at ? new Date(conv.updated_at).toLocaleString() : '';
      html += `
        <div class="history-item ${isActive ? 'active' : ''}" data-id="${conv.id}">
          <div class="history-info">
            <span class="history-title" title="${escapeHtml(conv.title)}">${escapeHtml(conv.title || '无标题会话')}</span>
            <span class="history-meta">${dateStr}</span>
          </div>
          <button class="btn-delete-history" data-delete-id="${conv.id}" title="删除此会话">
            <svg class="icon-xs" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      `;
    });

    elements.aiHistoryList.innerHTML = html;

    elements.aiHistoryList.querySelectorAll('.history-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-history')) return;
        const convId = item.dataset.id;
        openConversation(convId);
        closeAiHistoryDrawer();
      });
    });

    elements.aiHistoryList.querySelectorAll('.btn-delete-history').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const convId = btn.dataset.deleteId;
        await deleteConversation(convId);
      });
    });
  } catch (err) {
    elements.aiHistoryList.innerHTML = `<div class="text-center py-6 text-xs text-danger">加载失败: ${escapeHtml(err.message)}</div>`;
  }
}

async function openConversation(conversationId) {
  state.aiConversationId = conversationId;
  const targetConv = state.aiConversations.find(c => c.id === conversationId);
  if (targetConv) {
    updateAiSessionTitle(targetConv.title || '对话');
  }

  if (elements.aiChatMessages) {
    elements.aiChatMessages.innerHTML = '<div class="text-center py-6 text-xs text-muted-foreground">正在加载消息历史...</div>';
  }

  try {
    const res = await request(`/api/ai/conversations/${conversationId}/messages`);
    const messages = (res && res.messages) || [];

    if (elements.aiChatMessages) {
      elements.aiChatMessages.innerHTML = '';
      if (messages.length === 0) {
        elements.aiChatMessages.innerHTML = `
          <div class="ai-msg ai-msg-assistant">
            <div class="ai-msg-bubble">该对话暂无消息，你可以直接输入问题。</div>
          </div>
        `;
      } else {
        messages.forEach((m) => {
          appendAiMessage(m.role === 'user' ? 'user' : 'assistant', m.content);
        });
      }
    }
  } catch (err) {
    showToast(`加载消息失败: ${err.message}`);
  }
}

async function deleteConversation(conversationId) {
  if (!confirm('确定要删除此条历史会话吗？')) return;
  try {
    await request(`/api/ai/conversations/${conversationId}`, { method: 'DELETE' });
    showToast('会话已删除');
    if (state.aiConversationId === conversationId) {
      startNewAiChat();
    }
    await loadAiConversations();
  } catch (err) {
    showToast(`删除失败: ${err.message}`);
  }
}

async function clearAllConversations() {
  if (!confirm('确定要清空全部 AI 历史对话记录吗？此操作不可撤销。')) return;
  try {
    await request('/api/ai/conversations/clear', { method: 'POST' });
    showToast('已清空全部历史对话');
    startNewAiChat();
    await loadAiConversations();
  } catch (err) {
    showToast(`清空失败: ${err.message}`);
  }
}

// ==================== 新增书签视图 ====================

function openAddBookmarkView(targetOrTab = state.activeTab, isEdit = false) {
  state.editingBookmarkId = isEdit && targetOrTab ? targetOrTab.id : null;
  switchView('add');
  if (elements.addAlert) elements.addAlert.classList.add('hidden');

  if (elements.addBookmarkHeaderTitle) {
    elements.addBookmarkHeaderTitle.textContent = isEdit ? '编辑导航书签' : '添加书签至导航';
  }
  if (elements.btnSubmitAdd) {
    elements.btnSubmitAdd.textContent = isEdit ? '更新书签' : '保存至导航';
  }

  if (elements.bmCategory) {
    let catOptions = '<option value="">默认分类 (未归类)</option>';
    const tops = getTopCategories();

    let defaultSelected = '';
    if (isEdit && targetOrTab && targetOrTab.category_id) {
      defaultSelected = String(targetOrTab.category_id);
    } else if (state.selectedSubCatId !== 'all') {
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

  if (isEdit && targetOrTab) {
    if (elements.bmUrl) elements.bmUrl.value = targetOrTab.url || '';
    if (elements.bmTitle) elements.bmTitle.value = targetOrTab.title || '';
    if (elements.bmDesc) elements.bmDesc.value = targetOrTab.description || '';
    if (elements.bmFavicon) elements.bmFavicon.value = targetOrTab.favicon || '';
    if (elements.bmFaviconPreview) {
      elements.bmFaviconPreview.src = targetOrTab.favicon || 'icons/icon16.png';
      elements.bmFaviconPreview.onerror = () => { elements.bmFaviconPreview.src = 'icons/icon16.png'; };
    }
    if (elements.bmPrivate) elements.bmPrivate.checked = !!targetOrTab.is_private;
  } else if (targetOrTab && targetOrTab.url) {
    if (elements.bmUrl) elements.bmUrl.value = targetOrTab.url || '';
    if (elements.bmTitle) elements.bmTitle.value = targetOrTab.title || '';
    if (elements.bmFavicon) elements.bmFavicon.value = targetOrTab.favIconUrl || '';
    if (elements.bmFaviconPreview) {
      elements.bmFaviconPreview.src = targetOrTab.favIconUrl || 'icons/icon16.png';
      elements.bmFaviconPreview.onerror = () => { elements.bmFaviconPreview.src = 'icons/icon16.png'; };
    }
    if (elements.bmDesc) elements.bmDesc.value = '';
    if (elements.bmPrivate) elements.bmPrivate.checked = false;
  } else {
    if (elements.bmUrl) elements.bmUrl.value = '';
    if (elements.bmTitle) elements.bmTitle.value = '';
    if (elements.bmFavicon) elements.bmFavicon.value = '';
    if (elements.bmFaviconPreview) elements.bmFaviconPreview.src = 'icons/icon16.png';
    if (elements.bmDesc) elements.bmDesc.value = '';
    if (elements.bmPrivate) elements.bmPrivate.checked = false;
  }

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

  const isEdit = !!state.editingBookmarkId;
  setButtonLoading(elements.btnSubmitAdd, true, isEdit ? '更新中...' : '保存中...');
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

    if (isEdit) {
      const res = await request(`/api/bookmarks/${state.editingBookmarkId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const updatedBm = res && res.bookmark ? res.bookmark : { id: state.editingBookmarkId, ...payload, category_id: categoryId, is_private: isPrivate };
      const idx = state.bookmarks.findIndex((b) => b.id === state.editingBookmarkId);
      if (idx !== -1) {
        state.bookmarks[idx] = { ...state.bookmarks[idx], ...updatedBm };
      }
      await chrome.storage.local.set({ cachedBookmarks: state.bookmarks });
      renderCategoryPills();
      renderSubCategoryPills();
      renderBookmarks();
      switchView('main');
      switchModule('nav');
      showToast('✅ 书签已成功更新');
    } else {
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
    }
  } catch (err) {
    showAddAlert(err.message || (isEdit ? '更新书签失败' : '保存书签失败'), 'error');
  } finally {
    setButtonLoading(elements.btnSubmitAdd, false, isEdit ? '更新书签' : '保存至导航');
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

async function openSettingsView() {
  switchView('settings');
  if (elements.stServerUrl) elements.stServerUrl.textContent = state.serverUrl || '--';
  if (elements.stUsername) elements.stUsername.textContent = (state.user && state.user.username) || '已连接';

  const versionEl = document.getElementById('settings-version');
  if (versionEl && chrome.runtime && chrome.runtime.getManifest) {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) {
        versionEl.textContent = `ZenLink Chrome Extension v${manifest.version}`;
      }
    } catch (e) {}
  }

  try {
    const stored = await chrome.storage.local.get(['openInSidePanel', 'translationEnabled', 'translationProviders', 'translationProvider']);
    if (elements.stOpenSidepanel) {
      elements.stOpenSidepanel.checked = stored.openInSidePanel !== false;
    }
    if (elements.stTranslateEnabled) {
      elements.stTranslateEnabled.checked = stored.translationEnabled !== false;
    }
    const providers = Array.isArray(stored.translationProviders) && stored.translationProviders.length > 0
      ? stored.translationProviders
      : (stored.translationProvider ? [stored.translationProvider] : ['google']);
    document.querySelectorAll('.st-engine-check').forEach((chk) => {
      chk.checked = providers.includes(chk.value);
    });
  } catch (e) {
    console.warn('加载翻译设置失败', e);
  }
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
        // AI 模式下顶栏右上角新对话按钮
        startNewAiChat();
      }
    });
  }

  // 顶栏右上角「在新窗口中打开」按钮：在屏幕右侧开启与当前浏览器窗口网页等高的伴随工作台
  const btnWindowTrigger = elements.btnOpenWindow || elements.btnOpenSidepanel;
  if (btnWindowTrigger) {
    btnWindowTrigger.addEventListener('click', async () => {
      try {
        if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
          try {
            const currentWindow = await chrome.windows.getCurrent().catch(() => null);
            if (currentWindow && currentWindow.id) {
              await chrome.sidePanel.open({ windowId: currentWindow.id });
              window.close();
              return;
            }
          } catch (spErr) {}
        }

        const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
        const screenW = window.screen.availWidth || 1920;
        const screenH = window.screen.availHeight || 1080;
        const sideWidth = 440;

        let top = 0;
        let height = screenH;
        let left = Math.max(0, screenW - sideWidth);

        if (win && typeof win.height === 'number') {
          top = win.top >= 0 ? win.top : 0;
          height = win.height;
          left = Math.max(0, win.left + win.width - sideWidth);
        }

        await chrome.windows.create({
          url: chrome.runtime.getURL('sidepanel.html?mode=window'),
          type: 'popup',
          width: sideWidth,
          height: height,
          top: top,
          left: left,
          focused: true,
        });

        window.close();
      } catch (err) {
        chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html?mode=window') });
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
  if (elements.btnAiGenerateNoteMeta) {
    elements.btnAiGenerateNoteMeta.addEventListener('click', handleAiGenerateNoteMeta);
  }
  if (elements.editorQuickTools) {
    elements.editorQuickTools.querySelectorAll('.editor-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool) insertMarkdownToEditor(tool);
      });
    });
  }

  // 6. AI 助手相关事件
  if (elements.btnAiHistoryToggle) {
    // 满足需求：顶栏下方右上角历史图标点击展开历史
    elements.btnAiHistoryToggle.addEventListener('click', toggleAiHistoryDrawer);
  }
  if (elements.btnAiSend) {
    elements.btnAiSend.addEventListener('click', () => sendAiMessage());
  }
  if (elements.aiModelSelect) {
    elements.aiModelSelect.addEventListener('change', (e) => {
      state.selectedAiModel = e.target.value;
      chrome.storage.local.set({ selectedAiModel: state.selectedAiModel });
      const activeModel = state.selectedAiModel || (state.aiSettings && state.aiSettings.model) || 'AI 助手';
      showToast(`已切换模型: ${activeModel}`);
    });
  }
  if (elements.aiPromptInput) {
    elements.aiPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAiMessage();
      }
    });
    elements.aiPromptInput.addEventListener('input', () => {
      elements.aiPromptInput.style.height = 'auto';
      elements.aiPromptInput.style.height = Math.min(Math.max(elements.aiPromptInput.scrollHeight, 44), 120) + 'px';
    });
  }
  if (elements.aiComposerBox) {
    elements.aiComposerBox.addEventListener('click', (e) => {
      if (e.target !== elements.aiModelSelect && !e.target.closest('#btn-ai-send') && !e.target.closest('.ai-model-borderless-wrap')) {
        if (elements.aiPromptInput) elements.aiPromptInput.focus();
      }
    });
  }

  // 7. AI 历史抽屉事件
  if (elements.btnCloseHistory) {
    elements.btnCloseHistory.addEventListener('click', closeAiHistoryDrawer);
  }
  if (elements.btnHistoryNew) {
    elements.btnHistoryNew.addEventListener('click', () => {
      startNewAiChat();
    });
  }
  if (elements.btnHistoryClear) {
    elements.btnHistoryClear.addEventListener('click', clearAllConversations);
  }

  // 8. 新增书签表单事件
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

  // 9. 设置视图事件
  if (elements.btnBackFromSettings) {
    elements.btnBackFromSettings.addEventListener('click', () => switchView('main'));
  }
  if (elements.stOpenSidepanel) {
    elements.stOpenSidepanel.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await chrome.storage.local.set({ openInSidePanel: enabled });
      showToast(enabled ? '已开启点击图标在侧边栏打开' : '已切换为点击图标默认浮窗显示');
    });
  }
  if (elements.stTranslateEnabled) {
    elements.stTranslateEnabled.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      chrome.storage.local.set({ translationEnabled: enabled });
      showToast(enabled ? '已开启网页划词翻译' : '已关闭网页划词翻译');
    });
  }
  document.querySelectorAll('.st-engine-check').forEach((chk) => {
    chk.addEventListener('change', () => {
      const checkedBoxes = Array.from(document.querySelectorAll('.st-engine-check:checked'));
      if (checkedBoxes.length === 0) {
        chk.checked = true;
        showToast('至少需保留一个翻译引擎');
        return;
      }
      const selected = checkedBoxes.map((c) => c.value);
      chrome.storage.local.set({ translationProviders: selected });
      showToast(`已选择 ${selected.length} 个翻译引擎`);
    });
  });
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
  if (elements.btnReloadExt) {
    elements.btnReloadExt.addEventListener('click', () => {
      showToast('正在重新载入扩展代码...');
      setTimeout(() => {
        try {
          chrome.runtime.reload();
        } catch (e) {
          console.error(e);
        }
        window.close();
      }, 300);
    });
  }
  if (elements.btnLogout) {
    elements.btnLogout.addEventListener('click', handleLogout);
  }

  // 10. 监听来自 Background 的通知 (例如右键菜单打开添加书签)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === 'OPEN_ADD_BOOKMARK' && msg.data) {
      switchView('add');
      openAddBookmarkView(msg.data, false);
    }
  });
}

// 页面 DOM 加载完毕后启动
document.addEventListener('DOMContentLoaded', init);
