/**
 * HTML模板生成器
 * 负责生成Markdown预览的HTML模板
 */

import chroma from 'chroma-js'
import { adjustContrastColor, generateBlockquoteBorderColor, generateBlockquoteColors, generateSelectionBackgroundColor, generateBrightenedForegroundColor, isDarkColor } from './color-hander'

export interface HtmlTemplateOptions {
  /** 页面内容 */
  content: string
  /** 主题样式CSS */
  themeStyles: string
  /** CSP nonce */
  nonce: string
  /** 扩展URI */
  extensionUri: string
}

/**
 * 主题样式配置 - 直接返回完整的样式字符串
 */
export type ThemeStylesConfig = string

/**
 * 生成主题CSS样式
 * @param themeColors 主题颜色配置
 * @param layoutOptions 布局选项
 * @param layoutOptions.fontSize 字体大小
 * @param layoutOptions.lineHeight 行高
 * @param layoutOptions.fontFamily 字体家族
 * @param _highlighter Shiki高亮器实例
 * @returns 完整的样式字符串
 */
export function generateThemeStyles(
  themeColors: Record<string, string>,
  layoutOptions: {
    fontSize: number
    lineHeight: number
    fontFamily: string
  },
  _highlighter?: any,
  themeName?: string,
): ThemeStylesConfig {
  // 构建基础颜色配置
  const baseColors = {
    'editor.background': '#ffffff',
    'editor.foreground': '#24292e',
    'editor.lineHighlightBackground': '#f6f8fa',
    'editorLineNumber.foreground': '#6a737d',
    'panel.border': '#d0d7de',
    'editor.selectionBackground': 'rgba(175,184,193,0.2)',
    'textLink.foreground': '#0969da',
    'textCodeBlock.background': '#f6f8fa',
    'editor.foldBackground': 'rgba(175,184,193,0.15)',
    'textBlockQuote.background': 'rgba(175,184,193,0.1)',
  }

  // 使用主题颜色覆盖基础配置
  const allThemeColors = { ...baseColors, ...themeColors }

  // 检测主题类型
  const isDarkTheme = isDarkColor(allThemeColors['editor.background'])

  // 生成增强的颜色变量
  const enhancedColors = generateEnhancedColors(allThemeColors, isDarkTheme, themeName)

  // 合并原始主题变量和增强变量
  const allColors = { ...allThemeColors, ...enhancedColors }

  // 生成CSS变量字符串
  const cssVariables = Object.entries(allColors)
    .map(([key, value]) => `--${key.replaceAll('.', '-')}: ${value};`)
    .join('\n        ')
  const cssVariablesBlock = `:root {\n        ${cssVariables}\n    }`
  // 布局相关样式 - 不依赖主题变量
  const layoutStyles = `
        /* 布局相关样式 - 不依赖主题变量 */
        body {
            font-size: ${layoutOptions.fontSize}px;
            line-height: ${layoutOptions.lineHeight};
            margin: 0;
            padding: 20px;
            font-family: ${layoutOptions.fontFamily};
        }`
  // 生成元素样式
  const elementStyles = `
        body {
            background-color: var(--editor-background);
            color: var(--editor-foreground);
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        
        ::selection {
             background: var(--editor-selectionBackground);
         }

        blockquote {
            color: var(--markdown-darkened-foreground);
            background-color: var(--markdown-blockQuote-background-level1);
            border-left: 4px solid var(--markdown-blockQuote-border);
            padding: 0.5em 1em;
            margin: 0 0 1em 0;
            font-style: italic;
        }

        /* blockquote嵌套层级样式 */
        blockquote blockquote {
            background-color: var(--markdown-blockQuote-background-level2);
            border-left-width: 3px;
        }

        blockquote blockquote blockquote {
            background-color: var(--markdown-blockQuote-background-level3);
            border-left-width: 2px;
        }

        blockquote blockquote blockquote blockquote {
            background-color: var(--markdown-blockQuote-background-level4);
            border-left-width: 2px;
        }

        blockquote blockquote blockquote blockquote blockquote {
            background-color: var(--markdown-blockQuote-background-level5);
            border-left-width: 2px;
        }

        th, td {
            border: 0.5px solid var(--markdown-table-border);
            padding: 8px 12px;
        }

        th {
            background-color: var(--markdown-tableHeader-background);
            color: var(--editor-foreground);
            font-weight: 600;
        }

        code {
            background-color: var(--editor-foldBackground);
            color: var(--editor-foreground);
            padding: 0.2em 0.4em;
            margin: 0;
            font-size: 85%;
            border-radius: 6px;
        }

        pre {
            background-color: var(--markdown-codeBlock-background);
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
        }

        pre code {
            background-color: transparent;
            padding: 0;
            margin: 0;
            font-size: 100%;
            border-radius: 0;
        }

        .shiki {
            background-color: var(--markdown-codeBlock-background) !important;
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
            margin: 16px 0;
        }

        a {
            color: var(--textLink-foreground);
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }

        h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
            color: var(--editor-foreground);
        }

        h1 {    
            font-size: 2em; 
            color: var(--markdown-strong-foreground);
            border-bottom: 1px solid var(--editor-foreground); 
            padding-bottom: 0.3em; 
        }
        h2 { 
            font-size: 1.5em; 
            color: var(--markdown-strong-foreground);
            border-bottom: 1px solid var(--editor-foreground); 
            padding-bottom: 0.3em; 
        }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1em; }
        h5 { font-size: 0.875em; }
        h6 { font-size: 0.85em; }

        p { 
            margin-bottom: 16px; 
            color: var(--editor-foreground);
        }

        hr{
            border-color:var(--editor-foreground);
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
        }`

  const completeStyles = `${cssVariablesBlock}\n      ${layoutStyles}\n       ${elementStyles}`

  return completeStyles
}

