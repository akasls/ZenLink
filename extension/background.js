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

// ==================== 网页划词翻译后台代理 ====================
// 在 Service Worker 中统一发起请求，规避目标网页严格的 CSP 与跨域限制

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'TRANSLATE_TEXT') {
    handleTranslate(request)
      .then((res) => sendResponse(res))
      .catch((err) => {
        sendResponse({ success: false, error: err.message || '翻译失败，请稍后重试' });
      });
    return true; // 保持异步响应管道开放
  }
});

async function handleTranslate(request) {
  const { text, targetLang } = request;
  if (!text || !text.trim()) {
    throw new Error('待翻译内容为空');
  }

  const cleanText = text.trim();
  const hasChinese = /[\u4e00-\u9fa5]/.test(cleanText);
  const toLang = targetLang || (hasChinese ? 'en' : 'zh-CN');

  // 若未指定 provider，优先从本地持久化设置中获取
  let provider = request.provider;
  if (!provider) {
    const stored = await chrome.storage.local.get(['translationProvider']);
    provider = stored.translationProvider || 'google';
  }

  let result;
  switch (provider) {
    case 'microsoft':
      result = await translateWithMicrosoft(cleanText, toLang);
      break;
    case 'baidu':
      result = await translateWithBaidu(cleanText, toLang);
      break;
    case 'ai':
      result = await translateWithAi(cleanText, toLang);
      break;
    case 'google':
    default:
      result = await translateWithGoogle(cleanText, toLang);
      break;
  }

  return {
    success: true,
    ...result,
    originalText: cleanText,
    targetLang: toLang,
  };
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
  const stored = await chrome.storage.local.get(['serverUrl', 'authToken', 'selectedAiModel']);
  const serverUrl = stored.serverUrl;
  const token = stored.authToken;

  if (!serverUrl || !token) {
    throw new Error('使用 AI 翻译前，请先点击插件图标连接并登录您的 ZenLink 账号');
  }

  const prompt = `你是一位专业精炼的翻译大师。请将以下文本精准、地道、自然地翻译为${targetLang === 'zh-CN' ? '简体中文' : '英文'}。
请直接输出翻译结果本身，不要附带任何前言、总结、拼音或解释：

${text.slice(0, 3000)}`;

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
      model: stored.selectedAiModel || undefined,
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
