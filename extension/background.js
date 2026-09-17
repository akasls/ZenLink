/**
 * ZenLink Chrome 扩展后台 Service Worker
 * 负责右键上下文菜单快速收藏、快捷键处理及后台通知
 */

// 启用点击工具栏图标直接展开侧边栏（与网页同高，展示更多内容）
function enableSidePanelOnAction() {
  if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('配置 sidePanel 点击行为:', err);
    });
  }
}
enableSidePanelOnAction();

// 扩展安装或更新时注册右键菜单与侧边栏配置
chrome.runtime.onInstalled.addListener(() => {
  enableSidePanelOnAction();
  try {
    chrome.contextMenus.removeAll(() => {
      // 1. 针对当前页面的右键菜单
      chrome.contextMenus.create({
        id: 'zenlink_add_page',
        title: '添加当前网页至 ZenLink',
        contexts: ['page'],
      });

      // 2. 针对超链接的右键菜单
      chrome.contextMenus.create({
        id: 'zenlink_add_link',
        title: '添加链接至 ZenLink',
        contexts: ['link'],
      });
    });
  } catch (e) {
    console.error('注册右键菜单失败', e);
  }
});

// 点击扩展图标的兼容降级处理（针对不支持 openPanelOnActionClick 的环境）
if (typeof chrome !== 'undefined' && chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
      try {
        if (tab && tab.id) {
          await chrome.sidePanel.open({ tabId: tab.id });
          return;
        } else if (tab && tab.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
          return;
        }
      } catch (e) {}
    }

    // 兜底方案：在屏幕右侧开启全高贴边工作台 (与网页高度一致)
    try {
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html?mode=sidepanel'),
        type: 'popup',
        width: 440,
        height: 1000,
        top: 0,
        left: 1400,
        focused: true,
      });
    } catch (err) {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?mode=sidepanel') });
    }
  });
}

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const stored = await chrome.storage.local.get(['serverUrl', 'authToken']);
  const serverUrl = stored.serverUrl;
  const token = stored.authToken;

  if (!serverUrl || !token) {
    notify('ZenLink 未登录', '请先点击浏览器右上角扩展图标登录您的 ZenLink 账号');
    return;
  }

  let targetUrl = '';
  let targetTitle = '';
  let targetFavicon = '';

  if (info.menuItemId === 'zenlink_add_page') {
    targetUrl = info.pageUrl || (tab && tab.url) || '';
    targetTitle = (tab && tab.title) || targetUrl;
    targetFavicon = (tab && tab.favIconUrl) || '';
  } else if (info.menuItemId === 'zenlink_add_link') {
    targetUrl = info.linkUrl || '';
    targetTitle = info.selectionText || targetUrl;
  }

  if (!targetUrl) {
    notify('添加失败', '未能获取到有效的网页或链接地址');
    return;
  }

  try {
    const res = await fetch(`${serverUrl}/api/bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: targetUrl,
        title: targetTitle,
        favicon: targetFavicon,
        description: '',
        isPrivate: false,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error((data && data.error) || `HTTP ${res.status}`);
    }

    notify('已保存至 ZenLink', `「${targetTitle.slice(0, 30)}」已成功添加至导航`);
  } catch (err) {
    notify('保存书签失败', err.message || '网络请求错误');
  }
});

// 桌面通知封装
function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title || 'ZenLink',
      message: message || '',
      priority: 1,
    });
  } catch (e) {
    console.log(`[Notification] ${title}: ${message}`);
  }
}
