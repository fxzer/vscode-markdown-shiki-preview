import type { Highlighter } from 'shiki'
import { debounce } from 'lodash-es'
import MarkdownIt from 'markdown-it'
import { bundledLanguages, bundledThemes, createHighlighter } from 'shiki'
import * as vscode from 'vscode'

export class MarkdownPreviewProvider implements vscode.WebviewPanelSerializer {
  private _panel: vscode.WebviewPanel | undefined
  private _md: MarkdownIt
  private _highlighter: Highlighter | undefined
  private _currentShikiTheme: string = 'github-light'

  // 内容更新防抖相关
  private lastUpdateDocumentUri: string | undefined // 记录最后更新的文档URI
  private debouncedUpdateContent: ReturnType<typeof debounce>

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

    this.initializeHighlighter()
  }

  private updatePanelTitle(document?: vscode.TextDocument) {
    if (!this._panel) {
      return
    }

    if (document) {
      const fileName = document.fileName.split('/').pop() || 'Unknown'
      this._panel.title = `Markdown Preview [${fileName}]`
    } else {
      this._panel.title = 'Markdown Preview'
    }
  }

  private async initializeHighlighter() {
    try {
      this._highlighter = await createHighlighter({
        themes: Object.keys(bundledThemes),
        langs: Object.keys(bundledLanguages),
      })

      this._currentShikiTheme = 'github-light'
      this.setupMarkdownRenderer()
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
          return this._highlighter.codeToHtml(code, {
            lang: lang || 'text',
            theme: this._currentShikiTheme,
          })
        }
        catch {
          return this._highlighter.codeToHtml(code, {
            lang: 'text',
            theme: this._currentShikiTheme,
          })
        }
      },
    })
  }

  async showPreview(document: vscode.TextDocument) {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Two)
    }
    else {
      this._panel = vscode.window.createWebviewPanel(
        'markdownPreview',
        'Markdown Preview',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this._extensionUri],
        },
      )

      // 应用当前配置的主题
      const config = vscode.workspace.getConfiguration('markdownPreview')
      const configTheme = config.get<string>('currentTheme', 'github-light')
      if (configTheme !== this._currentShikiTheme) {
        this._currentShikiTheme = configTheme
        this.setupMarkdownRenderer()
      }

      this._panel.onDidDispose(() => {
        this._panel = undefined
      })

      // webview选项已经在创建时设置，这里不需要重复设置

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

      // 保存状态用于序列化恢复
      const saveState = () => {
        if (this._panel) {
          this._panel.webview.postMessage({
            command: 'saveState',
            state: this.getState(),
          })
        }
      }

      // 定期保存状态
      const stateInterval = setInterval(saveState, 5000) // 每5秒保存一次状态
      this._panel.onDidDispose(() => {
        clearInterval(stateInterval)
      })
    }

    this.updateContent(document)
    this.setupScrollSync(document)
    this.updatePanelTitle(document)
  }

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
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

    // 确保高亮器已初始化
    if (!this._highlighter) {
      await this.initializeHighlighter()
    }

    // 应用当前配置的主题
    const config = vscode.workspace.getConfiguration('markdownPreview')
    const configTheme = config.get<string>('currentTheme', 'github-light')
    if (configTheme !== this._currentShikiTheme) {
      this._currentShikiTheme = configTheme
      this.setupMarkdownRenderer()
    }

    // 尝试从多个来源恢复文档
    let documentToRestore: vscode.TextDocument | undefined

    // 1. 首先检查活动编辑器
    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor && activeEditor.document.fileName.endsWith('.md')) {
      documentToRestore = activeEditor.document
    }
    // 2. 如果没有活动的Markdown编辑器，检查所有可见编辑器
    else {
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.fileName.endsWith('.md')) {
          documentToRestore = editor.document
          break
        }
      }
    }
    // 3. 最后尝试从状态或之前的文档恢复
    if (!documentToRestore) {
      // 从状态恢复文档URI（如果有的话）
      if (state && state.documentUri) {
        try {
          const uri = vscode.Uri.parse(state.documentUri)
          documentToRestore = await vscode.workspace.openTextDocument(uri)
        }
        catch (error) {
          console.warn('Failed to restore document from state:', error)
        }
      }
      // 或者使用之前的文档
      else if (this._currentDocument) {
        documentToRestore = this._currentDocument
      }
    }

    // 如果找到了文档，更新内容和设置滚动同步
    if (documentToRestore) {
      await this.updateContent(documentToRestore)
      this.setupScrollSync(documentToRestore)
      this.updatePanelTitle(documentToRestore)
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

  // 获取当前状态用于序列化
  getState(): any {
    return {
      documentUri: this._currentDocument?.uri.toString(),
      theme: this._currentShikiTheme,
    }
  }

  // 优雅地切换到新文档，确保内容更新和滚动同步都正确设置
  public switchToDocument(document: vscode.TextDocument) {
    // 检查是否是同一个文档，避免不必要的重复设置
    if (this._currentDocument && this._currentDocument.uri.toString() === document.uri.toString()) {
      return
    }

    // 更新标签页标题
    this.updatePanelTitle(document)

    // 更新内容（带防抖）
    this.updateContentDebounced(document)

    // 重新设置滚动同步，确保新文档的编辑器滚动能正确同步
    this.setupScrollSync(document)
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
    if (!this._panel) {
      return
    }

    if (!this._highlighter) {
      await this.initializeHighlighter()
    }

    // 确保 _currentDocument 被设置
    this._currentDocument = document

    // 更新标签页标题
    this.updatePanelTitle(document)

    const content = document.getText()
    const documentUri = document.uri.toString()

    // 避免重复更新同一文档的相同内容
    if (this.lastUpdateDocumentUri === documentUri && this._panel.webview.html.includes(content.substring(0, 100))) {
      // 如果是同一个文档且内容没有显著变化，跳过更新
      return
    }

    // 使用当前设置的主题（可能是预览主题或配置主题）
    let currentTheme = this._currentShikiTheme

    // 验证主题是否有效，如果无效则从配置获取
    const validThemes = Object.keys(bundledThemes)

    if (!validThemes.includes(currentTheme)) {
      const config = vscode.workspace.getConfiguration('markdownPreview')
      currentTheme = config.get<string>('currentTheme', 'github-light')

      if (!validThemes.includes(currentTheme)) {
        currentTheme = 'github-light'
        // 同步修复配置
        await config.update('currentTheme', currentTheme, vscode.ConfigurationTarget.Global)
      }

      this._currentShikiTheme = currentTheme
      this.setupMarkdownRenderer()
    }

    const html = this._md.render(content)
    const config = vscode.workspace.getConfiguration('markdownPreview')
    const fontSize = config.get<number>('fontSize', 14)
    const lineHeight = config.get<number>('lineHeight', 1.6)
    const fontFamily = config.get<string>('fontFamily', 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif')

    this._panel.webview.html = this.getHtmlForWebview(html, currentTheme, fontSize, lineHeight, fontFamily)
  }

  private getHtmlForWebview(content: string, theme: string, fontSize: number, lineHeight: number, fontFamily: string): string {
    const nonce = this.getNonce()

    // 获取主题CSS变量
    const themeStyles = this.getThemeCSS(theme)

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this._extensionUri}; script-src 'nonce-${nonce}'; img-src data: https:;">
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
                
                h1 { font-size: 2em; border-bottom: 1px solid var(--color-border-muted); padding-bottom: 0.3em; }
                h2 { font-size: 1.5em; border-bottom: 1px solid var(--color-border-muted); padding-bottom: 0.3em; }
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
                    
                    cachedViewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                    return cachedViewportHeight;
                }
                
                // 优化的滚动处理函数
                function handleScroll() {
                    if (isScrollingFromEditor) {
                        return;
                    }
                    
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
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
                window.addEventListener('resize', () => {
                    cachedDocumentHeight = 0;
                    cachedViewportHeight = 0;
                    heightCacheTime = 0;
                }, { passive: true });
                
                // 监听来自扩展的消息
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
                            
                            window.scrollTo({
                                top: targetScrollTop,
                                behavior: 'auto'
                            });
                            
                            // 延迟后重置标志，避免死循环，与编辑器端保持一致的延迟时间
                            setTimeout(() => {
                                isScrollingFromEditor = false;
                            }, 150);
                            break;
                    }
                });
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

  public setupScrollSync(document: vscode.TextDocument) {
    // 清理之前的滚动同步监听器
    this.disposeScrollSync()

    this._currentDocument = document

    // 检查是否启用滚动同步
    const config = vscode.workspace.getConfiguration('markdownPreview')
    const syncScrollEnabled = config.get<boolean>('syncScroll', true)
    if (!syncScrollEnabled)
      return

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
    if (!syncScrollEnabled)
      return

    const visibleRange = editor.visibleRanges[0]
    if (!visibleRange)
      return

    const totalLines = editor.document.lineCount
    if (totalLines === 0)
      return

    // 使用可见区域中间位置计算滚动比例
    const middleLine = Math.floor((visibleRange.start.line + visibleRange.end.line) / 2)
    const scrollRatio = Math.max(0, Math.min(1, middleLine / Math.max(1, totalLines - 1)))

    // 设置滚动源并发送消息
    this._scrollSource = 'editor'
    this._panel.webview.postMessage({
      command: 'scrollToPercentage',
      percentage: scrollRatio,
      source: 'editor',
    })

    // 延迟重置滚动源，避免死循环，与预览区保持一致的延迟时间
    if (this._scrollTimeout) {
      clearTimeout(this._scrollTimeout)
    }
    this._scrollTimeout = setTimeout(() => {
      this._scrollSource = 'none'
    }, 150)
  }

  private handlePreviewScroll(scrollPercentage: number, source?: string, _timestamp?: number) {
    if (!this._currentDocument || source === 'editor' || this._scrollSource === 'editor') {
      return
    }

    const config = vscode.workspace.getConfiguration('markdownPreview')
    const syncScrollEnabled = config.get<boolean>('syncScroll', true)
    if (!syncScrollEnabled)
      return

    // 使用文档URI查找对应的编辑器
    const documentUri = this._currentDocument.uri.toString()
    let targetEditor: vscode.TextEditor | undefined

    // 优先使用活动编辑器
    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor && activeEditor.document.uri.toString() === documentUri) {
      targetEditor = activeEditor
    }
    else {
      // 查找所有可见的编辑器
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.toString() === documentUri) {
          targetEditor = editor
          break
        }
      }
    }

    if (!targetEditor)
      return

    try {
      const totalLines = this._currentDocument.lineCount
      if (totalLines === 0)
        return

      const targetLine = Math.min(
        Math.floor(scrollPercentage * Math.max(0, totalLines - 1)),
        totalLines - 1,
      )
      const range = new vscode.Range(targetLine, 0, targetLine, 0)

      // 设置滚动源并即时滚动编辑器
      this._scrollSource = 'preview'
      targetEditor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)

      // 延迟重置滚动源，与编辑器端保持一致，避免循环滚动
      if (this._scrollTimeout) {
        clearTimeout(this._scrollTimeout)
      }
      this._scrollTimeout = setTimeout(() => {
        this._scrollSource = 'none'
      }, 150)
    }
    catch (error) {
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
