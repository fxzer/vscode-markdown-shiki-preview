import { useLogger } from 'reactive-vscode'
import * as vscode from 'vscode'
import { displayName } from './generated/meta'

export const logger = useLogger(displayName)

/**
 * 统一的配置服务类
 * 提供配置获取、更新和监听功能
 */
export class ConfigService {
  private static instance: ConfigService
  private configCache = new Map<string, any>()
  private configListeners = new Map<string, Set<(value: any) => void>>()

  private constructor() {
    // 监听配置变化
    vscode.workspace.onDidChangeConfiguration((event) => {
      this.handleConfigChange(event)
    })
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService()
    }
    return ConfigService.instance
  }

  /**
   * 获取配置值，遵循VSCode配置优先级策略
   * 优先级从低到高：默认值 → 用户设置 → 工作区设置 → 工作区文件夹设置
   */
  public getConfig<T>(key: string, defaultValue: T, resource?: vscode.Uri): T {
    const cacheKey = this.getCacheKey(key, resource)

    // 检查缓存
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey) as T
    }

    const configKey = `markdownPreview.${key}`

    try {
      // 获取工作区配置
      const config = vscode.workspace.getConfiguration('markdownPreview', resource)

      // 获取配置检查器，用于确定配置来源
      const inspection = config.inspect<T>(key)

      if (!inspection) {
        logger.warn(`无法检查配置 ${configKey}，使用默认值`)
        this.configCache.set(cacheKey, defaultValue)
        return defaultValue
      }

      // 按优先级返回配置值
      let value: T

      // 1. 工作区文件夹设置 (最高优先级)
      if (inspection.workspaceFolderValue !== undefined) {
        value = inspection.workspaceFolderValue
        logger.info(`使用工作区文件夹配置 ${configKey}:`, value)
      }
      // 2. 工作区设置
      else if (inspection.workspaceValue !== undefined) {
        value = inspection.workspaceValue
        logger.info(`使用工作区配置 ${configKey}:`, value)
      }
      // 3. 用户设置
      else if (inspection.globalValue !== undefined) {
        value = inspection.globalValue
        logger.info(`使用用户配置 ${configKey}:`, value)
      }
      // 4. 默认值 (最低优先级)
      else {
        value = inspection.defaultValue !== undefined ? inspection.defaultValue : defaultValue
        logger.info(`使用默认配置 ${configKey}:`, value)
      }

      // 缓存配置值
      this.configCache.set(cacheKey, value)
      return value
    }
    catch (error) {
      logger.error(`获取配置 ${configKey} 时出错:`, error)
      this.configCache.set(cacheKey, defaultValue)
      return defaultValue
    }
  }

  /**
   * 更新配置值
   */
  public async updateConfig<T>(key: string, value: T, target?: vscode.ConfigurationTarget, resource?: vscode.Uri): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('markdownPreview', resource)
      await config.update(key, value, target)

      // 清除缓存
      this.clearCache(key, resource)

      // 通知监听器
      this.notifyListeners(key, value)

      logger.info(`配置 ${key} 已更新为:`, value)
    }
    catch (error) {
      logger.error(`更新配置 ${key} 失败:`, error)
      throw error
    }
  }

  /**
   * 监听配置变化
   */
  public onConfigChange<T>(key: string, callback: (value: T) => void): vscode.Disposable {
    if (!this.configListeners.has(key)) {
      this.configListeners.set(key, new Set())
    }

    const listeners = this.configListeners.get(key)!
    listeners.add(callback)

    return {
      dispose: () => {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.configListeners.delete(key)
        }
      },
    }
  }

  /**
   * 获取所有配置
   */
  public getAllConfigs(resource?: vscode.Uri) {
    return {
      currentTheme: this.getCurrentTheme(resource),
      fontSize: this.getFontSize(resource),
      lineHeight: this.getLineHeight(resource),
      fontFamily: this.getFontFamily(resource),
      syncScroll: this.getSyncScroll(resource),
      documentWidth: this.getDocumentWidth(resource),
      enableMermaid: this.getEnableMermaid(resource),
    }
  }

  /**
   * 获取当前主题配置
   */
  public getCurrentTheme(resource?: vscode.Uri): string {
    return this.getConfig('currentTheme', 'vitesse-dark', resource)
  }

  /**
   * 获取字体大小配置
   */
  public getFontSize(resource?: vscode.Uri): number {
    return this.getConfig('fontSize', 14, resource)
  }

  /**
   * 获取行高配置
   */
  public getLineHeight(resource?: vscode.Uri): number {
    return this.getConfig('lineHeight', 1.6, resource)
  }

  /**
   * 获取字体族配置
   */
  public getFontFamily(resource?: vscode.Uri): string {
    return this.getConfig('fontFamily', 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', resource)
  }

  /**
   * 获取滚动同步配置
   */
  public getSyncScroll(resource?: vscode.Uri): boolean {
    return this.getConfig('syncScroll', true, resource)
  }

  /**
   * 获取文档宽度配置
   */
  public getDocumentWidth(resource?: vscode.Uri): string {
    return this.getConfig('documentWidth', '1000px', resource)
  }

  /**
   * 获取 Mermaid 预览开关配置
   */
  public getEnableMermaid(resource?: vscode.Uri): boolean {
    return this.getConfig('enableMermaid', true, resource)
  }

  /**
   * 清除配置缓存
   */
  public clearCache(key?: string, resource?: vscode.Uri): void {
    if (key) {
      const cacheKey = this.getCacheKey(key, resource)
      this.configCache.delete(cacheKey)
    }
    else {
      this.configCache.clear()
    }
  }

  /**
   * 处理配置变化
   */
  private handleConfigChange(event: vscode.ConfigurationChangeEvent) {
    const relevantKeys = [
      'markdownPreview.currentTheme',
      'markdownPreview.fontSize',
      'markdownPreview.lineHeight',
      'markdownPreview.fontFamily',
      'markdownPreview.syncScroll',
      'markdownPreview.documentWidth',
      'markdownPreview.enableMermaid',
    ]

    for (const fullKey of relevantKeys) {
      if (event.affectsConfiguration(fullKey)) {
        const key = fullKey.replace('markdownPreview.', '')

        // 清除所有缓存，以确保获取到最新的值
        this.configCache.clear()

        // 获取新值并通知监听器
        const newValue = this.getConfig(key, this.getDefaultValue(key))
        this.notifyListeners(key, newValue)

        logger.info(`配置 ${key} 已发生变化，新值:`, newValue)
      }
    }
  }

  /**
   * 通知配置监听器
   */
  private notifyListeners(key: string, value: any): void {
    const listeners = this.configListeners.get(key)
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(value)
        }
        catch (error) {
          logger.error(`配置监听器执行失败 ${key}:`, error)
        }
      })
    }
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(key: string, resource?: vscode.Uri): string {
    return resource ? `${key}:${resource.toString()}` : key
  }

  /**
   * 获取默认值
   */
  private getDefaultValue(key: string): any {
    const defaults: Record<string, any> = {
      currentTheme: 'vitesse-dark',
      fontSize: 14,
      lineHeight: 1.6,
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      syncScroll: true,
      documentWidth: '1000px',
      enableMermaid: true,
    }
    return defaults[key]
  }
}

// 导出单例实例
export const configService = ConfigService.getInstance()
