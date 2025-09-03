import type { Highlighter } from 'shiki'
import { debounce } from 'lodash-es'
import MarkdownIt from 'markdown-it'
import { bundledLanguages, bundledThemes, createHighlighter } from 'shiki'
import * as vscode from 'vscode'

// 性能监控工具
class PerformanceMonitor {
  private static timings: Map<string, number[]> = new Map()
  
  static start(label: string): void {
    if (!this.timings.has(label)) {
      this.timings.set(label, [])
    }
    this.timings.get(label)!.push(Date.now())
  }
  
  static end(label: string): number {
    const times = this.timings.get(label)
    if (!times || times.length === 0) return 0
    
    const start = times.pop()!
    const duration = Date.now() - start
    console.log(`[Performance] ${label}: ${duration}ms`)
    return duration
  }
  
  static log(label: string, duration: number): void {
    console.log(`[Performance] ${label}: ${duration}ms`)
  }
}

export class MarkdownPreviewProvider implements vscode.WebviewPanelSerializer {
  private _panel: vscode.WebviewPanel | undefined
  private _md: MarkdownIt
  private _highlighter: Highlighter | undefined
  private _currentShikiTheme: string = 'github-light'

  // 内容更新防抖相关
  private lastUpdateDocumentUri: string | undefined // 记录最后更新的文档URI
  private debouncedUpdateContent: ReturnType<typeof debounce>
  
  // 性能优化相关
  private _renderCache = new Map<string, string>() // 渲染结果缓存
  private _themeCache = new Map<string, any>() // 主题数据缓存
  private _isInitialized = false

