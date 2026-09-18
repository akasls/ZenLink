/**
 * ZenLink Chrome 扩展后台 Service Worker
 * 负责右键上下文菜单快速收藏、快捷键处理及后台通知
 */

// 动态同步侧边栏与弹窗行为：根据用户设置决定点击图标是在侧边栏展开还是展示默认浮窗
async function syncSidePanelBehavior(openInSidePanel) {
  if (typeof chrome === 'undefined') return;
  try {
    if (openInSidePanel) {
      if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
          console.warn('配置 sidePanel openPanelOnActionClick: true 失败:', err);
        });
      }
      if (chrome.action && chrome.action.setPopup) {
        await chrome.action.setPopup({ popup: '' }).catch(() => {});
      }
    } else {
      if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((err) => {
          console.warn('配置 sidePanel openPanelOnActionClick: false 失败:', err);
        });
      }
      if (chrome.action && chrome.action.setPopup) {
        await chrome.action.setPopup({ popup: 'popup.html' }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('同步侧边栏行为异常:', err);
  }
}

// 初始化时按本地存储的偏好配置侧边栏 / 默认浮窗（默认开启侧边栏模式）
async function initSidePanelPreference() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
  try {
    const data = await chrome.storage.local.get(['openInSidePanel']);
    const openInSidePanel = data.openInSidePanel !== false;
    await syncSidePanelBehavior(openInSidePanel);
  } catch (e) {
    console.warn('读取侧边栏偏好失败:', e);
  }
}
initSidePanelPreference();

// 监听存储中的 openInSidePanel 配置变更，实时生效无需重启插件
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.openInSidePanel !== undefined) {
      const openInSidePanel = changes.openInSidePanel.newValue !== false;
      syncSidePanelBehavior(openInSidePanel);
    }
  });
}

// 注册右键上下文菜单
function setupContextMenus() {
  if (typeof chrome === 'undefined' || !chrome.contextMenus) return;
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'zenlink_add_page',
        title: '添加当前网页到书签',
        contexts: ['page'],
      }, () => {
        if (chrome.runtime.lastError) {}
      });

      chrome.contextMenus.create({
        id: 'zenlink_add_link',
        title: '添加链接到书签',
        contexts: ['link'],
      }, () => {
        if (chrome.runtime.lastError) {}
      });
    });
  } catch (e) {
    console.error('注册右键菜单失败', e);
  }
}

// 重新加载或安装时，为当前所有打开的网页动态注入 content.js，实现免 F5 刷新即刻生效
async function injectContentScriptToAllTabs() {
  if (typeof chrome === 'undefined' || !chrome.scripting || !chrome.tabs) return;
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        }).catch(() => {});
      }
    }
  } catch (e) {}
}

// 扩展安装或更新时注册
chrome.runtime.onInstalled.addListener(() => {
  initSidePanelPreference();
  setupContextMenus();
  injectContentScriptToAllTabs();
});

// Service Worker 启动阶段即刻执行，确保右键菜单立即更新生效
setupContextMenus();

// 点击扩展图标的兼容降级处理（针对不支持 openPanelOnActionClick 的环境或 popup 动态切换）
if (typeof chrome !== 'undefined' && chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    // 优先读取用户偏好：若设置为不使用侧边栏，则确保恢复 popup 并退出
    try {
      const data = await chrome.storage.local.get(['openInSidePanel']);
      if (data.openInSidePanel === false) {
        if (chrome.action && chrome.action.setPopup) {
          await chrome.action.setPopup({ popup: 'popup.html' }).catch(() => {});
        }
        return;
      }
    } catch (e) {}

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
        url: chrome.runtime.getURL('sidepanel.html?mode=sidepanel'),
        type: 'popup',
        width: 440,
        height: 1000,
        top: 0,
        left: 1400,
        focused: true,
      });
    } catch (err) {
      chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html?mode=sidepanel') });
    }
  });
}

