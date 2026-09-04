import { marked } from 'marked';
import DOMPurify from 'dompurify';

// 统一的轻量 Marked 代码块渲染器
const customRenderer = new marked.Renderer();

customRenderer.code = function (token: any) {
  const code = typeof token === 'object' && token !== null && 'text' in token ? token.text : (token || '');
  const lang = (typeof token === 'object' && token !== null && 'lang' in token ? token.lang : '') || '';
  const language = (lang || 'text').toLowerCase().trim();

  const escapedCode = String(code)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const encodedCode = encodeURIComponent(String(code));

  return `
    <div class="code-block-wrapper">
      <button type="button" class="code-floating-copy-btn" data-code="${encodedCode}" title="复制代码">
        <svg class="copy-svg" viewBox="0 0 1024 1024" width="14" height="14">
          <path fill="currentColor" d="M768 832a128 128 0 0 1-128 128H192A128 128 0 0 1 64 832V384a128 128 0 0 1 128-128v64a64 64 0 0 0-64 64v448a64 64 0 0 0 64 64h448a64 64 0 0 0 64-64h64z"/>
          <path fill="currentColor" d="M384 128a64 64 0 0 0-64 64v448a64 64 0 0 0 64 64h448a64 64 0 0 0 64-64V192a64 64 0 0 0-64-64H384zm0-64h448a128 128 0 0 1 128 128v448a128 128 0 0 1-128 128H384a128 128 0 0 1-128-128V192A128 128 0 0 1 384 64z"/>
        </svg>
      </button>
      <pre class="code-pre-surface"><code class="language-${language}">${escapedCode}</code></pre>
    </div>
  `;
};

marked.setOptions({
  breaks: true,
  gfm: true,
  renderer: customRenderer,
});

/**
 * 统一将 Markdown 渲染为安全的 HTML
 */
export function renderMarkdown(content: string): string {
  if (!content) return '';
  try {
    const rawHtml = marked.parse(content) as string;
    return DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['target', 'data-code'],
      ADD_TAGS: ['button', 'svg', 'path', 'pre', 'code'],
    });
  } catch (e) {
    console.error('Markdown parse error:', e);
    return DOMPurify.sanitize(content);
  }
}

/**
 * 事件委托：处理全局代码块复制按钮点击
 */
export function handleCodeCopyClick(e: MouseEvent): boolean {
  const target = (e.target as HTMLElement)?.closest('.code-floating-copy-btn') as HTMLElement | null;
  if (target) {
    const encoded = target.getAttribute('data-code');
    if (encoded) {
      const code = decodeURIComponent(encoded);
      navigator.clipboard.writeText(code).then(() => {
        const originalTitle = target.getAttribute('title') || '复制代码';
        target.setAttribute('title', '已复制！');
        target.classList.add('copied');
        setTimeout(() => {
          target.setAttribute('title', originalTitle);
          target.classList.remove('copied');
        }, 2000);
      });
      return true;
    }
  }
  return false;
}

export default {
  renderMarkdown,
  handleCodeCopyClick,
};
