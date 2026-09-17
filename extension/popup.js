/**
 * ZenLink Chrome 扩展 Popup 核心交互逻辑
 * 高性能秒开架构：优先加载本地离线缓存，后台静默增量同步；
 * 完整支持一级/二级分类联动层级与鼠标滚轮横向滑动。
 */

// 全局响应式状态
const state = {
  serverUrl: '',
  token: '',
  user: null,
  siteName: 'ZenLink',
  categories: [],
  bookmarks: [],
  selectedTopCatId: 'all', // 'all' 或一级分类 ID
  selectedSubCatId: 'all', // 'all' 或二级分类 ID
  searchQuery: '',
  activeTab: null,
  isSyncing: false,
};

// DOM 元素引用
const elements = {
  views: {
    login: document.getElementById('view-login'),
    main: document.getElementById('view-main'),
    add: document.getElementById('view-add'),
    settings: document.getElementById('view-settings'),
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

  // 主页面视图
  siteTitle: document.getElementById('display-site-name'),
  btnToAdd: document.getElementById('btn-to-add'),
  btnToSettings: document.getElementById('btn-to-settings'),
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
  statCount: document.getElementById('stat-count'),
  btnRefresh: document.getElementById('btn-refresh'),

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
    if (name === viewName) {
      elements.views[name].classList.remove('hidden');
    } else {
      elements.views[name].classList.add('hidden');
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

// 绑定横向鼠标滚轮滑动与拖拽支持
function enableHorizontalScroll(container) {
  if (!container) return;

  // 1. 鼠标滚轮竖向位移转换为横向滚动 (解决普通鼠标无法横向滑动问题)
  container.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // 2. 鼠标按住拖拽滚动支持
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;

  container.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDown = true;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });
  window.addEventListener('mouseup', () => { isDown = false; });
  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    container.scrollLeft = scrollLeft - walk;
  });
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

// ==================== 初始化与本地秒开架构 ====================

async function init() {
  // 1. 读取本地存储缓存，做到 0 延迟秒开呈现已有数据
  const stored = await chrome.storage.local.get([
    'serverUrl',
    'authToken',
    'authUser',
    'siteName',
    'cachedCategories',
    'cachedBookmarks',
    'selectedTopCatId',
    'selectedSubCatId',
  ]);

  state.serverUrl = stored.serverUrl || '';
  state.token = stored.authToken || '';
  state.user = stored.authUser || null;
  state.siteName = stored.siteName || 'ZenLink';
  state.categories = Array.isArray(stored.cachedCategories) ? stored.cachedCategories : [];
  state.bookmarks = Array.isArray(stored.cachedBookmarks) ? stored.cachedBookmarks : [];
  state.selectedTopCatId = stored.selectedTopCatId || 'all';
  state.selectedSubCatId = stored.selectedSubCatId || 'all';

  if (elements.siteTitle) {
    elements.siteTitle.textContent = state.siteName;
  }

  // 绑定滚动事件
  enableHorizontalScroll(elements.categoryPills);
  enableHorizontalScroll(elements.subcategoryPills);
  bindEvents();

  // 2. 检查是否有登录态
  if (state.serverUrl && state.token) {
    // 瞬间展示主界面并渲染本地缓存书签，彻底告别白屏卡顿
    switchView('main');
    renderCategoryPills();
    renderSubCategoryPills();
    renderBookmarks();

    // 3. 异步非阻塞执行：读取当前活动标签页与后台静默更新
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab) {
        state.activeTab = tab;
        updateQuickBanner(tab);
      }
    }).catch(() => {});

    // 后台非阻塞静默拉取最新数据
    silentSyncData();
  } else {
    prepareLoginView(state.serverUrl || 'http://127.0.0.1:3000');
  }
}

function updateQuickBanner(tab) {
  if (!elements.tabTitle) return;
  elements.tabTitle.textContent = tab.title || tab.url || '未知页面';
  elements.tabTitle.title = tab.title || tab.url || '';
  if (elements.tabFavicon) {
    elements.tabFavicon.src = tab.favIconUrl || 'icons/icon16.png';
    elements.tabFavicon.onerror = () => {
      elements.tabFavicon.src = 'icons/icon16.png';
    };
  }
}

