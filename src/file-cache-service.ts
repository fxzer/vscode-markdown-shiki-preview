import { Buffer } from 'node:buffer'
import * as fs from 'node:fs'
import process from 'node:process'
import { useLogger } from 'reactive-vscode'
import { displayName } from './generated/meta'

export const logger = useLogger(displayName)

// 配置常量
const CONFIG = {
  CLEANUP_INTERVAL: 5 * 60 * 1000, // 5分钟
  CACHE_EXPIRY_TIME: 30 * 60 * 1000, // 30分钟
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_CACHE_FILES: 100, // 最大缓存文件数
} as const

interface CacheEntry {
  content: string
  mtime: number
  lastAccess: number
  size: number
}

/**
 * 文件缓存服务类
 * 提供文件内容缓存功能，避免重复读取文件
 */
export class FileCacheService {
  private static instance: FileCacheService
  private cache = new Map<string, CacheEntry>()
  private watchers = new Map<string, fs.FSWatcher>()
  private cleanupInterval?: NodeJS.Timeout
  private currentCacheSize = 0
  private isDisposed = false

  private constructor() {
    // 定期清理缓存
    this.cleanupInterval = setInterval(() => this.cleanup(), CONFIG.CLEANUP_INTERVAL)
  }

  public static getInstance(): FileCacheService {
    if (!FileCacheService.instance) {
      FileCacheService.instance = new FileCacheService()
    }
    return FileCacheService.instance
  }

