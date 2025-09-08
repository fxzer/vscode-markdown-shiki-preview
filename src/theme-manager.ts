import type { Highlighter } from 'shiki'
import { container } from '@mdit/plugin-container'
import { katex } from '@mdit/plugin-katex'
import * as matter from 'gray-matter'
import MarkdownIt from 'markdown-it'
import { createHighlighter } from 'shiki'
import * as vscode from 'vscode'
import { configService } from './config-service'
import { generateHtmlTemplate } from './html-template'
import { ThemeRenderer } from './theme-renderer'
import { logger } from './utils'

/**
 * 主题管理器
 * 负责管理主题切换、高亮器和Markdown渲染器
 */
export class ThemeManager {
  private _highlighter: Highlighter | undefined
  private _themeRenderer: ThemeRenderer
  private _currentShikiTheme: string
  private _themeChanged: boolean = false // 标记主题是否已更改，强制重新渲染
  private _md: MarkdownIt
  private _panel: vscode.WebviewPanel | undefined
  private _currentDocument: vscode.TextDocument | undefined

  constructor() {
    // 使用配置服务获取主题
    this._currentShikiTheme = configService.getCurrentTheme()

    logger.info(`ThemeManager 初始化，使用主题: ${this._currentShikiTheme}`)

    // 初始化主题渲染器
    this._themeRenderer = new ThemeRenderer()

    this._md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
    })

    // 集成 KaTeX 数学公式支持
    this._md.use(katex, { strict: false })

    // 集成自定义容器支持
    this._md.use(container, {
      name: 'info',
      marker: ':',
      validate: params => params.trim().split(' ', 2)[0] === 'info',
      openRender: () => {
        return '<div class="custom-container info">\n'
      },
      closeRender: () => {
        return '</div>\n'
      },
    })

    this._md.use(container, {
      name: 'warning',
      marker: ':',
      validate: params => params.trim().split(' ', 2)[0] === 'warning',
      openRender: () => {
        return '<div class="custom-container warning">\n'
      },
      closeRender: () => {
        return '</div>\n'
      },
    })

    this._md.use(container, {
      name: 'danger',
      marker: ':',
      validate: params => params.trim().split(' ', 2)[0] === 'danger',
      openRender: () => {
        return '<div class="custom-container danger">\n'
      },
      closeRender: () => {
        return '</div>\n'
      },
    })

    this._md.use(container, {
      name: 'tip',
      marker: ':',
      validate: params => params.trim().split(' ', 2)[0] === 'tip',
      openRender: () => {
        return '<div class="custom-container tip">\n'
      },
      closeRender: () => {
        return '</div>\n'
      },
    })

    // 集成details容器支持
    this._md.use(container, {
      name: 'details',
      marker: ':',
      validate: (params) => {
        // @mdit/plugin-container 的验证函数
        // 返回 true 表示接受这个容器
        return params.trim().startsWith('details')
      },
      openRender: (tokens, idx, _options, _env, _self) => {
        const token = tokens[idx]
        const info = token.info.trim()

        // 默认值
        let summary = '点击展开'
        let attributes = ''
        let isOpen = false

        // 解析参数
        if (info !== 'details') {
          // 提取标题 [标题]
          const titleMatch = info.match(/^details\s*\[([^\]]+)\]/)
          if (titleMatch && titleMatch[1]) {
            summary = titleMatch[1]
          }

          // 检查是否默认展开 {open}
          if (info.includes('{open}')) {
            isOpen = true
          }

          // 提取ID #id
          const idMatch = info.match(/#([^\s{#.]+)/)
          if (idMatch) {
            attributes += ` id="${idMatch[1]}"`
          }

          // 提取类名 .class
          const classMatches = info.match(/\.([^\s{#.]+)/g)
          if (classMatches) {
            const classes = classMatches.map(match => match.substring(1)).join(' ')
            attributes += ` class="${classes}"`
          }

          // 提取其他属性 {key="value"}
          const attrMatches = info.match(/\{([^}]+)\}/g)
          if (attrMatches) {
            attrMatches.forEach((match) => {
              const content = match.slice(1, -1) // 去掉 { 和 }
              if (content !== 'open') { // 已经处理过 open
                const parts = content.split('=')
                if (parts.length === 2) {
                  const key = parts[0].trim()
                  const value = parts[1].trim().replace(/^["']|["']$/g, '')
                  attributes += ` ${key}="${value}"`
                }
              }
            })
          }
        }

        return `<details${attributes}${isOpen ? ' open' : ''}>
<summary>${summary}</summary>
<div class="details-inner">
`
      },
      closeRender: () => {
        return `</div>
</details>
`
      },
    })

    this.initializeHighlighter()
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
   * 初始化高亮器
   */
  private async initializeHighlighter(): Promise<void> {
    try {
      // 定义一个默认加载的语言子集，以加快初始化速度
      const defaultLangs = [
        'markdown',
        'md',
        'javascript',
        'js',
        'typescript',
        'ts',
        'json',
        'html',
        'css',
        'python',
        'py',
        'bash',
        'shell',
        'sh',
        'yaml',
      ]

      // 确保默认主题和用户配置的主题被初始加载
      const initialThemes = new Set<string>(['vitesse-dark', 'vitesse-light'])
      initialThemes.add(this._currentShikiTheme)

      this._highlighter = await createHighlighter({
        themes: Array.from(initialThemes),
        langs: defaultLangs,
      })

      // 设置主题渲染器的高亮器实例
      this._themeRenderer.setHighlighter(this._highlighter)

      // 设置Markdown渲染器
      this.setupMarkdownRenderer()
      logger.info('Shiki highlighter 初始化成功')
    }
    catch (error) {
      logger.error('Shiki highlighter 初始化失败:', error)
      vscode.window.showErrorMessage('Markdown 预览高亮器初始化失败，某些功能可能无法正常工作')

      // 创建一个最小可用的高亮器作为后备
      try {
        this._highlighter = await createHighlighter({
          themes: ['vitesse-dark'],
          langs: ['text'],
        })
        this._themeRenderer.setHighlighter(this._highlighter)
        this.setupMarkdownRenderer()
        logger.info('使用最小配置重新初始化高亮器成功')
      }
      catch (fallbackError) {
        logger.error('最小配置高亮器初始化也失败:', fallbackError)
        this._highlighter = undefined
      }
    }
  }

  /**
   * 设置Markdown渲染器
   */
  private setupMarkdownRenderer(): void {
    if (!this._highlighter) {
      return
    }

    // 保存默认的fence渲染器
    const defaultFenceRenderer = this._md.renderer.rules.fence || function (tokens, idx, options, _env, self) {
      return self.renderToken(tokens, idx, options)
    }

    // 自定义fence渲染器以支持Mermaid
    this._md.renderer.rules.fence = (tokens, idx, options, _env, self) => {
      const token = tokens[idx]
      const info = token.info ? token.info.trim() : ''

      // 检查是否是Mermaid代码块
      if (info === 'mermaid') {
        // 检查是否启用了Mermaid预览
        const enableMermaid = configService.getEnableMermaid(this._currentDocument?.uri)

        if (enableMermaid) {
          const code = token.content.trim()
          const id = `mermaid-${idx}-${Date.now()}`

          // 直接返回mermaid div，让前端JS处理
          return `<div class="mermaid" id="${id}">${code}</div>`
        }
        else {
          // 如果未启用Mermaid预览，作为普通代码块处理
          return defaultFenceRenderer(tokens, idx, options, _env, self)
        }
      }

      // 对于非Mermaid代码块，使用默认的高亮渲染
      return defaultFenceRenderer(tokens, idx, options, _env, self)
    }

    this._md.set({
      highlight: (code, lang) => {
        if (!this._highlighter) {
          return `<pre><code>${code}</code></pre>`
        }

        // 检查语言是否已加载
        const loadedLanguages = this._highlighter.getLoadedLanguages()
        const targetLang = lang || 'text'

        if (!loadedLanguages.includes(targetLang as any)) {
          // 如果语言未加载，返回未经高亮的代码块
          // 实际的加载逻辑将在 renderMarkdown 中处理
          logger.warn(`语言 '${targetLang}' 尚未加载，将以纯文本呈现。`)
          return `<pre><code class="language-${targetLang}">${this._md.utils.escapeHtml(code)}</code></pre>`
        }

        try {
          return this._highlighter.codeToHtml(code, {
            lang: targetLang,
            theme: this._currentShikiTheme,
          })
        }
        catch (error) {
          logger.error(`使用 Shiki 高亮代码失败 (语言: ${targetLang}):`, error)
          return this._highlighter.codeToHtml(code, {
            lang: 'text',
            theme: this._currentShikiTheme,
          })
        }
      },
    })
  }

  /**
   * 更新主题
   */
  public async updateTheme(theme: string): Promise<void> {
    try {
      logger.info('[updateTheme] Received theme:', theme)
      logger.info('[updateTheme] Current _currentShikiTheme:', this._currentShikiTheme)

      // 验证主题名称是否有效
      if (!theme || typeof theme !== 'string') {
        throw new Error(`无效的主题名称: ${theme}`)
      }

      // 如果高亮器存在，按需加载新主题
      if (this._highlighter && !this._highlighter.getLoadedThemes().includes(theme as any)) {
        try {
          logger.info(`[updateTheme] 主题 '${theme}' 尚未加载，正在加载...`)
          await this._highlighter.loadTheme(theme as any)
          logger.info(`[updateTheme] 主题 '${theme}' 加载成功。`)
        }
        catch (error) {
          logger.error(`[updateTheme] 加载主题 '${theme}' 失败:`, error)
          vscode.window.showErrorMessage(`加载主题 '${theme}' 失败。`)
          // 如果加载失败，则不切换主题
          return
        }
      }

      // 强制更新主题，无论是否发生变化
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

        // 直接调用 content-manager 的 updateContent 方法，确保配置状态同步
        try {
          // 通过 content-manager 更新内容，确保配置状态跟踪正确
          // 这里我们需要一个引用到 content-manager，但现在我们直接更新内容
          const content = this._currentDocument.getText()
          const parsed = matter.default(content)
          const markdownContent = parsed.content

          const html = await this.renderMarkdown(markdownContent)

          // 获取配置
          const fontSize = configService.getFontSize(this._currentDocument.uri)
          const lineHeight = configService.getLineHeight(this._currentDocument.uri)
          const fontFamily = configService.getFontFamily(this._currentDocument.uri)
          const documentWidth = configService.getDocumentWidth(this._currentDocument.uri)

          // 生成新的HTML
          const themeRenderer = this.getThemeRenderer()
          const themeStyles = themeRenderer.getThemeCSS(this._currentShikiTheme, {
            fontSize,
            lineHeight,
            fontFamily,
            documentWidth,
          })

          // 直接更新webview内容
          this._panel.webview.html = this.generateHtmlForWebview(html, {
            theme: this._currentShikiTheme,
            themeStyles,
            fontSize,
            lineHeight,
            fontFamily,
            documentWidth,
          })

          logger.info('[updateTheme] Preview content updated successfully')
        }
        catch (error) {
          logger.error('[updateTheme] Error updating preview content:', error)
          // 如果更新失败，尝试重新加载整个内容
          this._panel.webview.postMessage({
            command: 'reloadContent',
            theme: this._currentShikiTheme,
          })
        }
      }
    }
    catch (error) {
      logger.error('更新主题失败:', error)
      vscode.window.showErrorMessage(`主题更新失败: ${error instanceof Error ? error.message : '未知错误'}`)

      // 恢复到之前的主题
      if (this._panel && this._currentDocument) {
        try {
          // 重新生成内容以恢复之前的主题
          const content = this._currentDocument.getText()
          const parsed = matter.default(content)
          const markdownContent = parsed.content

          const html = await this.renderMarkdown(markdownContent)

          // 获取配置
          const fontSize = configService.getFontSize(this._currentDocument.uri)
          const lineHeight = configService.getLineHeight(this._currentDocument.uri)
          const fontFamily = configService.getFontFamily(this._currentDocument.uri)
          const documentWidth = configService.getDocumentWidth(this._currentDocument.uri)

          // 生成新的HTML
          const themeRenderer = this.getThemeRenderer()
          const themeStyles = themeRenderer.getThemeCSS(this._currentShikiTheme, {
            fontSize,
            lineHeight,
            fontFamily,
            documentWidth,
          })

          // 直接更新webview内容
          this._panel.webview.html = this.generateHtmlForWebview(html, {
            theme: this._currentShikiTheme,
            themeStyles,
            fontSize,
            lineHeight,
            fontFamily,
            documentWidth,
          })
        }
        catch (recoveryError) {
          logger.error('恢复主题失败:', recoveryError)
        }
      }
    }
  }

  /**
   * 获取当前主题
   */
  public getCurrentTheme(): string {
    return this._currentShikiTheme
  }

  /**
   * 检查主题是否已更改
   */
  public hasThemeChanged(): boolean {
    return this._themeChanged
  }

  /**
   * 强制设置主题已更改标志
   */
  public forceThemeChanged(): void {
    this._themeChanged = true
    logger.info('[forceThemeChanged] Theme change flag forced to true')
  }

  /**
   * 重置主题更改标志
   */
  public resetThemeChanged(): void {
    this._themeChanged = false
  }

  /**
   * 获取Markdown渲染器
   */
  public getMarkdownRenderer(): MarkdownIt {
    return this._md
  }

  /**
   * 异步渲染Markdown内容，处理语言的按需加载
   * @param markdownContent 要渲染的Markdown字符串
   * @returns 渲染后的HTML字符串
   */
  public async renderMarkdown(markdownContent: string): Promise<string> {
    if (!this._highlighter) {
      logger.warn('高亮器未初始化，将使用无高亮的渲染。')
      return this._md.render(markdownContent)
    }

    // 1. 解析Markdown获取所有代码块的语言
    const tokens = this._md.parse(markdownContent, {})
    const languages = new Set<string>()
    for (const token of tokens) {
      if (token.type === 'fence') {
        const lang = token.info.split(/\s+/g)[0] // e.g., "js {line-numbers}" -> "js"
        if (lang) {
          languages.add(lang)
        }
      }
    }

    // 2. 识别哪些语言需要被加载
    const loadedLanguages = this._highlighter.getLoadedLanguages()
    const languagesToLoad = Array.from(languages).filter(
      lang => !loadedLanguages.includes(lang as any),
    )

    // 3. 如果有需要加载的语言，则进行加载
    if (languagesToLoad.length > 0) {
      logger.info(`需要加载的语言: ${languagesToLoad.join(', ')}`)
      await Promise.all(
        languagesToLoad.map(async (lang) => {
          try {
            await this._highlighter?.loadLanguage(lang as any)
            logger.info(`语言 '${lang}' 加载成功。`)
          }
          catch (error) {
            logger.error(`加载语言 '${lang}' 失败:`, error)
            // 即使某个语言加载失败，也不应中断整个渲染过程
          }
        }),
      )
    }

    // 4. 所有需要的语言都已加载（或尝试加载）后，执行最终渲染
    return this._md.render(markdownContent)
  }

  /**
   * 获取主题渲染器
   */
  public getThemeRenderer(): ThemeRenderer {
    return this._themeRenderer
  }

  /**
   * 获取高亮器
   */
  public getHighlighter(): Highlighter | undefined {
    return this._highlighter
  }

  /**
   * 确保高亮器已初始化
   */
  public async ensureHighlighterInitialized(): Promise<void> {
    if (!this._highlighter) {
      await this.initializeHighlighter()
    }
  }

  /**
   * 验证并修复当前主题
   */
  public validateAndFixTheme(): string {
    let currentTheme = this._currentShikiTheme

    // 验证主题是否有效
    logger.info(`[validateAndFixTheme] 验证主题: ${currentTheme}`)
    logger.info(`[validateAndFixTheme] 主题是否有效: ${this._themeRenderer.isValidTheme(currentTheme)}`)

    if (!this._themeRenderer.isValidTheme(currentTheme)) {
      logger.warn('[validateAndFixTheme] 当前主题无效，尝试修复...')

      // 使用配置服务获取备用主题
      if (this._currentDocument) {
        currentTheme = configService.getCurrentTheme(this._currentDocument.uri)
      }
      else {
        currentTheme = configService.getCurrentTheme()
      }

      logger.info(`[validateAndFixTheme] 从配置获取的备用主题: ${currentTheme}`)

      if (!this._themeRenderer.isValidTheme(currentTheme)) {
        logger.warn('[validateAndFixTheme] 备用主题也无效，使用默认主题 vitesse-dark')
        currentTheme = 'vitesse-dark'

        // 同步修复配置
        logger.info('[validateAndFixTheme] 更新配置为 vitesse-dark')
        try {
          configService.updateConfig('currentTheme', currentTheme, vscode.ConfigurationTarget.Global)
        }
        catch (error) {
          logger.error('[validateAndFixTheme] 更新配置失败:', error)
          vscode.window.showWarningMessage('无法自动修复主题配置，请手动检查设置')
        }
      }

      this._currentShikiTheme = currentTheme
      this.setupMarkdownRenderer()
      logger.info(`[validateAndFixTheme] 主题已修复为: ${currentTheme}`)
    }

    return currentTheme
  }

  /**
   * 生成WebView HTML
   */
  private generateHtmlForWebview(content: string, config: {
    theme: string
    themeStyles: string
    fontSize: number
    lineHeight: number
    fontFamily: string
    documentWidth: string
  }): string {
    const nonce = this.getNonce()

    return generateHtmlTemplate({
      content,
      themeStyles: config.themeStyles,
      nonce,
      extensionUri: '', // 将在主类中设置
      documentWidth: config.documentWidth,
    })
  }

  /**
   * 生成一个随机的 nonce 字符串
   * 用于 Content Security Policy (CSP) 中的脚本安全验证
   */
  private getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const possibleLength = possible.length

    return Array.from({ length: 32 }, () =>
      possible.charAt(Math.floor(Math.random() * possibleLength))).join('')
  }

  /**
   * 完全销毁管理器
   */
  public dispose(): void {
    this._highlighter = undefined
    this._currentDocument = undefined
    this._panel = undefined
  }
}
