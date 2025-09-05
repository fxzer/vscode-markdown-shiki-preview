import type { Highlighter } from 'shiki'
import chroma from 'chroma-js'
import { bundledThemes } from 'shiki'

/**
 * 主题渲染器类
 * 负责处理所有与主题相关的CSS生成和颜色处理逻辑
 * 遵循单一职责原则，专注于主题渲染功能
 */
export class ThemeRenderer {
  constructor(private highlighter?: Highlighter) {}

  /**
   * 设置高亮器实例
   */
  setHighlighter(highlighter: Highlighter) {
    this.highlighter = highlighter
  }

  /**
   * 获取主题的CSS样式
   * @param theme 主题名称
   * @returns CSS样式字符串
   */
  getThemeCSS(theme: string): string {
    if (!this.highlighter)
      return ''

    try {
      // 获取主题的CSS变量
      const themeData = this.highlighter.getTheme(theme)
      if (!themeData || !themeData.colors)
        return ''

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
      const themeColors = { ...baseColors, ...themeData.colors }

      // 检测主题类型
      const isDarkTheme = this.detectThemeType(themeColors['editor.background'])

      // 生成增强的颜色变量，不影响原始主题
      const enhancedColors = this.generateEnhancedColors(themeColors, isDarkTheme)

      // 合并原始主题变量和增强变量
      const allColors = { ...themeColors, ...enhancedColors }

      // 生成CSS变量字符串
      const cssVariables = Object.entries(allColors)
        .map(([key, value]) => `--${key.replace('.', '-')}: ${value};`)
        .join('\n                    ')

      return `
                :root {
                    ${cssVariables}
                }
                
                body {
                    background-color: var(--editor-background);
                    color: var(--editor-foreground);
                }
                
                h1, h2, h3, h4, h5, h6 {
                    color: var(--editor-foreground);
                }
                
                blockquote {
                    color: var(--editorLineNumber-foreground);
                    background-color: var(--markdown-blockQuote-background, var(--textBlockQuote-background));
                    border-left: 4px solid var(--markdown.table.border, var(--panel-border));
                    padding: 12px 16px;
                    margin: 16px 0;
                    border-radius: 6px;
                }
                
                table {
                    border-collapse: collapse;
                    margin-bottom: 16px;
                    width: 100%;
                }
                
                th, td {
                    padding: 8px 12px;
                    border: 0.5px solid var(--markdown-table-border, var(--panel-border));
                }
                
                th {
                    background-color: var(--markdown-tableHeader-background, var(--editor-lineHighlightBackground));
                    color: var(--editor-foreground);
                    font-weight: 600;
                }
                
                code {
                    background-color: var(--editor-foldBackground);
                    color: var(--editor-foreground);
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-size: 85%;
                }
                
                pre {
                    background-color: var(--markdown-codeBlock-background, var(--textCodeBlock-background));
                    border: 1px solid var(--markdown-table-border, var(--panel-border));
                    border-radius: 6px;
                    padding: 16px;
                    overflow-x: auto;
                }
                
                pre code {
                    background-color: transparent;
                    padding: 0;
                    border-radius: 0;
                    font-size: 100%;
                }
                
                a {
                    color: var(--textLink-foreground);
                    text-decoration: none;
                }
                
                a:hover {
                    text-decoration: underline;
                    opacity: 0.8;
                }
            `
    }
    catch (error) {
      console.error('Failed to get theme CSS:', error)
      return ''
    }
  }

  /**
   * 检测主题类型（深色或浅色）
   * @param backgroundColor 背景颜色
   * @returns 是否为深色主题
   */
  private detectThemeType(backgroundColor: string): boolean {
    // 使用chroma.js检测是否为深色主题
    if (!backgroundColor)
      return false

    try {
      const luminance = chroma(backgroundColor).luminance()
      return luminance < 0.5
    }
    catch {
      return false
    }
  }

  /**
   * 计算两个颜色之间的对比度
   * @param color1 第一个颜色
   * @param color2 第二个颜色
   * @returns 对比度值
   */
  private calculateContrast(color1: string, color2: string): number {
    // 使用chroma.js计算对比度
    try {
      return chroma.contrast(color1, color2)
    }
    catch {
      return 1
    }
  }


