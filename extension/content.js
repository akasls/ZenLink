/**
 * ZenLink 网页内容提取 Content Script
 * 负责在目标网页上下文中高保真提取正文、选中文本与排版结构
 */

(function () {
  function extractPageContent() {
    // 1. 优先提取用户鼠标划选的高亮文本
    const selection = window.getSelection ? window.getSelection().toString().trim() : '';
    if (selection && selection.length > 5) {
      return {
        type: 'selection',
        content: selection,
        title: document.title || '',
        url: window.location.href,
      };
    }

    // 2. 论坛、博客、新闻等主流文章正文容器匹配
    const contentSelectors = [
      '.post-content',      // NodeSeek、Discuz、V2EX、Typecho 等论坛与博客
      '.post-message',      // 经典论坛楼主正文
      '.topic-content',     // V2EX、Ruby-China 等
      'article',            // 标准 HTML5 文章
      '.article-content',
      '.entry-content',
      '#article-content',
      '.markdown-body',     // GitHub、掘金等
      '.rich_media_content',// 微信公众号
      '.content-body',
      '.news-content',
      'main',
      '#content',
      '.content'
    ];

    let targetElement = null;
    for (const selector of contentSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = (el.innerText || el.textContent || '').trim();
        // 只要含有有意义的文本内容（> 10 字符），即可作为目标正文容器
        if (text.length > 10) {
          targetElement = el;
          break;
        }
      }
    }

    if (!targetElement) {
      targetElement = document.body;
    }

    // 3. 将元素内容转换为结构化的 Markdown / 纯文本
    const textContent = convertElementToMarkdown(targetElement);

    return {
      type: 'article',
      content: textContent,
      title: document.title || '',
      url: window.location.href,
    };
  }

  function convertElementToMarkdown(container) {
    if (!container) return '';

    // 克隆节点避免破坏原网页 DOM
    const clone = container.cloneNode(true);

    // 剔除杂质元素（广告、脚本、样式、导航、评论区等）
    const junkSelectors = [
      'script', 'style', 'noscript', 'nav', 'header', 'footer', 
      'iframe', 'aside', '.sidebar', '.ad', '.advertisement',
      '.pagination', '.pager', '.share-box', '.reward'
    ];
    if (clone === document.body) {
      junkSelectors.push('.comment', '.comments', '#comments');
    }

    junkSelectors.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    });

    // 遍历有意义的块级节点
    const blocks = clone.querySelectorAll('h1, h2, h3, h4, h5, h6, p, pre, blockquote, ul, ol, div');
    const lines = [];

    if (blocks.length > 0) {
      blocks.forEach((el) => {
        // 只提取叶子块或直接含有文本的块，避免父子 div 重复
        const hasBlockChildren = el.querySelector('h1, h2, h3, h4, h5, h6, p, pre, blockquote, ul, ol');
        if (hasBlockChildren) return;

        const text = (el.innerText || el.textContent || '').trim();
        if (!text) return;

        const tag = el.tagName.toLowerCase();
        if (tag === 'h1') lines.push(`\n# ${text}\n`);
        else if (tag === 'h2') lines.push(`\n## ${text}\n`);
        else if (tag === 'h3') lines.push(`\n### ${text}\n`);
        else if (tag === 'pre') lines.push(`\n\`\`\`\n${text}\n\`\`\`\n`);
        else if (tag === 'blockquote') lines.push(`\n> ${text}\n`);
        else lines.push(`${text}\n`);
      });
    }

    if (lines.length >= 1) {
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    // 兜底返回 innerText
    return (clone.innerText || clone.textContent || '').trim();
  }

  // 监听来自扩展 Popup / SidePanel 的剪藏请求消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.action === 'CLIP_PAGE_CONTENT') {
      try {
        const data = extractPageContent();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    }
    return true;
  });

  // ==================== 网页划词翻译浮层交互 ====================
  initFloatingTranslation();

  function initFloatingTranslation() {
    if (document.getElementById('zenlink-translate-root')) return;

    // 创建宿主节点并挂载 Shadow DOM，隔绝宿主网页所有 CSS 样式干扰
    const host = document.createElement('div');
    host.id = 'zenlink-translate-root';
    host.style.cssText = 'all: initial !important; display: block !important; position: static !important;';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .zenlink-font {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1e293b;
        font-size: 13px;
        line-height: 1.5;
        letter-spacing: -0.01em;
      }
      @media (prefers-color-scheme: dark) {
        .zenlink-font {
          color: #f1f5f9;
        }
      }

      /* 悬浮小图标徽标 (使用 fixed 视口绝对像素，无惧网页缩放、局部滚动或定位干扰) */
      #zenlink-float-btn {
        position: fixed !important;
        display: none;
        align-items: center !important;
        justify-content: center !important;
        z-index: 2147483647 !important;
        width: 28px !important;
        height: 28px !important;
        border-radius: 50% !important;
        background: #f1404b !important;
        color: #ffffff !important;
        border: 2px solid #ffffff !important;
        box-shadow: 0 4px 14px rgba(241, 64, 75, 0.45), 0 2px 6px rgba(0, 0, 0, 0.2) !important;
        cursor: pointer !important;
        outline: none !important;
        transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.16s ease !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      #zenlink-float-btn:hover {
        transform: scale(1.18) !important;
        box-shadow: 0 6px 20px rgba(241, 64, 75, 0.6), 0 3px 8px rgba(0, 0, 0, 0.25) !important;
      }
      #zenlink-float-btn svg {
        width: 15px !important;
        height: 15px !important;
        fill: #ffffff !important;
        display: block !important;
        margin: auto !important;
      }

      /* 悬浮翻译面板卡片 */
      #zenlink-card {
        position: fixed !important;
        display: none;
        flex-direction: column;
        z-index: 2147483647 !important;
        width: 360px;
        max-width: calc(100vw - 24px);
        max-height: min(520px, calc(100vh - 40px));
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.22), 0 6px 14px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        animation: zenlinkFadeIn 0.16s ease-out;
      }
      @media (prefers-color-scheme: dark) {
        #zenlink-card {
          background: #181c24;
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 16px 40px -4px rgba(0, 0, 0, 0.6), 0 6px 16px rgba(0, 0, 0, 0.35);
          color: #f1f5f9;
        }
      }

      @keyframes zenlinkFadeIn {
        from { opacity: 0; transform: translateY(6px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* 顶栏 */
      .zenlink-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      @media (prefers-color-scheme: dark) {
        .zenlink-header {
          background: #202632;
          border-color: #2d3748;
        }
      }
      .zenlink-brand {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 600;
        color: #f1404b;
      }
      .zenlink-brand svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }

      .zenlink-close-btn {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        line-height: 1;
        transition: all 0.15s;
      }
      .zenlink-close-btn:hover {
        color: #f1404b;
        background: rgba(241, 64, 75, 0.1);
      }

      /* 正文区 (支持多个引擎结果对比滚动展示) */
      .zenlink-body {
        padding: 10px 12px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 380px;
      }
      .zenlink-source-box {
        padding: 6px 8px;
        border-radius: 6px;
        background: #f1f5f9;
        font-size: 11px;
        color: #64748b;
        line-height: 1.4;
        word-break: break-word;
        max-height: 60px;
        overflow-y: auto;
      }
      @media (prefers-color-scheme: dark) {
        .zenlink-source-box {
          background: #1e293b;
          color: #94a3b8;
        }
      }

      /* 单个翻译引擎结果卡片 */
      .zenlink-engine-card {
        border-radius: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      @media (prefers-color-scheme: dark) {
        .zenlink-engine-card {
          background: #1e2430;
          border-color: #2e3848;
        }
      }
      .zenlink-engine-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        font-weight: 600;
        margin-bottom: 2px;
      }
      .zenlink-engine-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: #f1404b;
      }
      .zenlink-engine-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #f1404b;
      }
      .zenlink-subcopy-btn {
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 10px;
        color: #94a3b8;
        padding: 2px 5px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        transition: all 0.15s;
      }
      .zenlink-subcopy-btn:hover {
        color: #f1404b;
        background: rgba(241, 64, 75, 0.1);
      }
      .zenlink-subcopy-btn svg {
        width: 10px;
        height: 10px;
        fill: currentColor;
      }

      .zenlink-engine-content {
        font-size: 13px;
        line-height: 1.55;
        color: #1e293b;
        word-break: break-word;
        user-select: text;
        white-space: pre-wrap;
      }
      @media (prefers-color-scheme: dark) {
        .zenlink-engine-content {
          color: #e2e8f0;
        }
      }

      .zenlink-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #64748b;
        font-size: 12px;
        padding: 6px 0;
      }
      .zenlink-spinner {
        width: 13px;
        height: 13px;
        border: 2px solid #e2e8f0;
        border-top-color: #f1404b;
        border-radius: 50%;
        animation: zenlinkSpin 0.7s linear infinite;
      }
      @keyframes zenlinkSpin {
        to { transform: rotate(360deg); }
      }

      .zenlink-error {
        color: #ef4444;
        font-size: 12px;
        line-height: 1.4;
        padding: 8px 0;
      }
      .zenlink-retry-btn {
        margin-top: 4px;
        display: inline-block;
        padding: 3px 8px;
        font-size: 11px;
        border-radius: 4px;
        border: 1px solid #ef4444;
        background: transparent;
        color: #ef4444;
        cursor: pointer;
      }

      /* 底栏 */
      .zenlink-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
      }
      @media (prefers-color-scheme: dark) {
        .zenlink-footer {
          background: #202632;
          border-color: #2d3748;
        }
      }
      .zenlink-target-badge {
        font-size: 10px;
        font-weight: 500;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(241, 64, 75, 0.1);
        color: #f1404b;
      }
      .zenlink-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #475569;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      .zenlink-action-btn:hover {
        border-color: #f1404b;
        color: #f1404b;
      }
      .zenlink-action-btn svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
      }
      @media (prefers-color-scheme: dark) {
        .zenlink-action-btn {
          background: #1e293b;
          border-color: #334155;
          color: #cbd5e1;
        }
      }
    `;

    // 悬浮按钮
    const floatBtn = document.createElement('button');
    floatBtn.id = 'zenlink-float-btn';
    floatBtn.title = 'ZenLink 划词翻译';
    floatBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12.87 15.07l-2.54-2.51.03-.08c1.74-1.94 2.98-4.17 3.71-6.49H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
    `;

    // 悬浮翻译卡片
    const card = document.createElement('div');
    card.id = 'zenlink-card';
    card.className = 'zenlink-font';
    card.innerHTML = `
      <div class="zenlink-header">
        <div class="zenlink-brand">
          <svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.08c1.74-1.94 2.98-4.17 3.71-6.49H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
          <span>ZenLink 划词翻译</span>
        </div>
        <button id="zenlink-close-btn" class="zenlink-close-btn" title="关闭 (Esc)">&times;</button>
      </div>
      <div class="zenlink-body">
        <div id="zenlink-source-preview" class="zenlink-source-box"></div>
        <div id="zenlink-results-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
      </div>
      <div class="zenlink-footer">
        <span id="zenlink-lang-badge" class="zenlink-target-badge">目标语言</span>
        <button id="zenlink-copy-all-btn" class="zenlink-action-btn" title="复制全部翻译结果">
          <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          <span id="zenlink-copy-all-text">复制全部</span>
        </button>
      </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(floatBtn);
    shadow.appendChild(card);
    (document.body || document.documentElement).appendChild(host);

    // 内部 DOM 引用
    const closeBtn = shadow.getElementById('zenlink-close-btn');
    const sourcePreview = shadow.getElementById('zenlink-source-preview');
    const resultsList = shadow.getElementById('zenlink-results-list');
    const langBadge = shadow.getElementById('zenlink-lang-badge');
    const copyAllBtn = shadow.getElementById('zenlink-copy-all-btn');
    const copyAllText = shadow.getElementById('zenlink-copy-all-text');

    let currentSelectedText = '';
    let lastSelectionRect = null;
    let lastResults = [];

    // 本地内存持久化缓存配置，确保划词响应 0 延迟
    let isEnabled = true;
    let activeProviders = ['google'];

    try {
      chrome.storage.local.get(['translationEnabled', 'translationProviders', 'translationProvider'], (stored) => {
        if (chrome.runtime.lastError || !stored) return;
        if (stored.translationEnabled !== undefined) isEnabled = stored.translationEnabled !== false;
        if (Array.isArray(stored.translationProviders) && stored.translationProviders.length > 0) {
          activeProviders = stored.translationProviders;
        } else if (stored.translationProvider) {
          activeProviders = [stored.translationProvider];
        }
      });
    } catch (e) {
      isEnabled = true;
    }

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          if (changes.translationEnabled !== undefined) {
            isEnabled = changes.translationEnabled.newValue !== false;
            if (!isEnabled) {
              floatBtn.style.display = 'none';
              card.style.display = 'none';
            }
          }
          if (changes.translationProviders) {
            activeProviders = changes.translationProviders.newValue || ['google'];
          } else if (changes.translationProvider) {
            activeProviders = [changes.translationProvider.newValue || 'google'];
          }
        }
      });
    } catch (e) {}

    // 提取当前划选文本及准确的视口矩形
    function getSelectedTextAndRect() {
      // 1. 尝试从活动输入框中获取
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        if (typeof start === 'number' && typeof end === 'number' && end > start) {
          const text = activeEl.value.substring(start, end).trim();
          if (text) {
            const rect = activeEl.getBoundingClientRect();
            return { text, rect };
          }
        }
      }

      // 2. 网页常规 DOM 文本划选
      const selection = window.getSelection ? window.getSelection() : null;
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

      const text = selection.toString().trim();
      if (!text) return null;

      const range = selection.getRangeAt(0);
      let rect = range.getBoundingClientRect();

      // 若 getBoundingClientRect 为空，降级提取切片矩形
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        const rects = range.getClientRects();
        if (rects && rects.length > 0) {
          rect = rects[rects.length - 1]; // 优先取末尾矩形
        }
      }

      if (!rect || (rect.width === 0 && rect.height === 0)) return null;

      return { text, rect };
    }

    // 检查并展示选中文本后的悬浮微标
    function handleSelectionCheck() {
      if (!isEnabled) {
        floatBtn.style.display = 'none';
        return;
      }

      const res = getSelectedTextAndRect();
      if (!res || !res.text || res.text.length > 3500) {
        floatBtn.style.display = 'none';
        return;
      }

      currentSelectedText = res.text;
      lastSelectionRect = res.rect;

      // 使用 position: fixed 视口像素坐标，无惧页面滚动与嵌套
      let btnX = res.rect.right + 6;
      let btnY = res.rect.bottom + 6;

      const winW = window.innerWidth;
      const winH = window.innerHeight;

      // 屏幕边缘防护
      if (btnX + 34 > winW) btnX = winW - 38;
      if (btnY + 34 > winH) btnY = Math.max(6, res.rect.top - 36);

      floatBtn.style.left = `${Math.max(6, Math.round(btnX))}px`;
      floatBtn.style.top = `${Math.max(6, Math.round(btnY))}px`;
      floatBtn.style.display = 'flex';
    }

    // 在捕获阶段 (Capture: true) 监听，免疫任何网页框架 stopPropagation 阻断
    window.addEventListener('mouseup', (e) => {
      if (e.composedPath && e.composedPath().includes(host)) return;
      setTimeout(handleSelectionCheck, 20);
    }, true);

    window.addEventListener('keyup', (e) => {
      if (e.composedPath && e.composedPath().includes(host)) return;
      if (e.key === 'Shift' || (e.key && e.key.startsWith('Arrow'))) {
        setTimeout(handleSelectionCheck, 20);
      }
    }, true);

    // 网页点击收起浮层 (必须在捕获阶段监听)
    window.addEventListener('mousedown', (e) => {
      if (e.composedPath && e.composedPath().includes(host)) return;
      floatBtn.style.display = 'none';
      card.style.display = 'none';
    }, true);

    // 防止点击自身图标时触发全局 mousedown 清除选区
    floatBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    card.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    // 点击浮动小图标触发翻译卡片
    floatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      floatBtn.style.display = 'none';

      if (!currentSelectedText || !lastSelectionRect) return;

      const cardWidth = 360;
      let cardX = lastSelectionRect.left;
      let cardY = lastSelectionRect.bottom + 8;

      const winW = window.innerWidth;
      const winH = window.innerHeight;

      if (cardX + cardWidth > winW - 12) cardX = winW - cardWidth - 12;
      if (cardX < 12) cardX = 12;

      // 若接近视口底部且上方空间充裕，翻转至选区上方
      if (lastSelectionRect.bottom + 280 > winH && lastSelectionRect.top > 240) {
        cardY = Math.max(12, lastSelectionRect.top - 260);
      } else if (cardY + 280 > winH) {
        cardY = Math.max(12, winH - 290);
      }

      card.style.left = `${Math.round(cardX)}px`;
      card.style.top = `${Math.round(cardY)}px`;
      card.style.display = 'flex';

      // 填充原文预览
      sourcePreview.textContent = currentSelectedText;

      executeTranslation(currentSelectedText, activeProviders);
    });

    // 执行多引擎翻译请求
    function executeTranslation(text, providers) {
      const currentProviders = Array.isArray(providers) && providers.length > 0 ? providers : ['google'];

      // 初始化各引擎加载状态骨架卡片
      let listHtml = '';
      currentProviders.forEach((p) => {
        listHtml += `
          <div class="zenlink-engine-card" id="zenlink-card-${p}">
            <div class="zenlink-engine-header">
              <div class="zenlink-engine-tag">
                <span class="zenlink-engine-dot"></span>
                <span>${getProviderName(p)}</span>
              </div>
              <button class="zenlink-subcopy-btn" data-provider="${p}" title="复制此结果">
                <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                <span>复制</span>
              </button>
            </div>
            <div class="zenlink-engine-content" id="zenlink-content-${p}">
              <div class="zenlink-loading">
                <div class="zenlink-spinner"></div>
                <span>正在请求翻译...</span>
              </div>
            </div>
          </div>
        `;
      });
      resultsList.innerHTML = listHtml;

      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      const targetLang = hasChinese ? 'en' : 'zh-CN';
      langBadge.textContent = targetLang === 'zh-CN' ? '译为 中文' : '译为 英文';

      chrome.runtime.sendMessage(
        {
          action: 'TRANSLATE_TEXT',
          text,
          providers: currentProviders,
          targetLang,
        },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            const errMsg = (response && response.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || '翻译请求失败';
            resultsList.innerHTML = `
              <div class="zenlink-error">
                <div>⚠️ ${escapeText(errMsg)}</div>
                <button class="zenlink-retry-btn" id="zenlink-btn-retry">重试</button>
              </div>
            `;
            const retryBtn = shadow.getElementById('zenlink-btn-retry');
            if (retryBtn) {
              retryBtn.addEventListener('click', () => executeTranslation(text, currentProviders));
            }
            return;
          }

          const results = response.results || [];
          lastResults = results;

          results.forEach((r) => {
            const contentEl = shadow.getElementById(`zenlink-content-${r.provider}`);
            if (!contentEl) return;

            if (r.success) {
              contentEl.textContent = r.translation;
            } else {
              contentEl.innerHTML = `<span style="color:#ef4444; font-size:11px;">⚠️ ${escapeText(r.error || '翻译失败')}</span>`;
            }
          });

          // 绑定每个卡片的独立复制按钮
          shadow.querySelectorAll('.zenlink-subcopy-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
              const p = btn.dataset.provider;
              const targetRes = lastResults.find((x) => x.provider === p && x.success);
              if (targetRes && targetRes.translation) {
                navigator.clipboard.writeText(targetRes.translation).then(() => {
                  const label = btn.querySelector('span');
                  if (label) {
                    const old = label.textContent;
                    label.textContent = '已复制 ✓';
                    btn.style.color = '#10b981';
                    setTimeout(() => {
                      label.textContent = old;
                      btn.style.color = '';
                    }, 1500);
                  }
                });
              }
            });
          });
        }
      );
    }

    function getProviderName(provider) {
      switch (provider) {
        case 'microsoft': return '微软 (Microsoft)';
        case 'baidu': return '百度 (Baidu)';
        case 'ai': return 'ZenLink AI 智能';
        case 'google':
        default: return '谷歌 (Google)';
      }
    }

    function escapeText(str) {
      return String(str || '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[m]));
    }

    // 复制全部翻译结果
    copyAllBtn.addEventListener('click', () => {
      const validResults = lastResults.filter((r) => r.success && r.translation);
      if (validResults.length === 0) return;

      const combinedText = validResults
        .map((r) => `【${getProviderName(r.provider)}】\n${r.translation}`)
        .join('\n\n');

      navigator.clipboard.writeText(combinedText).then(() => {
        copyAllText.textContent = '已复制全部 ✓';
        copyAllBtn.style.color = '#10b981';
        copyAllBtn.style.borderColor = '#10b981';
        setTimeout(() => {
          copyAllText.textContent = '复制全部';
          copyAllBtn.style.color = '';
          copyAllBtn.style.borderColor = '';
        }, 1800);
      });
    });

    // 关闭卡片
    closeBtn.addEventListener('click', () => {
      card.style.display = 'none';
      floatBtn.style.display = 'none';
    });

    // ESC 按键快捷关闭
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        floatBtn.style.display = 'none';
        card.style.display = 'none';
      }
    });
  }
})();

