/**
 * HTML模板生成器
 * 负责生成Markdown预览的HTML模板
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import Handlebars from 'handlebars'
import { generateEnhancedColors } from './color-hander'
import { isDarkColor } from './color-utils'

export interface HtmlTemplateOptions {
  /** 页面内容 */
  content: string
  /** 主题样式CSS */
  themeStyles: string
  /** CSP nonce */
  nonce: string
  /** 扩展URI */
  extensionUri: string
  /** 文档容器宽度 */
  documentWidth: string
}

/**
 * 主题样式配置 - 直接返回完整的样式字符串
 */
export type ThemeStylesConfig = string

// 预先读取静态CSS文件内容
const baseStylesPath = path.join(__dirname, 'webview', 'styles.css')
let baseStylesContent: string | null = null

function getBaseStyles(): string {
  if (!baseStylesContent) {
    baseStylesContent = fs.readFileSync(baseStylesPath, 'utf8')
  }
  return baseStylesContent
}

/**
 * 生成主题CSS样式
 * @param themeColors 主题颜色配置
 * @param layoutOptions 布局选项
 * @param layoutOptions.fontSize 字体大小
 * @param layoutOptions.lineHeight 行高
 * @param layoutOptions.fontFamily 字体家族
 * @param layoutOptions.documentWidth 文档宽度
 * @param _highlighter Shiki高亮器实例
 * @returns 完整的样式字符串
 */
export function generateThemeStyles(
  themeColors: Record<string, string>,
  layoutOptions: {
    fontSize: number
    lineHeight: number
    fontFamily: string
    documentWidth: string
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
  const allColors = {
    ...allThemeColors,
    ...enhancedColors,
    // 添加布局相关的CSS变量
    'font-size': `${layoutOptions.fontSize}px`,
    'line-height': layoutOptions.lineHeight.toString(),
    'font-family': layoutOptions.fontFamily,
    'document-width': layoutOptions.documentWidth,
  }

  // 生成CSS变量字符串
  const cssVariables = Object.entries(allColors)
    .map(([key, value]) => `--${key.replaceAll('.', '-')}: ${value};`)
    .join('\n        ')
  const cssVariablesBlock = `:root {\n        ${cssVariables}\n    }`

  // 获取基础样式并合并
  const baseStyles = getBaseStyles()
  const completeStyles = `${cssVariablesBlock}\n${baseStyles}`

  return completeStyles
}

// 预先读取和编译模板，避免每次调用都重复IO和编译
const templatePath = path.join(__dirname, 'webview', 'template.hbs')
const templateSource = fs.readFileSync(templatePath, 'utf8')
const compiledTemplate = Handlebars.compile(templateSource)

// 预先读取webview脚本内容

function getWebviewScript(_context?: any): string {
  let webviewScriptContent: string | null = null
  if (!webviewScriptContent) {
    const scriptPath = path.join(__dirname, './webview', 'webview.js')

    try {
      webviewScriptContent = fs.readFileSync(scriptPath, 'utf8')
    }
    catch {
      return `console.error('加载脚本失败！')`
    }
  }
  return webviewScriptContent as string
}

/**
 * 生成HTML模板
 * @param options 模板选项
 * @returns 完整的HTML字符串
 */
export function generateHtmlTemplate(options: HtmlTemplateOptions): string {
  const { content, themeStyles, nonce, extensionUri } = options

  const viewData = {
    content,
    themeStyles,
    nonce,
    extensionUri,
    webviewScript: getWebviewScript(),
  }

  return compiledTemplate(viewData)
}
