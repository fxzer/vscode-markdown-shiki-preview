import type { MarkdownPreviewProvider } from './preview-provider'
import { debounce } from 'lodash-es'
import { bundledThemes } from 'shiki'
import * as vscode from 'vscode'
import { currentTheme } from './config'

export class ThemeExplorerProvider implements vscode.TreeDataProvider<ThemeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ThemeItem | undefined | null | void> = new vscode.EventEmitter<ThemeItem | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<ThemeItem | undefined | null | void> = this._onDidChangeTreeData.event

  private themes: ThemeItem[] = []
  private isUpdatingTheme = false // 标志位，防止配置监听器循环触发
  private debouncedThemeUpdate: ReturnType<typeof debounce>

  constructor(private previewProvider: MarkdownPreviewProvider) {
    // 初始化 lodash 防抖函数
    this.debouncedThemeUpdate = debounce(this.performThemeUpdate.bind(this), 300)

    this.loadThemes()
  }

  private loadThemes() {
    this.themes = Object.keys(bundledThemes).map(theme =>
      new ThemeItem(
        theme.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        theme,
        '$(symbol-color)',
      ),
    )
  }

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: ThemeItem): vscode.TreeItem {
    const currentThemeValue = currentTheme.value || 'github-light'

    const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None)
    treeItem.command = {
      command: 'markdownThemePreview.selectTheme',
      title: 'Select Theme',
      arguments: [element.theme],
    }
    treeItem.iconPath = new vscode.ThemeIcon(element.icon)
    treeItem.contextValue = 'theme'

    // 高亮当前选中的主题
    if (element.theme === currentThemeValue) {
      treeItem.description = '✓ Current'
      treeItem.tooltip = `Current theme: ${element.label}`
    }
    else {
      treeItem.tooltip = `Click to apply ${element.label} theme`
    }

    return treeItem
  }

  getChildren(element?: ThemeItem): Thenable<ThemeItem[]> {
    if (!element) {
      return Promise.resolve(this.themes)
    }
    return Promise.resolve([])
  }

  async selectTheme(theme: string) {
    // 设置标志位，防止配置监听器触发
    this.isUpdatingTheme = true

    // 使用响应式配置系统更新主题
    await currentTheme.update(theme, vscode.ConfigurationTarget.Global)
    this.refresh()

    // 重置标志位
    this.isUpdatingTheme = false

    // 使用 lodash 防抖函数延迟执行主题更新
    this.debouncedThemeUpdate(theme)
  }

  // 实际执行主题更新的方法（被防抖函数调用）
  private async performThemeUpdate(theme: string) {
    try {
      await this.previewProvider.updateTheme(theme)
      vscode.window.showInformationMessage(`Theme changed to: ${theme}`)
    }
    catch (error) {
      console.error('Error updating theme:', error)
      vscode.window.showErrorMessage(`Failed to update theme: ${error}`)
    }
  }

  isCurrentlyUpdating(): boolean {
    return this.isUpdatingTheme
  }

  dispose() {
    // 取消防抖函数的待执行操作
    this.debouncedThemeUpdate.cancel()
  }
}

class ThemeItem {
  constructor(
    public readonly label: string,
    public readonly theme: string,
    public readonly icon: string,
  ) {}
}