  // 滚动同步相关
  private _currentDocument: vscode.TextDocument | undefined
  private _scrollSyncDisposables: vscode.Disposable[] = []
  private _scrollSource = 'none' // 'editor' | 'preview' | 'none'
  private _scrollTimeout: NodeJS.Timeout | undefined
  private _editorMap = new Map<string, vscode.TextEditor>() // URI到编辑器的映射

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
    })

    // 初始化 lodash 防抖函数
    this.debouncedUpdateContent = debounce(this.performContentUpdate.bind(this), 300)
    
    // 延迟初始化高亮器，避免阻塞启动
    setTimeout(() => {
      if (!this._isInitialized) {
        this.initializeHighlighter()
      }
    }, 100)
  }

  private async initializeHighlighter() {
    PerformanceMonitor.start('initializeHighlighter')
    try {
      console.log('[Performance] Starting Shiki highlighter initialization...')
      
      // 只加载必要的主题和语言，减少初始化时间
      const themes = ['github-light', 'github-dark', 'min-light', 'min-dark']
      const langs = ['javascript', 'typescript', 'python', 'java', 'css', 'html', 'json', 'markdown', 'bash', 'shell', 'yaml', 'xml', 'sql', 'go', 'rust', 'cpp', 'c', 'php', 'ruby']
      
      this._highlighter = await createHighlighter({
        themes,
        langs,
      })

      this._currentShikiTheme = 'github-light'
      this.setupMarkdownRenderer()
      
      PerformanceMonitor.end('initializeHighlighter')
      console.log('[Performance] Shiki highlighter initialized successfully')
    }
    catch (error) {
      console.error('Failed to initialize Shiki highlighter:', error)
    }
  }

  private setupMarkdownRenderer() {
    if (!this._highlighter)
      return

    this._md.set({
      highlight: (code, lang) => {
        if (!this._highlighter)
          return `<pre><code>${code}</code></pre>`

        try {
          // 使用缓存键来避免重复渲染相同的代码块
          const cacheKey = `${this._currentShikiTheme}-${lang || 'text'}-${code.length}-${this.hashCode(code)}`
          const cached = this._renderCache.get(cacheKey)
          if (cached) {
            return cached
          }

          const result = this._highlighter.codeToHtml(code, {
            lang: (lang || 'text') as any,
            theme: this._currentShikiTheme as any,
          })
          
          // 缓存结果，限制缓存大小
          if (this._renderCache.size > 1000) {
            const firstKey = this._renderCache.keys().next().value
            this._renderCache.delete(firstKey)
          }
          this._renderCache.set(cacheKey, result)
          
          return result
        }
        catch {
          return this._highlighter.codeToHtml(code, {
            lang: 'text' as any,
            theme: this._currentShikiTheme as any,
          })
        }
      },
    })
  }

  private hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash)
  }

  async showPreview(document: vscode.TextDocument) {
    PerformanceMonitor.start('showPreview')
    
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Two)
      PerformanceMonitor.end('showPreview')
      return
    }
    
    console.log('[Performance] Creating new webview panel...')
    this._panel = vscode.window.createWebviewPanel(
      'markdownThemePreview',
      'Markdown Preview',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this._extensionUri],
      },
    )

    // 应用当前配置的主题
    const config = vscode.workspace.getConfiguration('markdownThemePreview')
    const configTheme = config.get<string>('currentTheme', 'github-light')
    if (configTheme !== this._currentShikiTheme) {
      this._currentShikiTheme = configTheme
      this.setupMarkdownRenderer()
    }

    this._panel.onDidDispose(() => {
      this._panel = undefined
    })

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'alert':
            vscode.window.showErrorMessage(message.text)
            break
          case 'scroll':
            this.handlePreviewScroll(message.scrollPercentage, message.source, message.timestamp)
            break
        }
      },
      undefined,
      [],
    )

    await this.updateContent(document)
    this.setupScrollSync(document)
    PerformanceMonitor.end('showPreview')
  }

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, _state: any) {
    this._panel = webviewPanel

    webviewPanel.onDidDispose(() => {
      this._panel = undefined
    })

    // 设置消息处理器
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'alert':
            vscode.window.showErrorMessage(message.text)
            break
          case 'scroll':
            this.handlePreviewScroll(message.scrollPercentage, message.source, message.timestamp)
            break
        }
      },
      undefined,
      [],
    )

    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor && activeEditor.document.fileName.endsWith('.md')) {
      this.updateContent(activeEditor.document)
      this.setupScrollSync(activeEditor.document)
    }
  }

  isPreviewVisible(): boolean {
    return this._panel !== undefined && this._panel.visible
  }

  async updateTheme(theme: string) {
    this._currentShikiTheme = theme

    if (this._highlighter) {
      this.setupMarkdownRenderer()
    }

    // 如果预览窗口存在，立即更新预览内容
    if (this._panel && this._currentDocument) {
      await this.updateContent(this._currentDocument)
    }
  }

  hasActivePanel(): boolean {
    return this._panel !== undefined
  }

  getCurrentDocument(): vscode.TextDocument | undefined {
    return this._currentDocument
  }

  // 带防抖的内容更新方法
  updateContentDebounced(document: vscode.TextDocument) {
    this.debouncedUpdateContent(document)
  }

  // 实际执行内容更新的方法（被防抖函数调用）
  private async performContentUpdate(document: vscode.TextDocument) {
    try {
      const documentUri = document.uri.toString()

      // 确保文档仍然是活动的
      const activeEditor = vscode.window.activeTextEditor
      if (activeEditor && activeEditor.document.uri.toString() === documentUri) {
        await this.updateContent(document)
        this.lastUpdateDocumentUri = documentUri
      }
    }
    catch (error) {
      console.error('Error updating content:', error)
    }
  }

  async updateContent(document: vscode.TextDocument) {
    PerformanceMonitor.start('updateContent')
    
    if (!this._panel) {
      PerformanceMonitor.end('updateContent')
      return
    }

    if (!this._highlighter) {
      console.log('[Performance] Highlighter not ready, initializing...')
      await this.initializeHighlighter()
    }

    // 确保 _currentDocument 被设置
    this._currentDocument = document

    const content = document.getText()
    const documentUri = document.uri.toString()

    // 避免重复更新同一文档的相同内容
    if (this.lastUpdateDocumentUri === documentUri && this._panel.webview.html.includes(content.substring(0, 100))) {
      console.log('[Performance] Skipping duplicate content update')
      PerformanceMonitor.end('updateContent')
      return
    }

    // 使用当前设置的主题（可能是预览主题或配置主题）
    let currentTheme = this._currentShikiTheme

    // 验证主题是否有效，如果无效则从配置获取
    const validThemes = Object.keys(bundledThemes)

    if (!validThemes.includes(currentTheme)) {
      const config = vscode.workspace.getConfiguration('markdownThemePreview')
      currentTheme = config.get<string>('currentTheme', 'github-light') || 'github-light' || 'github-light'

      if (!validThemes.includes(currentTheme)) {
        currentTheme = 'github-light'
        // 同步修复配置
        await config.update('currentTheme', currentTheme, vscode.ConfigurationTarget.Global)
      }

      this._currentShikiTheme = currentTheme
      this.setupMarkdownRenderer()
    }

    console.log('[Performance] Rendering markdown content...')
    const renderStart = Date.now()
    const html = this._md.render(content)
    PerformanceMonitor.log('markdownRender', Date.now() - renderStart)

    const config = vscode.workspace.getConfiguration('markdownThemePreview')
    const fontSize = config.get<number>('fontSize', 14)
    const lineHeight = config.get<number>('lineHeight', 1.6)
    const fontFamily = config.get<string>('fontFamily', 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif')

    console.log('[Performance] Generating HTML...')
    const htmlStart = Date.now()
    this._panel.webview.html = this.getHtmlForWebview(html, currentTheme, fontSize, lineHeight, fontFamily)
    PerformanceMonitor.log('generateHtml', Date.now() - htmlStart)
    
    this.lastUpdateDocumentUri = documentUri
    PerformanceMonitor.end('updateContent')
  }

  private getHtmlForWebview(content: string, theme: string, fontSize: number, lineHeight: number, fontFamily: string): string {
    const nonce = this.getNonce()
    const themeStyles = this.getThemeCSS(theme)

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data: https:;">
            <title>Markdown Preview</title>
            <style>
                ${themeStyles}
                body{font-size:${fontSize}px;line-height:${lineHeight};margin:0;padding:20px;font-family:${fontFamily}}
                .container{max-width:900px;margin:0 auto}
                .shiki{border-radius:6px;padding:16px;overflow-x:auto;margin:16px 0}
                h1,h2,h3,h4,h5,h6{margin-top:24px;margin-bottom:16px;font-weight:600;line-height:1.25}
                h1{font-size:2em;border-bottom:1px solid var(--color-border-muted);padding-bottom:.3em}
                h2{font-size:1.5em;border-bottom:1px solid var(--color-border-muted);padding-bottom:.3em}
                h3{font-size:1.25em}h4{font-size:1em}h5{font-size:.875em}h6{font-size:.85em}
                p{margin-bottom:16px}
                blockquote{padding:0 1em;border-left:.25em solid;margin:0 0 16px 0;font-style:italic}
                ul,ol{padding-left:2em;margin-bottom:16px}
                li{margin-bottom:.25em}
                table{border-collapse:collapse;margin-bottom:16px;width:100%}
                th,td{padding:6px 13px;border:1px solid}
                th{font-weight:600}
                code{padding:.2em .4em;margin:0;font-size:85%;border-radius:6px}
                pre code{padding:0;margin:0;font-size:100%;background-color:transparent;border-radius:0}
                a{text-decoration:none}
                a:hover{text-decoration:underline}
            </style>
        </head>
        <body>
            <div class="container">
                ${content}
            </div>
            <script nonce="${nonce}">
                const vscode=acquireVsCodeApi();
                document.addEventListener('click',e=>{if(e.target.tagName==='A'&&e.target.href.startsWith('http')){e.preventDefault();vscode.postMessage({command:'openExternal',url:e.target.href})}});
                let isScrollingFromEditor=false;
                function getDocumentHeight(){return Math.max(document.body.scrollHeight,document.body.offsetHeight,document.documentElement.scrollHeight,document.documentElement.offsetHeight)}
                function getViewportHeight(){return Math.max(document.documentElement.clientHeight,window.innerHeight||0)}
                function handleScroll(){if(isScrollingFromEditor)return;const scrollTop=window.pageYOffset||document.documentElement.scrollTop,documentHeight=getDocumentHeight(),viewportHeight=getViewportHeight(),maxScrollTop=Math.max(0,documentHeight-viewportHeight),scrollPercentage=maxScrollTop>0?Math.max(0,Math.min(1,scrollTop/maxScrollTop)):0;vscode.postMessage({command:'scroll',scrollPercentage:scrollPercentage,source:'preview'})}
                document.addEventListener('scroll',handleScroll,{passive:true});
                window.addEventListener('message',event=>{const message=event.data;switch(message.command){case'scrollToPercentage':if(message.source==='preview')break;isScrollingFromEditor=true;const documentHeight=getDocumentHeight(),viewportHeight=getViewportHeight(),maxScrollTop=Math.max(0,documentHeight-viewportHeight),targetScrollTop=Math.max(0,Math.min(maxScrollTop,maxScrollTop*message.percentage));window.scrollTo({top:targetScrollTop,behavior:'auto'});setTimeout(()=>{isScrollingFromEditor=false},100);break}});
            </script>
        </body>
        </html>`
  }

  private getThemeCSS(theme: string): string {
    if (!this._highlighter)
      return ''

    try {
      // 获取主题的CSS变量
      const themeData = this._highlighter.getTheme(theme)
      if (!themeData || !themeData.colors)
        return ''

      const colors = themeData.colors || {}

      return `
                :root {
                    --color-canvas-default: ${colors['editor.background'] || '#ffffff'};
                    --color-canvas-subtle: ${colors['editor.background'] || '#f6f8fa'};
                    --color-fg-default: ${colors['editor.foreground'] || '#24292e'};
                    --color-fg-muted: ${colors['editorLineNumber.foreground'] || '#6a737d'};
                    --color-border-default: ${colors['editorLineNumber.foreground'] || '#d0d7de'};
                    --color-border-muted: ${colors['editorLineNumber.foreground'] || '#d8dee4'};
                    --color-neutral-muted: ${colors['editor.selectionBackground'] || 'rgba(175,184,193,0.2)'};
                    --color-accent-fg: ${colors['textLink.foreground'] || '#0969da'};
                    background-color: var(--color-canvas-default);
                    color: var(--color-fg-default);
                }
                
                body {
                    background-color: var(--color-canvas-default);
                    color: var(--color-fg-default);
                }
                
                h1, h2, h3, h4, h5, h6 {
                    color: var(--color-fg-default);
                }
                
                blockquote {
                    color: var(--color-fg-muted);
                    border-left-color: var(--color-border-default);
                }
                
                th {
                    background-color: var(--color-canvas-subtle);
                    color: var(--color-fg-default);
                }
                
                th, td {
                    border-color: var(--color-border-default);
                }
                
                code {
                    background-color: var(--color-neutral-muted);
                    color: var(--color-fg-default);
                }
                
                a {
                    color: var(--color-accent-fg);
                }
            `
    }
    catch (error) {
      console.error('Failed to get theme CSS:', error)
      return ''
    }
  }

  private getNonce(): string {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
  }

  private setupScrollSync(document: vscode.TextDocument) {
    // 清理之前的滚动同步监听器
    this.disposeScrollSync()

    this._currentDocument = document

    // 检查是否启用滚动同步
    const config = vscode.workspace.getConfiguration('markdownPreview')
    const syncScrollEnabled = config.get<boolean>('syncScroll', true)
    if (!syncScrollEnabled) return

    // 防抖处理编辑器滚动事件
    const scrollDisposable = vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (event.textEditor.document === document && this._panel && this._scrollSource !== 'preview') {
        this.syncEditorScrollToPreview(event.textEditor)
      }
    })
    this._scrollSyncDisposables.push(scrollDisposable)

    // 监听编辑器变化
    const editorChangeDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
      const documentUri = document.uri.toString()
      for (const editor of editors) {
        if (editor.document.uri.toString() === documentUri && this._panel) {
          this.syncEditorScrollToPreview(editor)
          break
        }
      }
    })
    this._scrollSyncDisposables.push(editorChangeDisposable)
  }

  private syncEditorScrollToPreview(editor: vscode.TextEditor) {
    if (!this._panel || !this._currentDocument || this._scrollSource === 'preview') {
      return
    }

    const config = vscode.workspace.getConfiguration('markdownPreview')
    const syncScrollEnabled = config.get<boolean>('syncScroll', true)
    if (!syncScrollEnabled) return

    const visibleRange = editor.visibleRanges[0]
    if (!visibleRange) return

    const totalLines = editor.document.lineCount
    if (totalLines === 0) return

    // 使用可见区域中间位置计算滚动比例
    const middleLine = Math.floor((visibleRange.start.line + visibleRange.end.line) / 2)
    const scrollRatio = Math.max(0, Math.min(1, middleLine / Math.max(1, totalLines - 1)))

    // 设置滚动源并发送消息
    this._scrollSource = 'editor'
    this._panel.webview.postMessage({
      command: 'scrollToPercentage',
      percentage: scrollRatio,
      source: 'editor'
    })

    // 延迟重置滚动源，避免死循环
    if (this._scrollTimeout) {
      clearTimeout(this._scrollTimeout)
    }
    this._scrollTimeout = setTimeout(() => {
      this._scrollSource = 'none'
    }, 100)
  }

  private handlePreviewScroll(scrollPercentage: number, source?: string, timestamp?: number) {
    if (!this._currentDocument || source === 'editor' || this._scrollSource === 'editor') {
      return
    }

    const config = vscode.workspace.getConfiguration('markdownPreview')
    const syncScrollEnabled = config.get<boolean>('syncScroll', true)
    if (!syncScrollEnabled) return

    // 使用文档URI查找对应的编辑器
    const documentUri = this._currentDocument.uri.toString()
    let targetEditor: vscode.TextEditor | undefined

    // 优先使用活动编辑器
    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor && activeEditor.document.uri.toString() === documentUri) {
      targetEditor = activeEditor
    } else {
      // 查找所有可见的编辑器
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.toString() === documentUri) {
          targetEditor = editor
          break
        }
      }
    }

    if (!targetEditor) return

    try {
      const totalLines = this._currentDocument.lineCount
      if (totalLines === 0) return

      const targetLine = Math.min(
        Math.floor(scrollPercentage * Math.max(0, totalLines - 1)),
        totalLines - 1
      )
      const range = new vscode.Range(targetLine, 0, targetLine, 0)
      
      // 设置滚动源并即时滚动编辑器
      this._scrollSource = 'preview'
      targetEditor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
      
      // 立即重置滚动源，无延迟
      this._scrollSource = 'none'
    } catch (error) {
      console.error('Error syncing preview scroll to editor:', error)
    }
  }

  private disposeScrollSync() {
    // 清理滚动同步相关的监听器
    this._scrollSyncDisposables.forEach(disposable => disposable.dispose())
    this._scrollSyncDisposables = []
    
    // 清理滚动超时
    if (this._scrollTimeout) {
      clearTimeout(this._scrollTimeout)
      this._scrollTimeout = undefined
    }
  }

  dispose() {
    // 取消所有防抖函数的待执行操作
    this.debouncedUpdateContent.cancel()

    // 清理滚动同步
    this.disposeScrollSync()

    // 清理面板
    if (this._panel) {
      this._panel.dispose()
      this._panel = undefined
    }
  }
}
