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
})();
