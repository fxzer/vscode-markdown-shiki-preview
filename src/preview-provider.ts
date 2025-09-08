import * as vscode from 'vscode'
import { configService } from './config-service'
import { ContentManager } from './content-manager'
import { ScrollSyncManager } from './scroll-sync-manager'
import { ThemeManager } from './theme-manager'
import { logger } from './utils'

export class MarkdownPreviewProvider implements vscode.WebviewPanelSerializer {
  private _panel: vscode.WebviewPanel | undefined
  private _scrollSyncManager: ScrollSyncManager
  private _themeManager: ThemeManager
  private _contentManager: ContentManager
  private _configurationChangeDisposable: vscode.Disposable | undefined

  constructor(private readonly _extensionUri: vscode.Uri) {
    // 初始化各个管理器
    this._themeManager = new ThemeManager()
    this._scrollSyncManager = new ScrollSyncManager()
    this._contentManager = new ContentManager(this._themeManager)

    logger.info(`MarkdownPreviewProvider 初始化完成`)

    // 监听配置变化，实时更新预览
    this.setupConfigurationChangeListeners()
  }

  private updatePanelTitle(document?: vscode.TextDocument) {
    if (!this._panel) {
      return
    }

    if (document) {
      const fileName = document.fileName.split('/').pop() || 'Unknown'
      this._panel.title = `预览 [${fileName}]`
    }
    else {
      this._panel.title = '预览'
    }
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

      // 设置面板到各个管理器
      this._scrollSyncManager.setPanel(this._panel)
      this._themeManager.setPanel(this._panel)
      this._contentManager.setPanel(this._panel)

      this._panel.onDidDispose(() => {
        // 清理内容管理器的状态
        this._contentManager.clearLastUpdateDocumentUri()
        this._panel = undefined
      })

      this._panel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.command) {
            case 'alert':
              vscode.window.showErrorMessage(message.text)
              break
            case 'scroll':
              this._scrollSyncManager.handlePreviewScroll(message.scrollPercentage, message.source, message.timestamp)
              break
            case 'openExternal':
              vscode.env.openExternal(vscode.Uri.parse(message.url))
              break
            case 'openRelativeFile':
              this.handleRelativeFileClick(message.filePath, message.href)
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

    // 首次创建面板时显示原生 loading 状态
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: '正在初始化 Markdown 预览...',
      cancellable: false,
    }, async (progress) => {
      progress.report({ increment: 0, message: '创建预览面板...' })

      // 设置当前文档到各个管理器
      progress.report({ increment: 20, message: '初始化管理器...' })
      this._themeManager.setCurrentDocument(document)
      this._contentManager.setCurrentDocument(document)

      // 更新内容和设置滚动同步
      progress.report({ increment: 40, message: '加载预览内容...' })
      await this._contentManager.updateContent(document, false) // 不显示进度条，因为外层已经有进度条了

      progress.report({ increment: 80, message: '设置滚动同步...' })
      this._scrollSyncManager.setupScrollSync(document)

      progress.report({ increment: 100, message: '初始化完成' })
    })

    // 设置面板标题
    this.updatePanelTitle(document)
  }

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
    this._panel = webviewPanel

    // 设置面板到各个管理器
    this._scrollSyncManager.setPanel(this._panel)
    this._themeManager.setPanel(this._panel)
    this._contentManager.setPanel(this._panel)

    webviewPanel.onDidDispose(() => {
      // 清理内容管理器的状态
      this._contentManager.clearLastUpdateDocumentUri()
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
            this._scrollSyncManager.handlePreviewScroll(message.scrollPercentage, message.source, message.timestamp)
            break
          case 'openExternal':
            vscode.env.openExternal(vscode.Uri.parse(message.url))
            break
          case 'openRelativeFile':
            this.handleRelativeFileClick(message.filePath, message.href)
            break
        }
      },
      undefined,
      [],
    )

    // 确保高亮器已初始化
    await this._themeManager.ensureHighlighterInitialized()

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
      else if (this._scrollSyncManager.getCurrentDocument()) {
        documentToRestore = this._scrollSyncManager.getCurrentDocument()
      }
    }

    // 如果找到了文档，更新内容和设置滚动同步
    if (documentToRestore) {
      // 设置当前文档到各个管理器
      this._themeManager.setCurrentDocument(documentToRestore)
      this._contentManager.setCurrentDocument(documentToRestore)

      await this._contentManager.updateContent(documentToRestore)
      this._scrollSyncManager.setupScrollSync(documentToRestore)
      this.updatePanelTitle(documentToRestore)
    }
  }

  isPreviewVisible(): boolean {
    return this._panel !== undefined && this._panel.visible
  }

  hasActivePanel(): boolean {
    return this._panel !== undefined
  }

  getCurrentDocument(): vscode.TextDocument | undefined {
    return this._contentManager.getCurrentDocument()
  }

  // 获取当前状态用于序列化
  getState(): any {
    return {
      documentUri: this._contentManager.getCurrentDocument()?.uri.toString(),
      theme: this._themeManager.getCurrentTheme(),
    }
  }

  // 优雅地切换到新文档，确保内容更新和滚动同步都正确设置
  public switchToDocument(document: vscode.TextDocument) {
    // 检查是否是同一个文档，避免不必要的重复设置
    const currentDoc = this._contentManager.getCurrentDocument()
    if (currentDoc && currentDoc.uri.toString() === document.uri.toString()) {
      return
    }

    // 更新标签页标题
    this.updatePanelTitle(document)

    // 设置当前文档到各个管理器
    this._themeManager.setCurrentDocument(document)
    this._contentManager.setCurrentDocument(document)

    // 更新内容（带防抖）
    this._contentManager.updateContentDebounced(document)

    // 重新设置滚动同步，确保新文档的编辑器滚动能正确同步
    this._scrollSyncManager.setupScrollSync(document)
  }

  // 带防抖的内容更新方法
  updateContentDebounced(document: vscode.TextDocument) {
    this._contentManager.updateContentDebounced(document)
  }

  // 直接更新内容
  async updateContent(document: vscode.TextDocument) {
    // 设置当前文档到各个管理器
    this._themeManager.setCurrentDocument(document)
    this._contentManager.setCurrentDocument(document)

    await this._contentManager.updateContent(document)
    this.updatePanelTitle(document)
  }

  // 更新主题
  async updateTheme(theme: string) {
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: '正在切换主题...',
      cancellable: false,
    }, async (progress) => {
      progress.report({ increment: 0, message: '应用新主题...' })
      await this._themeManager.updateTheme(theme)
      progress.report({ increment: 100, message: '主题切换完成' })
    })
  }

  // 处理相对路径文件点击
  private async handleRelativeFileClick(filePath: string) {
    try {
      const currentDocument = this._contentManager.getCurrentDocument()
      if (!currentDocument) {
        vscode.window.showErrorMessage('无法获取当前文档信息')
        return
      }

      // 解析相对路径
      const currentDir = vscode.Uri.file(currentDocument.fileName).with({ path: currentDocument.fileName.split('/').slice(0, -1).join('/') })
      const targetFile = vscode.Uri.joinPath(currentDir, filePath)

      // 检查文件是否存在
      try {
        await vscode.workspace.fs.stat(targetFile)
      }
      catch {
        vscode.window.showErrorMessage(`文件不存在: ${filePath}`)
        return
      }

      // 打开文件
      const document = await vscode.workspace.openTextDocument(targetFile)
      // const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One)

      // 如果预览窗口存在，切换到新文档
      if (this._panel) {
        this.switchToDocument(document)
      }

      logger.info(`已打开相对路径文件: ${filePath}`)
    }
    catch (error) {
      logger.error('处理相对路径文件点击时出错:', error)
      vscode.window.showErrorMessage(`无法打开文件: ${filePath}`)
    }
  }

  /**
   * 设置配置变化监听器，当配置改变时自动更新预览
   */
  private setupConfigurationChangeListeners() {
    const disposables: vscode.Disposable[] = []

    // 监听主题变化
    disposables.push(
      configService.onConfigChange<string>('currentTheme', (theme) => {
        if (this._panel) {
          logger.info('主题配置发生变化，立即更新主题')
          this._themeManager.updateTheme(theme)
        }
      }),
    )

    // 监听非主题配置的变化
    const styleConfigMapping: Record<string, string> = {
      documentWidth: '--document-width',
      fontSize: '--font-size',
      lineHeight: '--line-height',
      fontFamily: '--font-family',
    }

    Object.entries(styleConfigMapping).forEach(([configKey, cssVar]) => {
      disposables.push(
        configService.onConfigChange(configKey as any, (newValue) => {
          if (this._panel) {
            logger.info(`样式配置 ${configKey} 发生变化，发送样式更新消息`)
            let cssValue = String(newValue)
            if (configKey === 'fontSize') {
              cssValue += 'px'
            }
            this._panel.webview.postMessage({
              command: 'update-style',
              key: cssVar,
              value: cssValue,
            })
          }
        }),
      )
    })

    // 监听滚动同步配置的变化
    disposables.push(
      configService.onConfigChange<boolean>('syncScroll', (enabled) => {
        if (enabled) {
          this._scrollSyncManager.enableScrollSync()
        }
        else {
          this._scrollSyncManager.disableScrollSync()
        }
      }),
    )

    // 监听 Mermaid 预览配置的变化
    disposables.push(
      configService.onConfigChange<boolean>('enableMermaid', (enabled) => {
        if (this._panel) {
          logger.info(`Mermaid 预览配置发生变化，新值: ${enabled}`)
          // 通知 WebView 更新 Mermaid 状态
          this._panel.webview.postMessage({
            command: 'toggleMermaid',
            enabled,
          })

          // 强制更新内容以重新渲染 Mermaid 代码块
          if (this._contentManager.getCurrentDocument()) {
            this.updateContent(this._contentManager.getCurrentDocument()!)
          }
        }
      }),
    )

    this._configurationChangeDisposable = vscode.Disposable.from(...disposables)
  }

  dispose() {
    // 清理各个管理器
    this._scrollSyncManager.dispose()
    this._themeManager.dispose()
    this._contentManager.dispose()

    // 清理配置变化监听器
    if (this._configurationChangeDisposable) {
      this._configurationChangeDisposable.dispose()
      this._configurationChangeDisposable = undefined
    }

    // 清理面板
    if (this._panel) {
      this._panel.dispose()
      this._panel = undefined
    }

    // 清理内容管理器的状态
    this._contentManager.resetState()

    logger.info('MarkdownPreviewProvider 已完全清理')
  }
}
