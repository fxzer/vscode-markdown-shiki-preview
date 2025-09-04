import { defineExtension, useCommand, useLogger } from 'reactive-vscode'
import { bundledThemes } from 'shiki'
import { window, workspace } from 'vscode'
import * as vscode from 'vscode'
import { currentTheme } from './config'
import { displayName } from './generated/meta'
import { MarkdownPreviewProvider } from './preview-provider'
import { ThemeExplorerProvider } from './theme-explorer'

// 使用新模板的日志系统
const logger = useLogger(displayName)

interface ThemeQuickPickItem extends vscode.QuickPickItem {
  theme: string
}

async function showEnhancedThemePicker(provider: MarkdownPreviewProvider): Promise<void> {
  // 获取所有可用主题
  const themes: ThemeQuickPickItem[] = Object.keys(bundledThemes).map(theme => ({
    label: theme.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: theme,
    theme,
  }))

  const currentThemeValue = currentTheme.value || 'github-light'

  // 找到当前主题的索引
  const currentIndex = themes.findIndex(t => t.theme === currentThemeValue)
  if (currentIndex !== -1) {
    themes[currentIndex].picked = true
  }

  // 创建 QuickPick 实例以获得更多控制
  const quickPick = window.createQuickPick<ThemeQuickPickItem>()
  quickPick.title = '选择主题 (使用方向键预览，回车确认)'
  quickPick.placeholder = `从 ${themes.length} 个可用主题中选择`
  quickPick.items = themes
  quickPick.canSelectMany = false
  quickPick.matchOnDescription = true

  // 设置初始选中项
  if (currentIndex !== -1) {
    quickPick.activeItems = [themes[currentIndex]]
  }

  let isPreviewMode = true
  const originalTheme = currentThemeValue
  let debounceTimer: NodeJS.Timeout | undefined
  const DEBOUNCE_DELAY = 300

  // 监听活动项变化（键盘导航时触发）
  quickPick.onDidChangeActive(async (items) => {
    if (items.length > 0 && isPreviewMode) {
      const selectedTheme = items[0].theme
      logger.info(`预览主题: ${selectedTheme}`)

      // 清除之前的防抖计时器
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // 设置防抖计时器
      debounceTimer = setTimeout(async () => {
        try {
          // 确保预览窗口已打开
          const activeEditor = window.activeTextEditor
          // 如果有预览窗口，实时预览主题，但不保存到配置
          if (provider.hasActivePanel()) {
          // 实时预览主题，但不保存到配置
            await provider.updateTheme(selectedTheme)
          }
          else if (activeEditor && activeEditor.document.fileName.endsWith('.md')) {
          // 如果没有预览窗口，先打开它
            provider.showPreview(activeEditor.document)
            // 等待预览窗口创建完成
            await new Promise(resolve => setTimeout(resolve, 100))

            // 实时预览主题，但不保存到配置
            await provider.updateTheme(selectedTheme)
          }
          else {
            window.showWarningMessage('请先打开一个 Markdown 文件')
          }
        }
        catch (error) {
          logger.error('Error updating theme preview:', error)
        }
        finally {
          debounceTimer = undefined
        }
      }, DEBOUNCE_DELAY)
    }
  })

  // 监听接受事件（回车或点击）
  quickPick.onDidAccept(async () => {
    const selectedItem = quickPick.selectedItems[0] || quickPick.activeItems[0]
    if (selectedItem) {
      // 使用响应式配置系统更新主题
      await currentTheme.update(selectedItem.theme, vscode.ConfigurationTarget.Global)
      await provider.updateTheme(selectedItem.theme)
      window.showInformationMessage(`主题已更改为: ${selectedItem.theme}`)
    }
    isPreviewMode = false
    quickPick.hide()
  })

  // 监听隐藏事件（ESC 或点击外部）
  quickPick.onDidHide(() => {
    // 清理防抖计时器
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = undefined
    }

    if (isPreviewMode) {
      // 如果是取消操作，恢复原始主题
      provider.updateTheme(originalTheme)
    }
    quickPick.dispose()
  })

  quickPick.show()
}

const { activate, deactivate } = defineExtension((ctx) => {
  logger.info('VSCode Markdown Shiki Preview extension activated')

  // 创建提供者实例
  const provider = new MarkdownPreviewProvider(ctx.extensionUri)
  const themeExplorer = new ThemeExplorerProvider(provider)

  // 注册 WebView 序列化器
  ctx.subscriptions.push(
    window.registerWebviewPanelSerializer('markdownPreview', provider),
  )

  // 注册主题资源管理器
  const treeView = window.createTreeView('markdownPreview.themeExplorer', {
    treeDataProvider: themeExplorer,
  })

  ctx.subscriptions.push(treeView)
  ctx.subscriptions.push({ dispose: () => themeExplorer.dispose() })

  // 注册命令
  useCommand('markdownPreview.showPreview', () => {
    const activeEditor = window.activeTextEditor
    if (!activeEditor || !activeEditor.document.fileName.endsWith('.md')) {
      window.showErrorMessage('Please open a Markdown file first')
      return
    }
    provider.showPreview(activeEditor.document)
  })

  useCommand('markdownPreview.switchTheme', async () => {
    try {
      await showEnhancedThemePicker(provider)
    }
    catch (error) {
      window.showErrorMessage(`Failed to load themes: ${error}`)
    }
  })


  // 监听配置变化，自动更新主题和字体设置
  ctx.subscriptions.push(
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('markdownPreview.currentTheme')) {
        // 检查是否是 themeExplorer 内部更新，避免循环触发
        if (!themeExplorer.isCurrentlyUpdating()) {
          const newTheme = currentTheme.value || 'github-light'
          // 只有在预览窗口存在时才更新主题
          if (provider.hasActivePanel()) {
            provider.updateTheme(newTheme)
          }
          themeExplorer.refresh()
        }
      }

      // 监听字体大小、行高等配置变化
      if (e.affectsConfiguration('markdownPreview.fontSize')
        || e.affectsConfiguration('markdownPreview.lineHeight')
        || e.affectsConfiguration('markdownPreview.fontFamily')) {
        // 如果有活动的预览窗口，重新渲染内容
        if (provider.hasActivePanel()) {
          const document = provider.getCurrentDocument()
          if (document) {
            provider.updateContent(document)
          }
        }
      }
    }),
  )

  // 监听活动编辑器变化，自动更新预览内容和滚动同步（带防抖）
  ctx.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.fileName.endsWith('.md')) {
        // 如果有活动的预览窗口，切换到新文档（包含内容更新和滚动同步重设）
        if (provider.hasActivePanel()) {
          provider.switchToDocument(editor.document)
        }
      }
    }),
  )

  // 监听文档内容变化，实时更新预览内容（带防抖）
  ctx.subscriptions.push(
    workspace.onDidChangeTextDocument((event) => {
      const document = event.document

      // 只处理Markdown文件
      if (!document.fileName.endsWith('.md')) {
        return
      }

      // 确保是当前活动的编辑器
      const activeEditor = window.activeTextEditor
      if (!activeEditor || activeEditor.document !== document) {
        return
      }

      // 如果有活动的预览窗口，使用防抖更新其内容
      if (provider.hasActivePanel()) {
        provider.updateContentDebounced(document)
      }
    }),
  )

  // 确保在扩展停用时清理资源
  return () => {
    provider.dispose()
    themeExplorer.dispose()
    logger.info('VSCode Markdown Shiki Preview extension deactivated')
  }
})

export { activate, deactivate }