/**
 * 生成增强的颜色变量
 * 使用 adjustContrastColor 函数来智能计算对比度适宜的颜色
 * @param themeColors 主题颜色配置
 * @param isDark 是否为深色主题
 * @returns 增强的颜色配置
 */
function generateEnhancedColors(themeColors: Record<string, string>, isDark: boolean, themeName?: string): Record<string, string> {
  const enhanced: Record<string, string> = {}

  try {
    const background = themeColors['editor.background'] || '#ffffff'

    const tableHeaderResult = adjustContrastColor(background)
    enhanced['markdown.tableHeader.background'] = tableHeaderResult.hex

    const codeBlockResult = adjustContrastColor(background)
    enhanced['markdown.codeBlock.background'] = codeBlockResult.hex
    enhanced['markdown.table.border'] = themeColors['panel.border']

    // 生成blockquote嵌套层级颜色
    const blockquoteColors = generateBlockquoteColors(background, 5)
    enhanced['markdown.blockQuote.background.level1'] = blockquoteColors[0]
    enhanced['markdown.blockQuote.background.level2'] = blockquoteColors[1]
    enhanced['markdown.blockQuote.background.level3'] = blockquoteColors[2]
    enhanced['markdown.blockQuote.background.level4'] = blockquoteColors[3]
    enhanced['markdown.blockQuote.background.level5'] = blockquoteColors[4]

    // 保持向后兼容性，使用第一级作为默认背景
    enhanced['markdown.blockQuote.background'] = blockquoteColors[0]

    // 生成具有足够对比度的blockquote边框颜色
    const originalBorderColor = themeColors['panel.border']
    const optimizedBorderColor = generateBlockquoteBorderColor(background, originalBorderColor, 3.0)
    enhanced['markdown.blockQuote.border'] = optimizedBorderColor



    let foreground = themeColors['editor.foreground'] || (isDark ? '#ffffff' : '#000000')
    // 为特定主题优化前景色对比度
    if (themeName) {
      const optimizedForeground = generateBrightenedForegroundColor(themeName, background, foreground)
      if (optimizedForeground !== foreground) {
        foreground = enhanced['editor.foreground'] = optimizedForeground
      }
    }

    // 生成具有足够对比度的选择区域背景色
    const originalSelectionBackground = themeColors['editor.selectionBackground']
    const optimizedSelectionBackground = generateSelectionBackgroundColor(foreground, originalSelectionBackground, 3.0)
    enhanced['editor.selectionBackground'] = optimizedSelectionBackground


    // 基于 editor.foreground 生成对比色，用于替代 editorLineNumber.foreground
    // 如果是纯白色或纯黑色，不处理
    if (foreground === '#ffffff' || foreground === '#fff' || foreground === '#000000' || foreground === '#000') {
      enhanced['markdown.strong.foreground'] = foreground
    }
    else {
      // 判断前景色的亮暗，亮色提亮，暗色加深
      const chromaColor = chroma(foreground)

      // 使用现成的 isDarkColor 函数判断
      const adjustedForeground = isDarkColor(background)
        ? chromaColor.brighten(0.6).hex() // 亮色提亮
        : chromaColor.darken(0.6).hex() // 暗色加深

      enhanced['markdown.strong.foreground'] = adjustedForeground
    }
  }
  catch {
    // 如果颜色计算失败，使用安全的回退颜色
    enhanced['markdown.tableHeader.background'] = isDark ? '#2d3748' : '#f7fafc'
    enhanced['markdown.codeBlock.background'] = isDark ? '#1a202c' : '#f7fafc'
    enhanced['markdown.table.border'] = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'
    enhanced['markdown.strong.foreground'] = isDark ? '#a0a0a0' : '#666666'

    // blockquote回退颜色 - 5个层级
    if (isDark) {
      enhanced['markdown.blockQuote.background.level1'] = 'rgba(255, 255, 255, 0.05)'
      enhanced['markdown.blockQuote.background.level2'] = 'rgba(255, 255, 255, 0.08)'
      enhanced['markdown.blockQuote.background.level3'] = 'rgba(255, 255, 255, 0.12)'
      enhanced['markdown.blockQuote.background.level4'] = 'rgba(255, 255, 255, 0.16)'
      enhanced['markdown.blockQuote.background.level5'] = 'rgba(255, 255, 255, 0.20)'
      enhanced['markdown.blockQuote.background'] = 'rgba(255, 255, 255, 0.05)'
      enhanced['markdown.blockQuote.border'] = 'rgba(255, 255, 255, 0.3)'
    }
    else {
      enhanced['markdown.blockQuote.background.level1'] = 'rgba(74, 85, 104, 0.04)'
      enhanced['markdown.blockQuote.background.level2'] = 'rgba(74, 85, 104, 0.07)'
      enhanced['markdown.blockQuote.background.level3'] = 'rgba(74, 85, 104, 0.10)'
      enhanced['markdown.blockQuote.background.level4'] = 'rgba(74, 85, 104, 0.13)'
      enhanced['markdown.blockQuote.background.level5'] = 'rgba(74, 85, 104, 0.16)'
      enhanced['markdown.blockQuote.background'] = 'rgba(74, 85, 104, 0.04)'
      enhanced['markdown.blockQuote.border'] = 'rgba(0, 0, 0, 0.3)'
    }
  }

  return enhanced
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

/**
 * 生成HTML模板
 * @param options 模板选项
 * @returns 完整的HTML字符串
 */
export function generateHtmlTemplate(options: HtmlTemplateOptions): string {
  const { content, themeStyles, nonce, extensionUri } = options

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${extensionUri}; script-src 'nonce-${nonce}'; img-src data: https:;">
    <title>Markdown Preview</title>
    <style>
        ${themeStyles}
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
