import * as fs from 'node:fs'
import { useLogger } from 'reactive-vscode'
import { displayName } from './generated/meta'

export const logger = useLogger(displayName)

/**
 * 文件缓存服务类
 * 提供文件内容缓存功能，避免重复读取文件
 */
export class FileCacheService {
  private static instance: FileCacheService
  private cache = new Map<string, { content: string, mtime: number }>()
  private watchers = new Map<string, fs.FSWatcher>()

  private constructor() {
    // 定期清理缓存
    setInterval(() => this.cleanup(), 5 * 60 * 1000) // 每5分钟清理一次
  }

  public static getInstance(): FileCacheService {
    if (!FileCacheService.instance) {
      FileCacheService.instance = new FileCacheService()
    }
    return FileCacheService.instance
  }

  /**
   * 获取文件内容，带缓存功能
   */
  public getFileContent(filePath: string, encoding: BufferEncoding = 'utf8'): string {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`)
      }

      // 获取文件状态
      const stats = fs.statSync(filePath)
      const mtime = stats.mtimeMs

      // 检查缓存
      const cached = this.cache.get(filePath)
      if (cached && cached.mtime === mtime) {
        logger.info(`从缓存读取文件: ${filePath}`)
        return cached.content
      }

      // 读取文件内容
      const content = fs.readFileSync(filePath, encoding)

      // 更新缓存
      this.cache.set(filePath, { content, mtime })

      // 设置文件监听器
      this.setupWatcher(filePath)

      logger.info(`从磁盘读取文件: ${filePath}`)
      return content
    }
    catch (error) {
      logger.error(`读取文件失败 ${filePath}:`, error)
      throw error
    }
  }

  /**
   * 清除指定文件的缓存
   */
  public clearCache(filePath?: string): void {
    if (filePath) {
      this.cache.delete(filePath)
      this.clearWatcher(filePath)
    }
    else {
      // 清除所有缓存
      this.cache.clear()
      this.clearAllWatchers()
    }
  }

  /**
   * 获取缓存统计信息
   */
  public getCacheStats(): { cachedFiles: number, totalSize: number } {
    let totalSize = 0
    for (const { content } of this.cache.values()) {
      totalSize += content.length
    }
    return {
      cachedFiles: this.cache.size,
      totalSize,
    }
  }

  /**
   * 设置文件监听器
   */
  private setupWatcher(filePath: string): void {
    // 如果已经有监听器，先清除
    this.clearWatcher(filePath)

    try {
      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
          logger.info(`文件发生变化，清除缓存: ${filePath}`)
          this.cache.delete(filePath)
        }
      })

      this.watchers.set(filePath, watcher)
    }
    catch (error) {
      logger.error(`设置文件监听器失败 ${filePath}:`, error)
    }
  }

  /**
   * 清除文件监听器
   */
  private clearWatcher(filePath: string): void {
    const watcher = this.watchers.get(filePath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(filePath)
    }
  }

  /**
   * 清除所有监听器
   */
  private clearAllWatchers(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now()
    const expiredFiles: string[] = []

    for (const [filePath, { mtime }] of this.cache.entries()) {
      // 如果文件不存在或超过30分钟未访问，则清除缓存
      try {
        if (!fs.existsSync(filePath)) {
          expiredFiles.push(filePath)
        }
        else if (now - mtime > 30 * 60 * 1000) {
          expiredFiles.push(filePath)
        }
      }
      catch {
        expiredFiles.push(filePath)
      }
    }

    for (const filePath of expiredFiles) {
      this.cache.delete(filePath)
      this.clearWatcher(filePath)
    }

    if (expiredFiles.length > 0) {
      logger.info(`清理了 ${expiredFiles.length} 个过期缓存文件`)
    }
  }

  /**
   * 销毁服务
   */
  public dispose(): void {
    this.clearAllWatchers()
    this.cache.clear()
  }
}

// 导出单例实例
export const fileCacheService = FileCacheService.getInstance()
