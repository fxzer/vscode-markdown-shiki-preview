import * as vscode from 'vscode'
import { configService } from './config-service'
import { logger } from './utils'

/**
 * 滚动同步管理器
 * 负责管理编辑器和预览窗口之间的滚动同步
 */
export class ScrollSyncManager {
  private _currentDocument: vscode.TextDocument | undefined
  private _scrollSyncDisposables: vscode.Disposable[] = []
  private _scrollSource = 'none' // 'editor' | 'preview' | 'none'
  private _scrollTimeout: NodeJS.Timeout | undefined
  private _panel: vscode.WebviewPanel | undefined

  constructor() {
    // 初始化时不设置任何监听器，等待设置面板和文档
  }

  /**
   * 设置当前面板
   */
  public setPanel(panel: vscode.WebviewPanel | undefined): void {
    this._panel = panel
  }

  /**
   * 设置当前文档并初始化滚动同步
   */
  public setupScrollSync(document: vscode.TextDocument): void {
    // 清理之前的滚动同步监听器
    this.disposeScrollSync()

    this._currentDocument = document

    // 检查是否启用滚动同步
    const syncScrollEnabled = configService.getSyncScroll(document.uri)
    if (!syncScrollEnabled) {
      logger.info('滚动同步已禁用')
      return
    }

    // 防抖处理编辑器滚动事件
    const scrollDisposable = vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (event.textEditor.document === document && this._panel && this._scrollSource !== 'preview') {
        this.syncEditorScrollToPreview(event.textEditor)
      }
    })
    this._scrollSyncDisposables.push(scrollDisposable)

    // 监听编辑器变化
    const editorChangeDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
      const documentUri = document.uri.toString()
      for (const editor of editors) {
        if (editor.document.uri.toString() === documentUri && this._panel) {
          this.syncEditorScrollToPreview(editor)
          break
        }
      }
    })
    this._scrollSyncDisposables.push(editorChangeDisposable)

    // 监听活动编辑器变化
    const activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document === document && this._panel) {
        this.syncEditorScrollToPreview(editor)
      }
    })
    this._scrollSyncDisposables.push(activeEditorChangeDisposable)
  }

  /**
   * 处理预览窗口滚动事件
   */
  public handlePreviewScroll(scrollPercentage: number, source?: string, _timestamp?: number): void {
    if (!this._currentDocument || source === 'editor' || this._scrollSource === 'editor') {
      return
    }

    // 检查是否启用滚动同步
    const syncScrollEnabled = configService.getSyncScroll(this._currentDocument.uri)
    if (!syncScrollEnabled) {
      return
    }

    // 使用文档URI查找对应的编辑器
    const documentUri = this._currentDocument.uri.toString()
    let targetEditor: vscode.TextEditor | undefined

    // 优先使用活动编辑器
    const activeEditor = vscode.window.activeTextEditor
    if (activeEditor && activeEditor.document.uri.toString() === documentUri) {
      targetEditor = activeEditor
    }
    else {
      // 查找所有可见的编辑器
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.toString() === documentUri) {
          targetEditor = editor
          break
        }
      }
    }

    if (!targetEditor) {
      return
    }

    try {
      const totalLines = this._currentDocument.lineCount
      if (totalLines === 0) {
        return
      }

      const targetLine = Math.min(
        Math.floor(scrollPercentage * Math.max(0, totalLines - 1)),
        totalLines - 1,
      )
      const range = new vscode.Range(targetLine, 0, targetLine, 0)

      // 设置滚动源并即时滚动编辑器
      this._scrollSource = 'preview'
      targetEditor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)

      // 延迟重置滚动源，与编辑器端保持一致，避免循环滚动
      if (this._scrollTimeout) {
        clearTimeout(this._scrollTimeout)
      }
      this._scrollTimeout = setTimeout(() => {
        this._scrollSource = 'none'
      }, 150)
    }
    catch (error) {
      console.error('Error syncing preview scroll to editor:', error)
    }
  }

  /**
   * 同步编辑器滚动到预览窗口
   */
  private syncEditorScrollToPreview(editor: vscode.TextEditor): void {
    if (!this._panel || !this._currentDocument || this._scrollSource === 'preview') {
      return
    }

    // 检查是否启用滚动同步
    const syncScrollEnabled = configService.getSyncScroll(this._currentDocument.uri)
    if (!syncScrollEnabled) {
      return
    }

    const visibleRange = editor.visibleRanges[0]
    if (!visibleRange) {
      return
    }

    const totalLines = editor.document.lineCount
    if (totalLines === 0) {
      return
    }

    // 使用可见区域中间位置计算滚动比例
    const middleLine = Math.floor((visibleRange.start.line + visibleRange.end.line) / 2)
    const scrollRatio = Math.max(0, Math.min(1, middleLine / Math.max(1, totalLines - 1)))

    // 设置滚动源并发送消息
    this._scrollSource = 'editor'
    this._panel.webview.postMessage({
      command: 'scrollToPercentage',
      percentage: scrollRatio,
      source: 'editor',
    })

    // 延迟重置滚动源，避免死循环，与预览区保持一致的延迟时间
    if (this._scrollTimeout) {
      clearTimeout(this._scrollTimeout)
    }
    this._scrollTimeout = setTimeout(() => {
      this._scrollSource = 'none'
    }, 150)
  }

  /**
   * 清理滚动同步相关资源
   */
  public disposeScrollSync(): void {
    // 清理滚动同步相关的监听器
    this._scrollSyncDisposables.forEach(disposable => disposable.dispose())
    this._scrollSyncDisposables = []

    // 清理滚动超时
    if (this._scrollTimeout) {
      clearTimeout(this._scrollTimeout)
      this._scrollTimeout = undefined
    }
  }

  /**
   * 获取当前文档
   */
  public getCurrentDocument(): vscode.TextDocument | undefined {
    return this._currentDocument
  }

  /**
   * 完全销毁管理器
   */
  public dispose(): void {
    this.disposeScrollSync()
    this._currentDocument = undefined
    this._panel = undefined
  }
}
