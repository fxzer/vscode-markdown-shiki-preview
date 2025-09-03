# VSCode Markdown Shiki Preview

<a href="https://marketplace.visualstudio.com/items?itemName=fxzer.vscode-markdown-shiki-preview" target="__blank"><img src="https://img.shields.io/visual-studio-marketplace/v/fxzer.vscode-markdown-shiki-preview.svg?color=eee&amp;label=VS%20Code%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace Version" /></a>
<a href="https://kermanx.github.io/reactive-vscode/" target="__blank"><img src="https://img.shields.io/badge/made_with-reactive--vscode-%23007ACC?style=flat&labelColor=%23229863"  alt="Made with reactive-vscode" /></a>

一个增强的 VSCode Markdown 预览扩展，支持 Shiki 语法高亮主题切换、键盘导航和实时预览功能。

## 功能特性

- 🎨 **主题选择器**: 从下拉列表中选择 60+ 个 Shiki 主题，无需手动输入主题名称
- ⌨️ **键盘导航**: 使用方向键预览主题，回车确认选择
- 🔄 **实时预览**: 主题切换时立即更新预览内容
- 📝 **同步滚动**: 编辑器与预览窗口同步滚动
- 🎯 **主题浏览器**: 侧边栏主题浏览器，方便快速切换

## 使用方法

### 主题选择

1. **通过设置面板**:
   - 打开 VS Code 设置 (Ctrl/Cmd + ,)
   - 搜索 "Markdown Theme Preview"
   - 在 "Current Theme" 下拉列表中选择你喜欢的主题

2. **通过命令面板**:
   - 按 Ctrl/Cmd + Shift + P 打开命令面板
   - 输入 "Switch Theme" 并选择
   - 使用方向键预览不同主题，回车确认

3. **通过侧边栏**:
   - 打开任意 Markdown 文件
   - 在侧边栏找到 "Theme Preview" 面板
   - 点击任意主题进行预览

## Configurations

<!-- configs -->

| Key                                 | Description                                             | Type      | Default          |
| ----------------------------------- | ------------------------------------------------------- | --------- | ---------------- |
| `markdownThemePreview.currentTheme` | Select from all available Shiki themes                  | `string`  | `"github-light"` |
| `markdownThemePreview.fontSize`     | Font size for preview content                           | `number`  | `14`             |
| `markdownThemePreview.lineHeight`   | Line height for preview content                         | `number`  | `1.6`            |
| `markdownThemePreview.syncScroll`   | Enable synchronous scrolling between editor and preview | `boolean` | `true`           |

<!-- configs -->

## Commands

<!-- commands -->

| Command                                 | Title                                         |
| --------------------------------------- | --------------------------------------------- |
| `markdownThemePreview.showPreview`      | VSCode Markdown Shiki Preview: Open Markdown Preview |
| `markdownThemePreview.switchTheme`      | VSCode Markdown Shiki Preview: Switch Theme          |
| `markdownThemePreview.showThemePreview` | VSCode Markdown Shiki Preview: Show Theme Preview    |
| `markdownThemePreview.selectTheme`      | VSCode Markdown Shiki Preview: Select Theme          |

<!-- commands -->

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.png'/>
  </a>
</p>

## License

[MIT](./LICENSE.md) License © 2022 [Anthony Fu](https://github.com/antfu)