  /**
   * 检查服务是否已销毁
   */
  private checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error('FileCacheService has been disposed')
    }
  }

  /**
   * 获取文件内容，带缓存功能
   */
  public getFileContent(filePath: string, encoding: BufferEncoding = 'utf8'): string {
    this.checkDisposed()

    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`)
      }

      // 获取文件状态
      const stats = fs.statSync(filePath)
      const mtime = stats.mtimeMs
      const now = Date.now()

      // 检查缓存
      const cached = this.cache.get(filePath)
      if (cached && cached.mtime === mtime) {
        // 更新最后访问时间
        cached.lastAccess = now
        logger.info(`从缓存读取文件: ${filePath}`)
        return cached.content
      }

      // 读取文件内容
      const content = fs.readFileSync(filePath, encoding)
      const contentSize = Buffer.byteLength(content, encoding)

      // 检查缓存大小限制
      this.ensureCacheSizeLimit(contentSize)

      // 创建缓存条目
      const cacheEntry: CacheEntry = {
        content,
        mtime,
        lastAccess: now,
        size: contentSize,
      }

      // 更新缓存
      this.cache.set(filePath, cacheEntry)
      this.currentCacheSize += contentSize

      // 设置文件监听器
      this.setupWatcher(filePath)

      logger.info(`从磁盘读取文件: ${filePath} (${Math.round(contentSize / 1024)}KB)`)
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
    this.checkDisposed()

    if (filePath) {
      const cached = this.cache.get(filePath)
      if (cached) {
        this.currentCacheSize -= cached.size
        this.cache.delete(filePath)
        this.clearWatcher(filePath)
        logger.info(`清除文件缓存: ${filePath}`)
      }
    }
    else {
      // 清除所有缓存
      this.cache.clear()
      this.clearAllWatchers()
      this.currentCacheSize = 0
      logger.info('清除所有缓存')
    }
  }

  /**
   * 获取缓存统计信息
   */
  public getCacheStats(): { cachedFiles: number, totalSize: number, maxSize: number, watchers: number } {
    return {
      cachedFiles: this.cache.size,
      totalSize: this.currentCacheSize,
      maxSize: CONFIG.MAX_CACHE_SIZE,
      watchers: this.watchers.size,
    }
  }

  /**
   * 确保缓存大小在限制范围内
   */
  private ensureCacheSizeLimit(newContentSize: number): void {
    // 如果添加新内容会超过限制，先清理一些缓存
    if (this.currentCacheSize + newContentSize > CONFIG.MAX_CACHE_SIZE) {
      this.evictOldestCache()
    }

    // 如果缓存文件数量超过限制，清理最旧的文件
    if (this.cache.size >= CONFIG.MAX_CACHE_FILES) {
      this.evictOldestCache()
    }
  }

  /**
   * 清理最旧的缓存条目
   */
  private evictOldestCache(): void {
    let oldestTime = Date.now()
    let oldestKey = ''

    // 找到最久未访问的缓存条目
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess
        oldestKey = key
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)
      if (entry) {
        this.currentCacheSize -= entry.size
        this.cache.delete(oldestKey)
        this.clearWatcher(oldestKey)
        logger.info(`清理最旧缓存: ${oldestKey}`)
      }
    }
  }

  /**
   * 设置文件监听器
   */
  private setupWatcher(filePath: string): void {
    this.checkDisposed()

    // 如果已经有监听器，先清除
    this.clearWatcher(filePath)

    try {
      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
          logger.info(`文件发生变化，清除缓存: ${filePath}`)
          const cached = this.cache.get(filePath)
          if (cached) {
            this.currentCacheSize -= cached.size
            this.cache.delete(filePath)
          }
        }
      })

      this.watchers.set(filePath, watcher)
      logger.info(`设置文件监听器: ${filePath}`)
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
      try {
        watcher.close()
        this.watchers.delete(filePath)
        logger.info(`清除文件监听器: ${filePath}`)
      }
      catch (error) {
        logger.warn(`关闭文件监听器失败 ${filePath}:`, error)
      }
    }
  }

  /**
   * 清除所有监听器
   */
  private clearAllWatchers(): void {
    for (const [filePath, watcher] of this.watchers.entries()) {
      try {
        watcher.close()
      }
      catch (error) {
        logger.warn(`关闭文件监听器失败 ${filePath}:`, error)
      }
    }
    this.watchers.clear()
    logger.info('清除所有文件监听器')
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    if (this.isDisposed) {
      return
    }

    const now = Date.now()
    const expiredFiles: string[] = []
    let freedSize = 0

    for (const [filePath, entry] of this.cache.entries()) {
      // 如果文件不存在或超过配置时间未访问，则清除缓存
      try {
        if (!fs.existsSync(filePath)) {
          expiredFiles.push(filePath)
          freedSize += entry.size
        }
        else if (now - entry.lastAccess > CONFIG.CACHE_EXPIRY_TIME) {
          expiredFiles.push(filePath)
          freedSize += entry.size
        }
      }
      catch {
        expiredFiles.push(filePath)
        freedSize += entry.size
      }
    }

    for (const filePath of expiredFiles) {
      this.cache.delete(filePath)
      this.clearWatcher(filePath)
    }

    this.currentCacheSize -= freedSize

    if (expiredFiles.length > 0) {
      logger.info(`清理了 ${expiredFiles.length} 个过期缓存文件，释放 ${Math.round(freedSize / 1024)}KB`)
    }

    // 记录内存使用情况
    this.logMemoryUsage()
  }

  /**
   * 记录内存使用情况
   */
  private logMemoryUsage(): void {
    const stats = this.getCacheStats()
    const memoryUsage = process.memoryUsage()

    logger.info('缓存统计:', {
      files: stats.cachedFiles,
      size: `${Math.round(stats.totalSize / 1024)}KB`,
      maxSize: `${Math.round(stats.maxSize / 1024)}KB`,
      watchers: stats.watchers,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      },
    })
  }

  /**
   * 销毁服务
   */
  public dispose(): void {
    if (this.isDisposed) {
      return
    }

    logger.info('正在销毁 FileCacheService...')

    // 清理定时器
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
      logger.info('清理定时器')
    }

    // 清理所有文件监听器
    this.clearAllWatchers()

    // 清理缓存
    this.cache.clear()
    this.currentCacheSize = 0

    // 标记为已销毁
    this.isDisposed = true

    logger.info('FileCacheService 已销毁')
  }
}

// 导出单例实例
export const fileCacheService = FileCacheService.getInstance()
