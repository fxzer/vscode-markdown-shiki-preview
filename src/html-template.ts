/**
 * HTML模板生成器
 * 负责生成Markdown预览的HTML模板
 */

export interface HtmlTemplateOptions {
  /** 页面内容 */
  content: string
  /** 主题样式CSS */
  themeStyles: string
  /** 字体大小 */
  fontSize: number
  /** 行高 */
  lineHeight: number
  /** 字体家族 */
  fontFamily: string
  /** CSP nonce */
  nonce: string
  /** 扩展URI */
  extensionUri: string
}

/**
 * 生成HTML模板
 * @param options 模板选项
 * @returns 完整的HTML字符串
 */
export function generateHtmlTemplate(options: HtmlTemplateOptions): string {
  const { content, themeStyles, fontSize, lineHeight, fontFamily, nonce, extensionUri } = options

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${extensionUri}; script-src 'nonce-${nonce}'; img-src data: https:;">
    <title>Markdown Preview</title>
    <style>
        ${themeStyles}
        
        body {
            font-size: ${fontSize}px;
            line-height: ${lineHeight};
            margin: 0;
            padding: 20px;
            font-family: ${fontFamily};
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        
        /* Shiki styles */
        .shiki {
            background-color: var(--textCodeBlock-background) !important;
            border: 1px solid var(--panel-border);
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
            margin: 16px 0;
        }
        
        /* Markdown styles */
        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        
        h1 { font-size: 2em; border-bottom: 1px solid var(--editorLineNumber-foreground); padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; border-bottom: 1px solid var(--editorLineNumber-foreground); padding-bottom: 0.3em; }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1em; }
        h5 { font-size: 0.875em; }
        h6 { font-size: 0.85em; }
        
        p { margin-bottom: 16px; }
        
        blockquote {
            padding: 0 1em;
            border-left: 0.25em solid;
            margin: 0 0 16px 0;
            font-style: italic;
        }
        
        ul, ol {
            padding-left: 2em;
            margin-bottom: 16px;
        }
        
        li {
            margin-bottom: 0.25em;
        }
        
        table {
            border-collapse: collapse;
            margin-bottom: 16px;
            width: 100%;
        }
        
        th, td {
            padding: 6px 13px;
            border: 1px solid;
        }
        
        th {
            font-weight: 600;
        }
        
        code {
            padding: 0.2em 0.4em;
            margin: 0;
            font-size: 85%;
            border-radius: 6px;
        }
        
        pre code {
            padding: 0;
            margin: 0;
            font-size: 100%;
            background-color: transparent;
            border-radius: 0;
        }
        
        a {
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        ${content}
    </div>
    <script nonce="${nonce}">
        ${getWebviewScript()}
    </script>
</body>
</html>`
}

/**
 * 获取webview脚本内容
 * @returns JavaScript脚本字符串
 */
function getWebviewScript(): string {
  return `
        // VS Code API
        const vscode = acquireVsCodeApi();
        
        // 处理外部链接点击
        document.addEventListener('click', event => {
            if (event.target.tagName === 'A' && event.target.href.startsWith('http')) {
                event.preventDefault();
                vscode.postMessage({
                    command: 'openExternal',
                    url: event.target.href
                });
            }
        });
        
        // 滚动同步 - 优化版本，带防抖、阈值控制和缓存
        let isScrollingFromEditor = false;
        let scrollTimeout = null;
        let lastScrollPercentage = -1; // 缓存上次滚动比例
        let cachedDocumentHeight = 0;
        let cachedViewportHeight = 0;
        let heightCacheTime = 0;
        const HEIGHT_CACHE_DURATION = 1000; // 缓存1秒
        const SCROLL_THRESHOLD = 0.005; // 滚动阈值，小于0.5%的变化不触发同步
        
        // 获取文档内容的总高度（带缓存）
        function getDocumentHeight() {
            const now = Date.now();
            if (now - heightCacheTime < HEIGHT_CACHE_DURATION && cachedDocumentHeight > 0) {
                return cachedDocumentHeight;
            }
            
            cachedDocumentHeight = Math.max(
                document.body.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
            );
            heightCacheTime = now;
            return cachedDocumentHeight;
        }
        
        // 获取视口高度（带缓存）
        function getViewportHeight() {
            const now = Date.now();
            if (now - heightCacheTime < HEIGHT_CACHE_DURATION && cachedViewportHeight > 0) {
                return cachedViewportHeight;
            }
            
            cachedViewportHeight = Math.max(document.documentElement.clientHeight, (typeof window !== 'undefined' ? window.innerHeight : 0) || 0);
            return cachedViewportHeight;
        }
        
        // 优化的滚动处理函数
        function handleScroll() {
            if (isScrollingFromEditor) {
                return;
            }
            
            const scrollTop = (typeof window !== 'undefined' ? window.pageYOffset : 0) || document.documentElement.scrollTop;
            const documentHeight = getDocumentHeight();
            const viewportHeight = getViewportHeight();
            const maxScrollTop = Math.max(0, documentHeight - viewportHeight);
            
            const scrollPercentage = maxScrollTop > 0 ? 
                Math.max(0, Math.min(1, scrollTop / maxScrollTop)) : 0;
            
            // 只有滚动变化超过阈值时才触发同步
            if (Math.abs(scrollPercentage - lastScrollPercentage) < SCROLL_THRESHOLD) {
                return;
            }
            
            lastScrollPercentage = scrollPercentage;
            
            vscode.postMessage({
                command: 'scroll',
                scrollPercentage: scrollPercentage,
                source: 'preview'
            });
        }
        
        // 防抖滚动处理
        function debouncedHandleScroll() {
            if (scrollTimeout) {
                return; // 如果已经有待处理的滚动事件，跳过
            }
            
            scrollTimeout = requestAnimationFrame(() => {
                handleScroll();
                scrollTimeout = null;
            });
        }
        
        // 监听滚动事件，使用防抖处理
        document.addEventListener('scroll', debouncedHandleScroll, { passive: true });
        
        // 监听窗口大小变化，清除高度缓存
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', () => {
                cachedDocumentHeight = 0;
                cachedViewportHeight = 0;
                heightCacheTime = 0;
            }, { passive: true });
        }
        
        // 监听来自扩展的消息
        if (typeof window !== 'undefined') {
            window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'scrollToPercentage':
                    // 如果消息来自预览自身，跳过处理
                    if (message.source === 'preview') {
                        break;
                    }
                    
                    isScrollingFromEditor = true;
                    
                    const documentHeight = getDocumentHeight();
                    const viewportHeight = getViewportHeight();
                    const maxScrollTop = Math.max(0, documentHeight - viewportHeight);
                    const targetScrollTop = Math.max(0, Math.min(maxScrollTop, maxScrollTop * message.percentage));
                    
                    if (typeof window !== 'undefined') {
                        window.scrollTo({
                            top: targetScrollTop,
                            behavior: 'auto'
                        });
                    }
                    
                    // 延迟后重置标志，避免死循环，与编辑器端保持一致的延迟时间
                    setTimeout(() => {
                        isScrollingFromEditor = false;
                    }, 150);
                    break;
            }
            });
        }`
}