// 处理右键菜单点击：弹出添加书签编辑表单，支持修改标题、描述、分类等
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
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

  const pendingData = {
    url: targetUrl,
    title: targetTitle,
    favicon: targetFavicon,
    description: '',
    timestamp: Date.now(),
  };

  // 持久化待添加书签数据，供弹窗读取并自动填充到添加表单
  await chrome.storage.local.set({ pendingAddBookmark: pendingData });

  // 1. 优先直接向当前网页注入并唤起页面内悬浮添加书签卡片 (无需新开标签或窗口)
  if (tab && tab.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'SHOW_INPAGE_ADD_BOOKMARK',
        data: pendingData,
      });
      return;
    } catch (err) {
      // 若当前标签页尚未加载 content.js，先动态注入脚本再发送消息
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
        await chrome.tabs.sendMessage(tab.id, {
          action: 'SHOW_INPAGE_ADD_BOOKMARK',
          data: pendingData,
        });
        return;
      } catch (injectErr) {
        console.warn('当前页面不支持注入悬浮组件 (如 Chrome 内部特权页面)，降级尝试侧边栏:', injectErr);
      }
    }
  }

  // 2. 兜底方案：如果是 chrome:// 等特权系统页面无法注入 content.js，尝试唤起侧边栏
  if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
    try {
      if (tab && tab.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
        chrome.runtime.sendMessage({ action: 'OPEN_ADD_BOOKMARK', data: pendingData }).catch(() => {});
        return;
      } else if (tab && tab.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        chrome.runtime.sendMessage({ action: 'OPEN_ADD_BOOKMARK', data: pendingData }).catch(() => {});
        return;
      }
    } catch (e) {}
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

// 统一后台代理消息监听 (规避网页跨域与 CSP 限制)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'TRANSLATE_TEXT') {
    handleTranslate(request)
      .then((res) => sendResponse(res))
      .catch((err) => {
        sendResponse({ success: false, error: err.message || '翻译失败，请稍后重试' });
      });
    return true; // 保持异步响应管道开放
  }

  if (request && request.action === 'API_ADD_BOOKMARK') {
    handleApiAddBookmark(request.payload)
      .then((res) => sendResponse(res))
      .catch((err) => {
        sendResponse({ success: false, error: err.message || '保存书签失败' });
      });
    return true; // 保持异步响应管道开放
  }
});

// 在 Background 后台代理向服务端添加书签 (免疫任意网页 CSP 与 CORS 限制)
async function handleApiAddBookmark(payload) {
  if (!payload || !payload.url || !payload.title) {
    return { success: false, error: '网址和标题为必填项' };
  }

  const stored = await chrome.storage.local.get(['serverUrl', 'authToken', 'cachedBookmarks']);
  const serverUrl = stored.serverUrl;
  const token = stored.authToken;
  if (!serverUrl || !token) {
    return { success: false, error: '请先打开 ZenLink 插件登录并连接您的自建服务' };
  }

  const cleanUrl = serverUrl.replace(/\/+$/, '');
  const endpoint = `${cleanUrl}/api/bookmarks`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: payload.title,
        url: payload.url,
        description: payload.description || '',
        favicon: payload.favicon || '',
        categoryId: payload.categoryId ? Number(payload.categoryId) : null,
        isPrivate: !!payload.isPrivate,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.message || data.error || `请求失败 (HTTP ${res.status})` };
    }

    if (data && data.bookmark) {
      const bookmarks = Array.isArray(stored.cachedBookmarks) ? stored.cachedBookmarks : [];
      bookmarks.unshift(data.bookmark);
      await chrome.storage.local.set({ cachedBookmarks: bookmarks });
    }

    return { success: true, bookmark: data.bookmark };
  } catch (err) {
    return { success: false, error: err.message || '网络连接异常，无法连接到服务端' };
  }
}

async function handleTranslate(request) {
  const { text, targetLang } = request;
  if (!text || !text.trim()) {
    throw new Error('待翻译内容为空');
  }

  const cleanText = text.trim();
  const hasChinese = /[\u4e00-\u9fa5]/.test(cleanText);
  const toLang = targetLang || (hasChinese ? 'en' : 'zh-CN');

  // 支持单个或多个翻译引擎
  let providers = request.providers;
  if (!providers || !Array.isArray(providers) || providers.length === 0) {
    if (request.provider) {
      providers = [request.provider];
    } else {
      const stored = await chrome.storage.local.get(['translationProviders', 'translationProvider']);
      providers = stored.translationProviders || (stored.translationProvider ? [stored.translationProvider] : ['google']);
    }
  }

  // 确保至少有一个引擎
  if (!Array.isArray(providers) || providers.length === 0) {
    providers = ['google'];
  }

  // 并行调用所选引擎
  const tasks = providers.map(async (p) => {
    try {
      let res;
      switch (p) {
        case 'microsoft':
          res = await translateWithMicrosoft(cleanText, toLang);
          break;
        case 'baidu':
          res = await translateWithBaidu(cleanText, toLang);
          break;
        case 'ai':
          res = await translateWithAi(cleanText, toLang);
          break;
        case 'google':
        default:
          res = await translateWithGoogle(cleanText, toLang);
          break;
      }
      return {
        provider: p,
        name: getProviderLabel(p),
        success: true,
        translation: res.translation,
        detectedLang: res.detectedLang,
        fallbackFrom: res.fallbackFrom,
      };
    } catch (err) {
      return {
        provider: p,
        name: getProviderLabel(p),
        success: false,
        error: err.message || '翻译接口异常',
      };
    }
  });

  const results = await Promise.all(tasks);

  return {
    success: true,
    results,
    // 兼容单结果直接取用
    translation: results.find((r) => r.success)?.translation || '',
    originalText: cleanText,
    targetLang: toLang,
  };
}

