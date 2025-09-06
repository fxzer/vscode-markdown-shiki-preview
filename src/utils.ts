import type * as vscode from 'vscode'
import { useLogger } from 'reactive-vscode'
import { configService } from './config-service'
import { displayName } from './generated/meta'

export const logger = useLogger(displayName)

/**
 * 获取当前主题配置，如果都没有配置则返回 'vitesse-dark'
 *
 * @param resource 资源URI，用于获取工作区文件夹特定配置
 * @returns 主题名称
 */
export function getCurrentTheme(resource?: vscode.Uri): string {
  return configService.getCurrentTheme(resource)
}

/**
 * 获取字体大小配置
 *
 * @param resource 资源URI
 * @returns 字体大小
 */
export function getFontSize(resource?: vscode.Uri): number {
  return configService.getFontSize(resource)
}

/**
 * 获取行高配置
 *
 * @param resource 资源URI
 * @returns 行高
 */
export function getLineHeight(resource?: vscode.Uri): number {
  return configService.getLineHeight(resource)
}

/**
 * 获取字体族配置
 *
 * @param resource 资源URI
 * @returns 字体族
 */
export function getFontFamily(resource?: vscode.Uri): string {
  return configService.getFontFamily(resource)
}

/**
 * 获取滚动同步配置
 *
 * @param resource 资源URI
 * @returns 是否启用滚动同步
 */
export function getSyncScroll(resource?: vscode.Uri): boolean {
  return configService.getSyncScroll(resource)
}

/**
 * 获取文档宽度配置
 *
 * @param resource 资源URI
 * @returns 文档宽度
 */
export function getDocumentWidth(
  resource?: vscode.Uri,
): string {
  return configService.getDocumentWidth(resource)
}
