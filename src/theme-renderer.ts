import type { Highlighter } from 'shiki'
import { bundledThemes } from 'shiki'
import { generateThemeStyles } from './html-template'

/**
 * 主题渲染器类
 * 负责处理所有与主题相关的CSS生成和颜色处理逻辑
 * 遵循单一职责原则，专注于主题渲染功能
 */
export class ThemeRenderer {
  constructor(private highlighter?: Highlighter) { }
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

  /**
   * 设置高亮器实例
   */
  setHighlighter(highlighter: Highlighter) {
    this.highlighter = highlighter
  }

  /**
   * 获取主题的CSS样式
   * @param theme 主题名称
   * @param layoutOptions 布局选项
   * @param layoutOptions.fontSize 字体大小
   * @param layoutOptions.lineHeight 行高
   * @param layoutOptions.fontFamily 字体家族
   * @param layoutOptions.documentWidth 文档容器宽度
   * @returns CSS样式字符串
   */
  getThemeCSS(theme: string, layoutOptions?: {
    fontSize: number
    lineHeight: number
    fontFamily: string
    documentWidth?: string
  }): string {
    if (!this.highlighter)
      return ''

    try {
      // 获取主题的CSS变量
      const themeData = this.highlighter.getTheme(theme)
      if (!themeData || !themeData.colors)
        return ''

      const defaultLayoutOptions = {
        fontSize: 14,
        lineHeight: 1.6,
        fontFamily: 'Consolas, "Courier New", monospace',
        documentWidth: '1000px',
      }
      const finalLayoutOptions = {
        ...defaultLayoutOptions,
        ...layoutOptions,
      }
      const themeStyles = generateThemeStyles(themeData.colors, finalLayoutOptions)

      return themeStyles
    }
    catch (error) {
      console.error('Failed to generate theme CSS:', error)
      return ''
    }
  }
}