function getProviderLabel(provider) {
  switch (provider) {
    case 'google': return '谷歌 (Google)';
    case 'microsoft': return '微软 (Microsoft)';
    case 'baidu': return '百度 (Baidu)';
    case 'ai': return 'AI 智能';
    default: return provider;
  }
}

/**
 * 谷歌翻译引擎 (Google Translate GTX)
 */
async function translateWithGoogle(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`谷歌翻译请求失败 (${res.status})`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data[0])) {
    throw new Error('解析谷歌翻译数据失败');
  }

  const translation = data[0].map((item) => (item && item[0]) || '').join('');
  const detectedLang = data[2] || '';

  return {
    translation,
    detectedLang,
    provider: 'google',
  };
}

/**
 * 微软 Edge 翻译引擎 (带自动降级至谷歌)
 */
async function translateWithMicrosoft(text, targetLang) {
  try {
    const edgeLang = targetLang === 'zh-CN' ? 'zh-Hans' : targetLang;
    const url = `https://api-edge.cognitive.microsofttranslator.com/translate?from=&to=${encodeURIComponent(edgeLang)}&api-version=3.0`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ Text: text }]),
    });

    if (!res.ok) {
      throw new Error(`微软服务响应: ${res.status}`);
    }
    const data = await res.json();
    if (data && data[0] && data[0].translations && data[0].translations[0]) {
      return {
        translation: data[0].translations[0].text,
        detectedLang: data[0].detectedLanguage ? data[0].detectedLanguage.language : '',
        provider: 'microsoft',
      };
    }
    throw new Error('未能解析到有效微软翻译译文');
  } catch (err) {
    console.warn('微软翻译失败，降级调用谷歌翻译:', err.message);
    const fallback = await translateWithGoogle(text, targetLang);
    return { ...fallback, fallbackFrom: 'microsoft' };
  }
}

/**
 * 百度翻译引擎 (带自动降级至谷歌)
 */
async function translateWithBaidu(text, targetLang) {
  try {
    const baiduLang = targetLang === 'zh-CN' ? 'zh' : targetLang;
    const url = `https://fanyi.baidu.com/transapi?from=auto&to=${encodeURIComponent(baiduLang)}&query=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`百度服务响应: ${res.status}`);
    }
    const data = await res.json();
    if (data && data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].dst) {
      const translation = data.data.map((d) => d.dst).join('\n');
      return {
        translation,
        detectedLang: data.from || '',
        provider: 'baidu',
      };
    }
    throw new Error((data && data.error) || '未获取到百度翻译内容');
  } catch (err) {
    console.warn('百度翻译失败，降级调用谷歌翻译:', err.message);
    const fallback = await translateWithGoogle(text, targetLang);
    return { ...fallback, fallbackFrom: 'baidu' };
  }
}

/**
 * ZenLink 后端 AI 智能翻译引擎 (基于已登录的 ZenLink 后台大模型)
 */
async function translateWithAi(text, targetLang) {
  const stored = await chrome.storage.local.get(['serverUrl', 'authToken', 'selectedAiModel', 'extensionAiModel']);
  const serverUrl = stored.serverUrl;
  const token = stored.authToken;

  if (!serverUrl || !token) {
    throw new Error('使用 AI 翻译前，请先点击插件图标连接并登录您的 ZenLink 账号');
  }

  const prompt = `你是一位专业精炼的翻译大师。请将以下文本精准、地道、自然地翻译为${targetLang === 'zh-CN' ? '简体中文' : '英文'}。
请直接输出翻译结果本身，不要附带任何前言、总结、拼音或解释：

${text.slice(0, 3000)}`;

  // 优先采用插件专属模型，若未设置由后端自动跟随全局默认模型
  const targetModel = stored.extensionAiModel || stored.selectedAiModel || undefined;

  const res = await fetch(`${serverUrl}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: prompt,
      stream: true,
      is_private: true,
      scene: 'extension',
      model: targetModel,
    }),
  });

  if (!res.ok) {
    throw new Error(`ZenLink AI 接口响应错误 (${res.status})`);
  }

  const reader = res.body.getReader();
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

  const translation = fullOutput.trim();
  if (!translation) {
    throw new Error('AI 未能生成有效的翻译译文');
  }

  return {
    translation,
    detectedLang: targetLang === 'zh-CN' ? 'en' : 'zh-CN',
    provider: 'ai',
  };
}