function prepareLoginView(defaultUrl) {
  switchView('login');
  if (elements.serverUrlInput) elements.serverUrlInput.value = defaultUrl || '';
  if (elements.loginAlert) elements.loginAlert.classList.add('hidden');
  if (elements.totpGroup) elements.totpGroup.classList.add('hidden');
}

// 后台静默增量同步数据（不阻碍用户界面操作）
async function silentSyncData() {
  if (state.isSyncing) return;
  state.isSyncing = true;

  try {
    const [catRes, bmRes, settingsRes] = await Promise.all([
      request('/api/categories').catch(() => null),
      request('/api/bookmarks').catch(() => null),
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
    if (settingsRes && settingsRes.settings && settingsRes.settings.site_name) {
      state.siteName = settingsRes.settings.site_name;
      if (elements.siteTitle) elements.siteTitle.textContent = state.siteName;
    }

    if (hasChanges) {
      await chrome.storage.local.set({
        cachedCategories: state.categories,
        cachedBookmarks: state.bookmarks,
        siteName: state.siteName,
      });
      renderCategoryPills();
      renderSubCategoryPills();
      renderBookmarks();
    }
  } catch (err) {
    console.warn('静默同步数据失败:', err);
  } finally {
    state.isSyncing = false;
  }
}

// 手动前台刷新数据（带反馈提示）
async function loadData(showSuccessToast = false) {
  if (elements.statCount) elements.statCount.textContent = '正在同步最新数据...';

  try {
    const [catRes, bmRes] = await Promise.all([
      request('/api/categories'),
      request('/api/bookmarks'),
    ]);

    state.categories = (catRes && catRes.categories) || [];
    state.bookmarks = (bmRes && bmRes.bookmarks) || [];

    await chrome.storage.local.set({
      cachedCategories: state.categories,
      cachedBookmarks: state.bookmarks,
    });

    renderCategoryPills();
    renderSubCategoryPills();
    renderBookmarks();

    if (showSuccessToast) showToast('已成功同步最新分类与书签');
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
      await loadData();
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
  await chrome.storage.local.remove(['authToken', 'authUser', 'cachedCategories', 'cachedBookmarks']);
  prepareLoginView(state.serverUrl);
  showToast('已退出登录');
}

// ==================== 一级与二级分类层级联动 ====================

// 获取所有一级分类 (无 parent_id)
function getTopCategories() {
  return state.categories
    .filter((c) => !c.parent_id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

// 获取某个一级分类下的所有二级子分类
function getSubCategories(topCategoryId) {
  if (!topCategoryId || topCategoryId === 'all') return [];
  const topId = Number(topCategoryId);
  return state.categories
    .filter((c) => c.parent_id === topId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

// 获取一级分类及其所有子分类的 ID 集合
function getCategoryFamilyIds(topCategoryId) {
  const topId = Number(topCategoryId);
  const ids = new Set([topId]);
  state.categories.forEach((c) => {
    if (c.parent_id === topId) ids.add(c.id);
  });
  return ids;
}

// 渲染一级分类胶囊
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

  // 绑定一级分类点击切换
  elements.categoryPills.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.id;
      state.selectedTopCatId = catId === 'all' ? 'all' : Number(catId);
      // 切换一级分类时，重置二级分类为“全部”
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

// 渲染二级分类胶囊
function renderSubCategoryPills() {
  if (!elements.subcategoryContainer || !elements.subcategoryPills) return;

  // 如果处于“全部”或当前一级分类没有二级分类，隐藏二级栏
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

  // 当前大类总数
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

  // 绑定二级分类点击切换
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

// ==================== 渲染书签列表 ====================

function renderBookmarks() {
  if (!elements.bookmarkList) return;

  const query = state.searchQuery.trim().toLowerCase();

  // 根据当前一级/二级分类筛选
  let allowedCatIds = null;
  if (state.selectedTopCatId !== 'all') {
    if (state.selectedSubCatId !== 'all') {
      // 严格选中特定二级分类
      allowedCatIds = new Set([Number(state.selectedSubCatId)]);
    } else {
      // 选中特定一级分类的所有家族分类
      allowedCatIds = getCategoryFamilyIds(state.selectedTopCatId);
    }
  }

  const filtered = state.bookmarks.filter((bm) => {
    // 1. 分类匹配过滤
    if (allowedCatIds && (!bm.category_id || !allowedCatIds.has(bm.category_id))) {
      return false;
    }

    // 2. 搜索关键词匹配
    if (query) {
      const matchTitle = (bm.title || '').toLowerCase().includes(query);
      const matchDesc = (bm.description || '').toLowerCase().includes(query);
      const matchUrl = (bm.url || '').toLowerCase().includes(query);
      if (!matchTitle && !matchDesc && !matchUrl) return false;
    }

    return true;
  });

  // 更新底栏计数
  if (elements.statCount) {
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
  // 最多预先渲染 80 项，超大列表时保持丝滑响应
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

  // 绑定卡片交互
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

// ==================== 新增书签视图 ====================

function openAddBookmarkView(prefillTab = state.activeTab) {
  switchView('add');
  if (elements.addAlert) elements.addAlert.classList.add('hidden');

  // 构建支持二级分类层级缩进的下拉选项
  if (elements.bmCategory) {
    let catOptions = '<option value="">默认分类 (未归类)</option>';
    const tops = getTopCategories();

    // 默认预选中当前在主页选中的分类
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

  // 预填当前页面信息
  if (prefillTab) {
    if (elements.bmUrl) elements.bmUrl.value = prefillTab.url || '';
    if (elements.bmTitle) elements.bmTitle.value = prefillTab.title || '';
    if (elements.bmFavicon) elements.bmFavicon.value = prefillTab.favIconUrl || '';
    if (elements.bmFaviconPreview) {
      elements.bmFaviconPreview.src = prefillTab.favIconUrl || 'icons/icon16.png';
      elements.bmFaviconPreview.onerror = () => {
        elements.bmFaviconPreview.src = 'icons/icon16.png';
      };
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

// 智能识别网站元数据
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
      showToast(res.aiUsed ? '已由 AI 提炼精准标题与中文简介' : '已成功抓取网站元信息');
    }
  } catch (err) {
    showAddAlert(`自动提取提示: ${err.message || '抓取失败，请手动输入'}`, 'error');
  } finally {
    setButtonLoading(btn, false, 'AI / 自动识别');
  }
}

// 提交新增书签
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
      // 本地乐观更新，无需全量重载
      state.bookmarks.unshift(res.bookmark);
      await chrome.storage.local.set({ cachedBookmarks: state.bookmarks });
      renderCategoryPills();
      renderSubCategoryPills();
      renderBookmarks();
      switchView('main');
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

// ==================== 事件监听绑定 ====================

function bindEvents() {
  // 登录表单
  if (elements.loginForm) {
    elements.loginForm.addEventListener('submit', handleLogin);
  }

  // 顶栏操作
  if (elements.btnToAdd) {
    elements.btnToAdd.addEventListener('click', () => openAddBookmarkView(state.activeTab));
  }
  if (elements.btnQuickCollect) {
    elements.btnQuickCollect.addEventListener('click', () => openAddBookmarkView(state.activeTab));
  }
  if (elements.btnToSettings) {
    elements.btnToSettings.addEventListener('click', openSettingsView);
  }
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

  // 搜索输入过滤
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

  // 新增书签事件
  if (elements.btnBackFromAdd) {
    elements.btnBackFromAdd.addEventListener('click', () => switchView('main'));
  }
  if (elements.btnCancelAdd) {
    elements.btnCancelAdd.addEventListener('click', () => switchView('main'));
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

  // 设置视图事件
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

// 页面 DOM 加载完毕后启动
document.addEventListener('DOMContentLoaded', init);