  /**
   * 生成增强的颜色变量
   * @param themeColors 主题颜色配置
   * @param isDark 是否为深色主题
   * @returns 增强的颜色配置
   */
  private generateEnhancedColors(themeColors: Record<string, string>, isDark: boolean): Record<string, string> {
    const enhanced: Record<string, string> = {}

    try {
      const background = themeColors['editor.background'] || '#ffffff'
      const bgColor = chroma(background)

      // 智能生成增强颜色变量，不影响原始主题

      // 表格表头背景色 - 基于主题背景色的微妙变化
      const tableHeaderBg = isDark
        ? bgColor.brighten(0.1).alpha(0.1).hex() // 深色主题轻微提亮
        : bgColor.darken(0.1).alpha(0.05).hex() // 亮色主题轻微加深
      enhanced['markdown.tableHeader.background'] = tableHeaderBg

      // 代码块背景色 - 基于主题背景的有区分度的版本
      const codeBgBase = themeColors['textCodeBlock.background'] || background
      const codeBgColor = chroma(codeBgBase)
      const codeBgAdjusted = isDark
        ? codeBgColor.brighten(0.2).alpha(0.15) // 深色主题代码块加亮
        : codeBgColor.darken(0.2).alpha(0.08) // 亮色主题代码块加深
      enhanced['markdown.codeBlock.background'] = codeBgAdjusted.hex()

      // 引用背景色 - 与主题协调的半透明背景
      const quoteBg = isDark
        ? bgColor.mix('slategray', 0.2).alpha(0.1) // 深色主题引用色
        : bgColor.mix('lightgray', 0.2).alpha(0.05) // 亮色主题引用色
      enhanced['markdown.blockQuote.background'] = quoteBg.hex()

      // 表格边框颜色 - 微妙的边框增强
      const borderBase = themeColors['panel.border'] || (isDark ? '#ffffff' : '#000000')
      const borderColor = chroma(borderBase).alpha(0.2) // 半透明处理
      enhanced['markdown.table.border'] = borderColor.hex()
    }
    catch (error) {
      console.error('增强颜色生成失败:', error)
      // 使用优雅回退
      enhanced['markdown.tableHeader.background'] = themeColors['editor.background'] || '#ffffff'
      enhanced['markdown.codeBlock.background'] = themeColors['editor.background'] || '#ffffff'
      enhanced['markdown.blockQuote.background'] = themeColors['editor.background'] || '#ffffff'
      enhanced['markdown.table.border'] = '#00000022'
    }

    return enhanced
  }

  /**
   * 智能调整颜色以确保足够的对比度
   * @param colors 颜色配置
   * @param isDark 是否为深色主题
   * @returns 调整后的颜色配置
   */
  smartAdjustColors(colors: Record<string, string>, isDark: boolean): Record<string, string> {
    const adjusted = { ...colors }

    try {
      const background = adjusted['editor.background']
      const foreground = adjusted['editor.foreground']

      // 使用chroma.js确保主要颜色有足够的对比度
      const minContrast = 4.5 // WCAG AA标准
      const currentContrast = this.calculateContrast(background, foreground)

      if (currentContrast < minContrast) {
        const bgColor = chroma(background)
        const bgLuminance = bgColor.luminance()

        // 使用chroma.js智能生成高对比度前景色
        const targetColor = isDark
          ? bgColor.luminance(bgLuminance + 0.6) // 深色背景用亮色前景
          : bgColor.luminance(bgLuminance - 0.6) // 亮色背景用深色前景

        // 限制颜色亮度避免极端，并保持色相
        const finalColor = isDark
          ? chroma(targetColor).luminance(0.8).hex()
          : chroma(targetColor).luminance(0.15).hex()

        adjusted['editor.foreground'] = finalColor
      }

      // 使用chroma.js调整代码块背景色
      const textCodeBackground = adjusted['textCodeBlock.background']
      if (textCodeBackground) {
        const bgColor = chroma(background)
        const codeColor = chroma(textCodeBackground)

        // 使用chroma.js计算颜色差异
        const delta = chroma.deltaE(bgColor, codeColor)

        // 如果差异太小，生成有区分的颜色
        if (delta < 10) {
          const adjustedCodeColor = isDark
            ? bgColor.mix('white', 0.1).alpha(0.2) // 深色背景上加亮
            : bgColor.mix('black', 0.1).alpha(0.1) // 亮色背景上加暗

          adjusted['textCodeBlock.background'] = adjustedCodeColor.hex()
        }
      }

      // 使用chroma.js调整面板边框颜色
      const borderColor = adjusted['panel.border']
      if (borderColor) {
        const bgColor = chroma(background)
        const borderChroma = chroma(borderColor)

        const delta = chroma.deltaE(bgColor, borderChroma)

        if (delta < 15) {
          const adjustedBorder = isDark
            ? bgColor.mix('white', 0.2).alpha(0.15) // 深色边框加亮
            : bgColor.mix('black', 0.2).alpha(0.15) // 亮色边框加暗

          adjusted['panel.border'] = adjustedBorder.hex()
        }
      }
    }
    catch (error) {
      console.error('颜色调整失败:', error)
      // 保持原色作为回退
    }

    return adjusted
  }

  /**
   * 验证主题是否有效
   * @param theme 主题名称
   * @returns 是否为有效主题
   */
  isValidTheme(theme: string): boolean {
    const validThemes = Object.keys(bundledThemes)
    return validThemes.includes(theme)
  }

  /**
   * 获取所有可用主题列表
   * @returns 主题名称数组
   */
  getAvailableThemes(): string[] {
    return Object.keys(bundledThemes)
  }
}
