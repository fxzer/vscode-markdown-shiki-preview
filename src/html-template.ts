/**
 * HTML模板生成器
 * 负责生成Markdown预览的HTML模板
 */

import * as path from 'node:path'
import Handlebars from 'handlebars'
import { generateEnhancedColors } from './color-hander'
import { isDarkColor } from './color-utils'
import { fileCacheService } from './file-cache-service'

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
  /** 是否包含Mermaid图表 */
  hasMermaid: boolean
}

/**
 * 主题样式配置 - 直接返回完整的样式字符串
 */
export type ThemeStylesConfig = string

// 获取基础样式，使用缓存服务
function getBaseStyles(): string {
  const baseStylesPath = path.join(__dirname, 'webview', 'styles.css')
  return fileCacheService.getFileContent(baseStylesPath)
}

/**
 * 生成主题CSS样式
 * @param themeColors 主题颜色配置
 * @param layoutOptions 布局选项
 * @param layoutOptions.fontSize 字体大小
 * @param layoutOptions.lineHeight 行高
 * @param layoutOptions.fontFamily 字体家族
 * @param layoutOptions.documentWidth 文档宽度
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
): ThemeStylesConfig {
  // 定义10个核心主题变量
  const coreThemeVariables = [
    'editor.background',
    'editor.foreground',
    'activityBar.background',
    'button.background',
    'focusBorder',
    'list.activeSelectionBackground',
    'list.hoverBackground',
    'statusBar.background',
    'titleBar.activeBackground',
    'activityBarBadge.background',
    'textLink.foreground',
    'textLink.activeForeground',
  ]

  // 过滤主题颜色，只保留10个核心变量
  const filteredThemeColors: Record<string, string> = {}
  for (const key of coreThemeVariables) {
    if (themeColors[key]) {
      filteredThemeColors[key] = themeColors[key]
    }
  }

  // 使用主题颜色覆盖基础配置

  // 检测主题类型
  const isDarkTheme = isDarkColor(filteredThemeColors['editor.background'])

  // 生成增强的颜色变量
  const enhancedColors = generateEnhancedColors(filteredThemeColors, isDarkTheme)

  // 合并原始主题变量和增强变量
  const allColors = {
    ...filteredThemeColors,
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

  // 添加主题类型变量
  const themeTypeVariable = `--theme-type: ${isDarkTheme ? 'dark' : 'light'};`
  const cssVariablesBlock = `:root {\n        ${cssVariables}\n        ${themeTypeVariable}\n    }`

  // 获取基础样式并合并
  const baseStyles = getBaseStyles()
  const completeStyles = `${cssVariablesBlock}\n${baseStyles}`

  return completeStyles
}

// 预先读取和编译模板，使用缓存服务
const templatePath = path.join(__dirname, 'webview', 'template.hbs')
let compiledTemplate: HandlebarsTemplateDelegate<any> | null = null

function getCompiledTemplate(): HandlebarsTemplateDelegate<any> {
  if (!compiledTemplate) {
    try {
      const templateSource = fileCacheService.getFileContent(templatePath)
      compiledTemplate = Handlebars.compile(templateSource)
    }
    catch (error) {
      console.error('加载模板失败！', error)
      // 返回一个简单的模板作为后备
      compiledTemplate = Handlebars.compile('<html><body>{{content}}</body></html>')
    }
  }
  return compiledTemplate
}

// 获取webview脚本内容，使用缓存服务
function getWebviewScript(_context?: any): string {
  const scriptPath = path.join(__dirname, './webview', 'webview.js')

  try {
    return fileCacheService.getFileContent(scriptPath)
  }
  catch (error) {
    console.error('加载脚本失败！', error)
    return `console.error('加载脚本失败！')`
  }
}

/**
 * 生成HTML模板
 * @param options 模板选项
 * @returns 完整的HTML字符串
 */
export function generateHtmlTemplate(options: HtmlTemplateOptions): string {
  const { content, themeStyles, nonce, extensionUri, hasMermaid } = options

  const viewData = {
    content,
    themeStyles,
    nonce,
    extensionUri,
    webviewScript: getWebviewScript(),
    hasMermaid,
  }

  return getCompiledTemplate()(viewData)
}
