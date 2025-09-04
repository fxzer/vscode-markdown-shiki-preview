import { useLogger } from 'reactive-vscode'
import * as vscode from 'vscode'
import { displayName } from './generated/meta'

export const logger = useLogger(displayName)

/**
 * 获取配置值，遵循VSCode配置优先级策略
 * 优先级从低到高：默认值 → 用户设置 → 工作区设置 → 工作区文件夹设置
 *
 * @param key 配置键名（不包含扩展名前缀）
 * @param defaultValue 默认值
 * @param resource 资源URI，用于获取工作区文件夹特定配置
 * @returns 配置值
 */
export function getConfigWithPriority<T>(
  key: string,
  defaultValue: T,
  resource?: vscode.Uri,
): T {
  const configKey = `markdownPreview.${key}`

  try {
    // 获取工作区配置
    const config = vscode.workspace.getConfiguration('markdownPreview', resource)

    // 获取配置检查器，用于确定配置来源
    const inspection = config.inspect<T>(key)

    if (!inspection) {
      logger.warn(`无法检查配置 ${configKey}，使用默认值`)
      return defaultValue
    }

    // 按优先级返回配置值
    // 1. 工作区文件夹设置 (最高优先级)
    if (inspection.workspaceFolderValue !== undefined) {
      logger.info(`使用工作区文件夹配置 ${configKey}:`, inspection.workspaceFolderValue)
      return inspection.workspaceFolderValue
    }

    // 2. 工作区设置
    if (inspection.workspaceValue !== undefined) {
      logger.info(`使用工作区配置 ${configKey}:`, inspection.workspaceValue)
      return inspection.workspaceValue
    }

    // 3. 用户设置
    if (inspection.globalValue !== undefined) {
      logger.info(`使用用户配置 ${configKey}:`, inspection.globalValue)
      return inspection.globalValue
    }

    // 4. 默认值 (最低优先级)
    const finalValue = inspection.defaultValue !== undefined ? inspection.defaultValue : defaultValue
    logger.info(`使用默认配置 ${configKey}:`, finalValue)
    return finalValue
  }
  catch (error) {
    logger.error(`获取配置 ${configKey} 时出错:`, error)
    return defaultValue
  }
}

/**
 * 获取当前主题配置，如果都没有配置则返回 'vitesse-dark'
 *
 * @param resource 资源URI，用于获取工作区文件夹特定配置
 * @returns 主题名称
 */
export function getCurrentTheme(resource?: vscode.Uri): string {
  return getConfigWithPriority('currentTheme', 'vitesse-dark', resource)
}

/**
 * 获取字体大小配置
 *
 * @param resource 资源URI
 * @returns 字体大小
 */
export function getFontSize(resource?: vscode.Uri): number {
  return getConfigWithPriority('fontSize', 14, resource)
}

/**
 * 获取行高配置
 *
 * @param resource 资源URI
 * @returns 行高
 */
export function getLineHeight(resource?: vscode.Uri): number {
  return getConfigWithPriority('lineHeight', 1.6, resource)
}

/**
 * 获取字体族配置
 *
 * @param resource 资源URI
 * @returns 字体族
 */
export function getFontFamily(resource?: vscode.Uri): string {
  return getConfigWithPriority('fontFamily', 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', resource)
}

/**
 * 获取滚动同步配置
 *
 * @param resource 资源URI
 * @returns 是否启用滚动同步
 */
export function getSyncScroll(resource?: vscode.Uri): boolean {
  return getConfigWithPriority('syncScroll', true, resource)
}
