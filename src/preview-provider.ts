import type { Highlighter } from 'shiki'
import { debounce } from 'lodash-es'
import MarkdownIt from 'markdown-it'
import { bundledLanguages, bundledThemes, createHighlighter } from 'shiki'
import * as vscode from 'vscode'
import { generateHtmlTemplate } from './html-template'
import { ThemeRenderer } from './theme-renderer'
import { getCurrentTheme, getFontFamily, getFontSize, getLineHeight, getSyncScroll, logger } from './utils'

export class MarkdownPreviewProvider implements vscode.WebviewPanelSerializer {
  private _panel: vscode.WebviewPanel | undefined
  private _md: MarkdownIt
  private _highlighter: Highlighter | undefined
  private _themeRenderer: ThemeRenderer
  private _currentShikiTheme: string
  private _themeChanged: boolean = false // 标记主题是否已更改，强制重新渲染

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
    // 使用改进的配置获取策略，按VSCode优先级获取主题
    // 如果都没有配置，默认使用 'vitesse-dark'
    this._currentShikiTheme = getCurrentTheme()

    logger.info(`MarkdownPreviewProvider 初始化，使用主题: ${this._currentShikiTheme}`)

    // 初始化主题渲染器
    this._themeRenderer = new ThemeRenderer()

    this._md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
    })

    // 初始化 lodash 防抖函数 [[memory:7983867]]
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
    }
    else {
      this._panel.title = 'Markdown Preview'
    }
  }

  private async initializeHighlighter() {
    try {
      this._highlighter = await createHighlighter({
        themes: Object.keys(bundledThemes),
        langs: Object.keys(bundledLanguages),
      })

      // 设置主题渲染器的高亮器实例
      this._themeRenderer.setHighlighter(this._highlighter)

      // 不再硬编码主题，使用构造函数中从配置读取的主题
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

      // 应用当前配置的主题，使用改进的配置获取策略
      const configTheme = getCurrentTheme()
      if (configTheme !== this._currentShikiTheme) {
        logger.info(`showPreview: 更新主题从 ${this._currentShikiTheme} 到 ${configTheme}`)
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

    // 应用当前配置的主题，使用改进的配置获取策略
    const configTheme = getCurrentTheme()
    if (configTheme !== this._currentShikiTheme) {
      logger.info(`deserializeWebviewPanel: 更新主题从 ${this._currentShikiTheme} 到 ${configTheme}`)
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
    logger.info('[updateTheme] Received theme:', theme)
    logger.info('[updateTheme] Current _currentShikiTheme:', this._currentShikiTheme)

    // 强制更新主题，无论是否发生变化
    // 这确保了从设置更改主题时也能立即生效
    this._currentShikiTheme = theme
    this._themeChanged = true // 标记主题已更改，强制重新渲染

    logger.info('[updateTheme] Updated _currentShikiTheme:', this._currentShikiTheme)
    logger.info('[updateTheme] _themeChanged:', this._themeChanged)

    if (this._highlighter) {
      this.setupMarkdownRenderer()
    }

    // 如果预览窗口存在，立即更新预览内容
    if (this._panel && this._currentDocument) {
      logger.info('[updateTheme] Updating preview content...')
      // 清除HTML缓存，强制重新渲染
      this._panel.webview.html = ''
      // 重置文档URI缓存，确保内容被重新渲染
      this.lastUpdateDocumentUri = undefined
      await this.updateContent(this._currentDocument)
      logger.info('[updateTheme] Preview content updated')
    }
    // 如果预览窗口不存在，确保下次打开时使用新主题
    // 主题已经保存在 _currentShikiTheme 中，下次 showPreview 时会自动应用
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

    logger.info('[updateContent] _themeChanged:', this._themeChanged)
    logger.info('[updateContent] _currentShikiTheme:', this._currentShikiTheme)
    logger.info('[updateContent] lastUpdateDocumentUri:', this.lastUpdateDocumentUri)
    logger.info('[updateContent] documentUri:', documentUri)

    // 避免重复更新同一文档的相同内容
    // 但是如果主题已更改，则强制重新渲染
    if (!this._themeChanged && this.lastUpdateDocumentUri === documentUri && this._panel.webview.html.includes(content.substring(0, 100))) {
      logger.info('[updateContent] Skipping update - no theme change and same content')
      // 如果是同一个文档且内容没有显著变化，并且主题没有更改，跳过更新
      return
    }

    // 使用当前设置的主题（可能是预览主题或配置主题）
    let currentTheme = this._currentShikiTheme

    // 验证主题是否有效，如果无效则使用配置获取策略
    logger.info(`[updateContent] 验证主题: ${currentTheme}`)
    logger.info(`[updateContent] 主题是否有效: ${this._themeRenderer.isValidTheme(currentTheme)}`)

    if (!this._themeRenderer.isValidTheme(currentTheme)) {
      logger.warn('[updateContent] 当前主题无效，尝试修复...')

      // 使用改进的配置获取策略，传入文档URI以获取文件夹特定配置
      currentTheme = getCurrentTheme(document.uri)
      logger.info(`[updateContent] 从配置获取的备用主题: ${currentTheme}`)

      if (!this._themeRenderer.isValidTheme(currentTheme)) {
        logger.warn('[updateContent] 备用主题也无效，使用默认主题 vitesse-dark')
        currentTheme = 'vitesse-dark'

        // 同步修复配置 - 但避免循环触发
        logger.info('[updateContent] 更新配置为 vitesse-dark')
        try {
          const config = vscode.workspace.getConfiguration('markdownPreview')
          await config.update('currentTheme', currentTheme, vscode.ConfigurationTarget.Global)
        }
        catch (error) {
          logger.error('[updateContent] 更新配置失败:', error)
        }
      }

      this._currentShikiTheme = currentTheme
      this.setupMarkdownRenderer()
      logger.info(`[updateContent] 主题已修复为: ${currentTheme}`)
    }

    const html = this._md.render(content)

    // 使用改进的配置获取策略获取所有配置，传入文档URI以支持文件夹特定配置
    const fontSize = getFontSize(document.uri)
    const lineHeight = getLineHeight(document.uri)
    const fontFamily = getFontFamily(document.uri)

    logger.info('[updateContent] Generating HTML with theme:', currentTheme)
    this._panel.webview.html = this.getHtmlForWebview(html, currentTheme, fontSize, lineHeight, fontFamily)

    // 重置主题更改标志，表示已经完成渲染
    this._themeChanged = false
    logger.info('[updateContent] HTML updated and _themeChanged reset to false')
  }

  private getHtmlForWebview(content: string, theme: string, fontSize: number, lineHeight: number, fontFamily: string): string {
    const nonce = this.getNonce()
    const themeStyles = this._themeRenderer.getThemeCSS(theme, {
      fontSize,
      lineHeight,
      fontFamily,
    })

    return generateHtmlTemplate({
      content,
      themeStyles,
      nonce,
      extensionUri: this._extensionUri.toString(),
    })
  }

  /**
   * 生成一个随机的 nonce 字符串
   * 用于 Content Security Policy (CSP) 中的脚本安全验证
   * 生成一个32位长的随机字符串,包含大小写字母和数字
   * @returns 32位随机字符串
   */
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

    // 检查是否启用滚动同步，使用改进的配置获取策略
    const syncScrollEnabled = getSyncScroll(document.uri)
    if (!syncScrollEnabled) {
      logger.info('滚动同步已禁用')
      return
    }

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

    // 使用改进的配置获取策略
    const syncScrollEnabled = getSyncScroll(this._currentDocument.uri)
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

    // 使用改进的配置获取策略
    const syncScrollEnabled = getSyncScroll(this._currentDocument.uri)
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
