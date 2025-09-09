import * as matter from 'gray-matter'
import { debounce } from 'lodash-es'
import * as vscode from 'vscode'
import { configService } from './config-service'
import { generateHtmlTemplate } from './html-template'
import { getNonce, logger } from './utils'

/**
 * 内容管理器
 * 负责管理Markdown内容的渲染和更新
 */
export class ContentManager {
  private _panel: vscode.WebviewPanel | undefined
  private _currentDocument: vscode.TextDocument | undefined
  private _themeManager: any // 将在构造函数中设置类型
  private lastUpdateDocumentUri: string | undefined // 记录最后更新的文档URI
  private lastUpdateConfig: string = '' // 记录最后更新的配置
  private lastUpdateContentHash: string = '' // 记录最后更新的文档内容哈希
  private debouncedUpdateContent: ReturnType<typeof debounce>

  constructor(themeManager: any) {
    this._themeManager = themeManager

    // 初始化 lodash 防抖函数
    this.debouncedUpdateContent = debounce(this.performContentUpdate.bind(this), 400)
  }

  /**
   * 设置当前面板
   */
  public setPanel(panel: vscode.WebviewPanel | undefined): void {
    this._panel = panel
  }

  /**
   * 设置当前文档
   */
  public setCurrentDocument(document: vscode.TextDocument | undefined): void {
    this._currentDocument = document
  }

  /**
   * 计算文档内容的简单哈希值
   */
  private getContentHash(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return hash.toString()
  }

  /**
   * 更新内容（带防抖）
   */
  public updateContentDebounced(document: vscode.TextDocument): void {
    this.debouncedUpdateContent(document)
  }

  /**
   * 直接更新内容
   */
  public async updateContent(document: vscode.TextDocument, showProgress: boolean = true): Promise<void> {
    await this.performUpdateContent(document, false, showProgress)
  }

  /**
   * 强制更新内容（跳过内容哈希检查）
   */
  public async forceUpdateContent(document: vscode.TextDocument, showProgress: boolean = true): Promise<void> {
    await this.performUpdateContent(document, true, showProgress)
  }

