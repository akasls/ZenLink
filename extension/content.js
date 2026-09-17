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

    // 创建宿主节点并挂载 Shadow DOM，隔绝宿主网页样式干扰
    const host = document.createElement('div');
    host.id = 'zenlink-translate-root';
    host.style.all = 'initial';
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

      /* 悬浮小图标徽标 */
      #zenlink-float-btn {
        position: absolute;
        display: none;
        z-index: 2147483647;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #f1404b;
        color: #ffffff;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 14px rgba(241, 64, 75, 0.4), 0 2px 6px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        outline: none;
        transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease;
        padding: 0;
      }
      #zenlink-float-btn:hover {
        transform: scale(1.16);
        box-shadow: 0 6px 18px rgba(241, 64, 75, 0.55), 0 3px 8px rgba(0, 0, 0, 0.2);
      }
      #zenlink-float-btn svg {
        width: 15px;
        height: 15px;
        fill: currentColor;
        display: block;
        margin: auto;
      }

      /* 悬浮翻译面板卡片 */
      #zenlink-card {
        position: absolute;
        display: none;
        flex-direction: column;
        z-index: 2147483647;
        width: 330px;
        max-width: calc(100vw - 28px);
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        animation: zenlinkFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @media (prefers-color-scheme: dark) {
        #zenlink-card {
          background: #181c24;
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 14px 36px -4px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.3);
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
        width: 13px;
        height: 13px;
        fill: currentColor;
      }

      .zenlink-header-right {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .zenlink-provider-select {
        appearance: none;
        -webkit-appearance: none;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #ffffff;
        color: #475569;
        font-size: 11px;
        font-weight: 500;
        padding: 3px 20px 3px 8px;
        outline: none;
        cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748b' d='M0 0l5 5 5-5z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 6px center;
        transition: all 0.15s;
      }
      .zenlink-provider-select:hover {
        border-color: #f1404b;
        color: #0f172a;
      }
      @media (prefers-color-scheme: dark) {
        .zenlink-provider-select {
          background-color: #1e293b;
          border-color: #334155;
          color: #cbd5e1;
        }
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
        font-size: 15px;
        line-height: 1;
        transition: all 0.15s;
      }
      .zenlink-close-btn:hover {
        color: #f1404b;
        background: rgba(241, 64, 75, 0.1);
      }

      /* 正文区 */
      .zenlink-body {
        padding: 12px;
        max-height: 280px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
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

      .zenlink-result-box {
        font-size: 13px;
        line-height: 1.6;
        word-break: break-word;
        min-height: 48px;
      }
      .zenlink-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #64748b;
        font-size: 12px;
        padding: 12px 0;
      }
      .zenlink-spinner {
        width: 14px;
        height: 14px;
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
        padding: 3px 8px;
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
        width: 11px;
        height: 11px;
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
          <span>划词翻译</span>
        </div>
        <div class="zenlink-header-right">
          <select id="zenlink-provider-select" class="zenlink-provider-select" title="切换翻译来源">
            <option value="google">谷歌 (Google)</option>
            <option value="microsoft">微软 (Microsoft)</option>
            <option value="baidu">百度 (Baidu)</option>
            <option value="ai">AI 智能</option>
          </select>
          <button id="zenlink-close-btn" class="zenlink-close-btn" title="关闭 (Esc)">&times;</button>
        </div>
      </div>
      <div class="zenlink-body">
        <div id="zenlink-source-preview" class="zenlink-source-box"></div>
        <div id="zenlink-result-container" class="zenlink-result-box"></div>
      </div>
      <div class="zenlink-footer">
        <span id="zenlink-lang-badge" class="zenlink-target-badge">中文</span>
        <button id="zenlink-copy-btn" class="zenlink-action-btn" title="复制译文">
          <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          <span id="zenlink-copy-text">复制</span>
        </button>
      </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(floatBtn);
    shadow.appendChild(card);
    (document.body || document.documentElement).appendChild(host);

    // 内部 DOM 引用
    const providerSelect = shadow.getElementById('zenlink-provider-select');
    const closeBtn = shadow.getElementById('zenlink-close-btn');
    const sourcePreview = shadow.getElementById('zenlink-source-preview');
    const resultContainer = shadow.getElementById('zenlink-result-container');
    const langBadge = shadow.getElementById('zenlink-lang-badge');
    const copyBtn = shadow.getElementById('zenlink-copy-btn');
    const copyText = shadow.getElementById('zenlink-copy-text');

    let currentSelectedText = '';
    let currentTranslation = '';
    let currentTargetLang = '';
    let lastSelectionRect = null;

    // 监听网页划选文本事件 (mouseup)
    document.addEventListener('mouseup', (e) => {
      // 若事件来源于组件自身内部，不予处理
      if (e.composedPath().includes(host)) return;

      // 检查开关配置
      chrome.storage.local.get(['translationEnabled', 'translationProvider'], (stored) => {
        if (stored.translationEnabled === false) {
          floatBtn.style.display = 'none';
          return;
        }

        const provider = stored.translationProvider || 'google';
        if (providerSelect.value !== provider) {
          providerSelect.value = provider;
        }

        const selection = window.getSelection ? window.getSelection() : null;
        const text = selection ? selection.toString().trim() : '';

        // 过滤空选区或超长文本
        if (!text || text.length === 0 || text.length > 3500) {
          floatBtn.style.display = 'none';
          return;
        }

        if (selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        currentSelectedText = text;
        lastSelectionRect = rect;

        const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

        let btnX = rect.right + scrollX + 4;
        let btnY = rect.bottom + scrollY + 4;

        // 边缘防溢出处理
        const docW = document.documentElement.clientWidth;
        if (btnX + 34 > docW + scrollX) {
          btnX = docW + scrollX - 36;
        }

        floatBtn.style.left = `${Math.max(6, btnX)}px`;
        floatBtn.style.top = `${Math.max(6, btnY)}px`;
        floatBtn.style.display = 'block';
      });
    });

    // 点击浮动按钮触发翻译
    floatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      floatBtn.style.display = 'none';

      if (!currentSelectedText || !lastSelectionRect) return;

      const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const cardWidth = 330;

      let cardX = lastSelectionRect.left + scrollX;
      let cardY = lastSelectionRect.bottom + scrollY + 8;

      const docW = document.documentElement.clientWidth;
      if (cardX + cardWidth > docW + scrollX - 14) {
        cardX = docW + scrollX - cardWidth - 14;
      }
      if (cardX < scrollX + 8) cardX = scrollX + 8;

      // 若接近视口底部且上方空间充裕，则翻转置于选区上方展示
      if (lastSelectionRect.bottom + 260 > window.innerHeight && lastSelectionRect.top > 220) {
        cardY = lastSelectionRect.top + scrollY - 240;
      }

      card.style.left = `${Math.max(8, cardX)}px`;
      card.style.top = `${Math.max(8, cardY)}px`;
      card.style.display = 'flex';

      // 填充原文预览
      sourcePreview.textContent = currentSelectedText;

      executeTranslation(currentSelectedText, providerSelect.value);
    });

    // 执行翻译请求
    function executeTranslation(text, provider) {
      resultContainer.innerHTML = `
        <div class="zenlink-loading">
          <div class="zenlink-spinner"></div>
          <span>正在使用 ${getProviderName(provider)} 翻译中...</span>
        </div>
      `;
      copyBtn.style.opacity = '0.5';
      copyBtn.style.pointerEvents = 'none';

      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      const targetLang = hasChinese ? 'en' : 'zh-CN';
      langBadge.textContent = targetLang === 'zh-CN' ? '译为 中文' : '译为 英文';

      chrome.runtime.sendMessage(
        {
          action: 'TRANSLATE_TEXT',
          text,
          provider,
          targetLang,
        },
        (response) => {
          copyBtn.style.opacity = '1';
          copyBtn.style.pointerEvents = 'auto';

          if (chrome.runtime.lastError || !response || !response.success) {
            const errMsg = (response && response.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || '翻译请求失败';
            resultContainer.innerHTML = `
              <div class="zenlink-error">
                <div>⚠️ ${escapeText(errMsg)}</div>
                <button class="zenlink-retry-btn" id="zenlink-btn-retry">重试</button>
              </div>
            `;
            const retryBtn = shadow.getElementById('zenlink-btn-retry');
            if (retryBtn) {
              retryBtn.addEventListener('click', () => executeTranslation(text, provider));
            }
            return;
          }

          currentTranslation = response.translation || '';
          currentTargetLang = response.targetLang || targetLang;
          langBadge.textContent = currentTargetLang === 'zh-CN' ? '译为 简体中文' : '译为 English';

          resultContainer.textContent = currentTranslation;
        }
      );
    }

    function getProviderName(provider) {
      switch (provider) {
        case 'microsoft': return '微软';
        case 'baidu': return '百度';
        case 'ai': return 'ZenLink AI';
        case 'google':
        default: return '谷歌';
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

    // 切换翻译渠道即刻重新翻译并保存首选
    providerSelect.addEventListener('change', (e) => {
      const newProvider = e.target.value;
      chrome.storage.local.set({ translationProvider: newProvider });
      if (currentSelectedText) {
        executeTranslation(currentSelectedText, newProvider);
      }
    });

    // 复制译文
    copyBtn.addEventListener('click', () => {
      if (!currentTranslation) return;
      navigator.clipboard.writeText(currentTranslation).then(() => {
        copyText.textContent = '已复制 ✓';
        copyBtn.style.color = '#10b981';
        copyBtn.style.borderColor = '#10b981';
        setTimeout(() => {
          copyText.textContent = '复制';
          copyBtn.style.color = '';
          copyBtn.style.borderColor = '';
        }, 1800);
      });
    });

    // 关闭卡片
    closeBtn.addEventListener('click', () => {
      card.style.display = 'none';
      floatBtn.style.display = 'none';
    });

    // 点击空白处收起浮动组件
    document.addEventListener('mousedown', (e) => {
      if (e.composedPath().includes(host)) return;
      floatBtn.style.display = 'none';
      card.style.display = 'none';
    });

    // ESC 按键快捷关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        floatBtn.style.display = 'none';
        card.style.display = 'none';
      }
    });
  }
})();