  /**
   * 执行内容更新的内部方法
   */
  private async performUpdateContent(document: vscode.TextDocument, force: boolean = false, showProgress: boolean = true): Promise<void> {
    if (!this._panel) {
      return
    }

    // 根据参数决定是否显示进度条
    if (showProgress) {
      // 使用 VSCode 原生 Progress API 显示加载指示器
      return vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: '正在更新 Markdown 预览...',
        cancellable: false,
      }, async (progress) => {
        return this.executeContentUpdate(document, force, progress)
      })
    }
    else {
      // 不显示进度条，直接执行更新
      return this.executeContentUpdate(document, force, null)
    }
  }

  /**
   * 执行实际的内容更新逻辑
   */
  private async executeContentUpdate(document: vscode.TextDocument, force: boolean, progress: vscode.Progress<{ message?: string, increment?: number }> | null): Promise<void> {
    // 检查面板是否仍然有效
    if (!this._panel) {
      logger.info('[executeContentUpdate] Panel is disposed, skipping update')
      return
    }

    progress?.report({ increment: 0, message: '准备渲染内容...' })

    // 确保高亮器已初始化
    progress?.report({ increment: 20, message: '初始化语法高亮器...' })
    await this._themeManager.ensureHighlighterInitialized()

    // 设置当前文档
    this._currentDocument = document

    const rawContent = document.getText()
    const documentUri = document.uri.toString()

    // 使用 gray-matter 分离 front matter 和内容
    const parsed = matter.default(rawContent)
    const content = parsed.content // 只使用内容部分，忽略元数据

    // 计算内容哈希
    const contentHash = this.getContentHash(rawContent)

    // 获取当前配置的字符串表示，用于比较配置是否变化
    const currentConfig = JSON.stringify({
      theme: this._themeManager.getCurrentTheme(),
      fontSize: configService.getFontSize(document.uri),
      lineHeight: configService.getLineHeight(document.uri),
      fontFamily: configService.getFontFamily(document.uri),
      documentWidth: configService.getDocumentWidth(document.uri),
    })

    // 避免不必要的重复渲染
    // 检查配置和内容哈希
    if (!force
      && this.lastUpdateDocumentUri === documentUri
      && this.lastUpdateConfig === currentConfig
      && this.lastUpdateContentHash === contentHash) {
      logger.info('[updateContent] Skipping update - same document, config and content')
      return
    }

    // 验证并修复当前主题
    progress?.report({ increment: 30, message: '验证主题配置...' })
    const currentTheme = this._themeManager.validateAndFixTheme()

    // 异步渲染Markdown
    progress?.report({ increment: 40, message: '渲染 Markdown 内容...' })
    const htmlContent = await this._themeManager.renderMarkdown(content)

    // 如果不是强制更新（即只是内容变化），则发送增量更新消息
    if (!force && this.lastUpdateDocumentUri === documentUri) {
      // 再次检查面板是否仍然有效
      if (!this._panel) {
        logger.info('[updateContent] Panel is disposed, skipping incremental update')
        return
      }

      logger.info('[updateContent] Sending incremental update to webview')
      progress?.report({ increment: 80, message: '更新预览内容...' })
      this._panel.webview.postMessage({
        command: 'update-content',
        html: htmlContent,
      })
    }
    else {
      // 否则，执行完整的HTML更新
      logger.info('[updateContent] Performing full HTML update')
      progress?.report({ increment: 60, message: '生成完整 HTML...' })

      // 使用配置服务获取所有配置
      const fontSize = configService.getFontSize(document.uri)
      const lineHeight = configService.getLineHeight(document.uri)
      const fontFamily = configService.getFontFamily(document.uri)
      const documentWidth = configService.getDocumentWidth(document.uri)

      // 检查文档中是否包含Mermaid代码块
      const hasMermaid = content.includes('```mermaid')

      logger.info('[updateContent] Generating HTML with theme:', currentTheme)

      try {
        progress?.report({ increment: 80, message: '应用主题和样式...' })
        // 再次检查面板是否仍然有效
        if (!this._panel) {
          logger.info('[updateContent] Panel is disposed, skipping full HTML update')
          return
        }

        this._panel.webview.html = this.getHtmlForWebview(htmlContent, {
          theme: currentTheme,
          fontSize,
          lineHeight,
          fontFamily,
          documentWidth,
          hasMermaid,
        })
      }
      catch (error) {
        logger.error('生成 HTML 预览失败:', error)

        // 只有在面板仍然有效时才显示错误消息
        if (this._panel) {
          vscode.window.showErrorMessage('生成预览内容失败，请检查主题配置')

          // 只有在面板仍然有效时才尝试使用默认主题重新生成
          if (this._panel) {
            try {
              logger.info('尝试使用默认主题重新生成预览')
              this._panel.webview.html = this.getHtmlForWebview(htmlContent, {
                theme: 'vitesse-dark',
                fontSize,
                lineHeight,
                fontFamily,
                documentWidth,
                hasMermaid,
              })
            }
            catch (fallbackError) {
              logger.error('默认主题也失败:', fallbackError)
              // 再次检查面板是否仍然有效
              if (this._panel) {
                this._panel.webview.html = `<html><body><h2>预览生成失败</h2><p>错误: ${error instanceof Error ? error.message : '未知错误'}</p></body></html>`
              }
            }
          }
          else {
            logger.info('面板已销毁，跳过默认主题重试')
          }
        }
        else {
          logger.info('面板已销毁，跳过错误处理和重试')
        }
      }
    }

    // 更新缓存状态
    progress?.report({ increment: 100, message: '完成更新' })
    this.lastUpdateDocumentUri = documentUri
    this.lastUpdateConfig = currentConfig
    this.lastUpdateContentHash = contentHash
    // 重置主题更改标志，表示已经完成渲染
    this._themeManager.resetThemeChanged()
    logger.info('[updateContent] HTML updated and _themeChanged reset to false')
  }

  /**
   * 实际执行内容更新的方法（被防抖函数调用）
   */
  private async performContentUpdate(document: vscode.TextDocument): Promise<void> {
    try {
      // 强制更新内容，跳过内容哈希检查
      // 移除活动编辑器检查，因为相对链接跳转时新文档可能不是活动编辑器
      await this.forceUpdateContent(document, false)
    }
    catch (error) {
      logger.error('内容更新失败:', error)

      // 只有在面板仍然有效时才显示错误消息
      if (this._panel) {
        vscode.window.showErrorMessage('Markdown 预览内容更新失败，请检查文件格式')
      }
      else {
        logger.info('面板已销毁，跳过错误消息显示')
      }
    }
  }

  /**
   * 生成WebView HTML
   */
  private getHtmlForWebview(content: string, config: {
    theme: string
    fontSize: number
    lineHeight: number
    fontFamily: string
    documentWidth: string
    hasMermaid: boolean
  }): string {
    const nonce = getNonce()
    const themeRenderer = this._themeManager.getThemeRenderer()
    const themeStyles = themeRenderer.getThemeCSS(config.theme, {
      fontSize: config.fontSize,
      lineHeight: config.lineHeight,
      fontFamily: config.fontFamily,
      documentWidth: config.documentWidth,
    })

    return generateHtmlTemplate({
      content,
      themeStyles,
      nonce,
      extensionUri: '', // 将在主类中设置
      documentWidth: config.documentWidth,
      hasMermaid: config.hasMermaid,
    })
  }

  /**
   * 获取当前文档
   */
  public getCurrentDocument(): vscode.TextDocument | undefined {
    return this._currentDocument
  }

  /**
   * 获取最后更新的文档URI
   */
  public getLastUpdateDocumentUri(): string | undefined {
    return this.lastUpdateDocumentUri
  }

  /**
   * 清除最后更新的文档URI
   */
  public clearLastUpdateDocumentUri(): void {
    this.lastUpdateDocumentUri = undefined
    this.lastUpdateConfig = ''
    this.lastUpdateContentHash = ''
  }

  /**
   * 完全销毁管理器
   */
  public dispose(): void {
    // 取消所有防抖函数的待执行操作
    this.debouncedUpdateContent.cancel()

    this._currentDocument = undefined
    this._panel = undefined
    this.lastUpdateDocumentUri = undefined
    this.lastUpdateConfig = ''
    this.lastUpdateContentHash = ''
  }

  /**
   * 重置状态，用于面板关闭时清理
   */
  public resetState(): void {
    this.lastUpdateDocumentUri = undefined
    this.lastUpdateConfig = ''
    this.lastUpdateContentHash = ''
    this.debouncedUpdateContent.cancel()
  }
}
