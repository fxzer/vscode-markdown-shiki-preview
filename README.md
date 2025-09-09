# VSCode Markdown Shiki Preview 预览

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=fxzer8888.vscode-markdown-shiki-preview" target="__blank">
    <img src="https://img.shields.io/visual-studio-marketplace/v/fxzer8888.vscode-markdown-shiki-preview.svg?color=eee&amp;label=VS%20Code%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace Version" />
  </a>
  <a href="https://kermanx.github.io/reactive-vscode/" target="__blank">
    <img src="https://img.shields.io/badge/made_with-reactive--vscode-%23007ACC?style=flat&labelColor=%23229863"  alt="Made with reactive-vscode" />
  </a>
  <a href="https://github.com/fxzer/vscode-markdown-shiki-preview/blob/main/LICENSE.md" target="__blank">
    <img src="https://img.shields.io/github/license/fxzer/vscode-markdown-shiki-preview?color=blue" alt="License" />
  </a>
</p>

<p align="center">
  一个为 Visual Studio Code 设计的增强型 Markdown 预览扩展，旨在提供比内置预览更强大、更美观的 Markdown 渲染体验。
</p>

---

## ✨ 核心亮点

本扩展的核心是使用 [Shiki](https://shiki.matsu.io/) 作为语法高亮引擎。Shiki 是一个功能强大的代码高亮库，它使用与 VSCode 相同的 TextMate 语法定义，因此可以**像素级精准**地渲染代码块，并支持海量的色彩主题。

- 🎨 **丰富的主题选择**: 内置 **60+** 种流行的 Shiki 主题，告别手动输入主题名称的繁琐。
- ⌨️ **实时主题预览**: 交互式主题选择器，使用键盘**方向键**即可实时预览不同主题的效果，**回车**确认，`Esc` 取消。
- 🔄 **双向同步滚动**: 编辑器和预览窗口之间的双向同步滚动，方便长文档的阅读和编辑。
- 📊 **扩展语法支持**:
  - **Mermaid 图表**: 在 Markdown 中直接编写 Mermaid 代码来生成流程图、序列图等。
  - **KaTeX 数学公式**: 支持使用 KaTeX 语法渲染复杂的数学公式。
  - **自定义容器**: 支持类似 VuePress 的自定义容器语法（例如 `:::tip`），用于突出显示特定信息。
- ⚙️ **高度可定制**: 支持自定义字体、字号、行高等，让你的预览更具个性。

## 🚀 安装

1.  打开 **VS Code**。
2.  按下 `Ctrl+Shift+X` (Windows, Linux) 或 `Cmd+Shift+X` (macOS) 打开扩展市场。
3.  在搜索框中输入 `vscode-markdown-shiki-preview`。
4.  找到本扩展（作者为 `fxzer8888`）并点击 **安装**。

或者，直接访问 [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=fxzer8888.vscode-markdown-shiki-preview) 进行安装。

## 📖 使用方式

1.  **打开预览**:
    *   打开一个 Markdown 文件 (`.md`)。
    *   点击编辑器右上角的预览图标 **"Open Markdown Preview"**。
    *   或者使用命令面板 (`Ctrl+Shift+P`)，输入并执行 `Open Markdown Preview` 命令。

2.  **切换主题**:
    *   在预览窗口激活的状态下，使用命令面板 (`Ctrl+Shift+P`)。
    *   输入并执行 `Switch Theme` 命令。
    *   一个主题选择器将会出现，你可以：
        *   使用**鼠标**点击选择。
        *   使用**上下方向键**实时预览不同主题的效果。
        *   按下**回车键**应用当前选中的主题。
        *   按下**Esc键**取消切换。

## 🛠️ 技术栈

- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **框架**: [VS Code Extension API](https://code.visualstudio.com/api) + [reactive-vscode](https://github.com/KermanX/reactive-vscode)
- **语法高亮**: [Shiki](https://shiki.matsu.io/)
- **Markdown 解析**: [markdown-it](https://github.com/markdown-it/markdown-it)
- **构建工具**: [tsdown](https://github.com/KermanX/tsdown)
- **包管理**: [pnpm](https://pnpm.io/)
- **代码风格**: [ESLint (@antfu/eslint-config)](https://github.com/antfu/eslint-config)
- **测试**: [Vitest](https://vitest.dev/)

## 🔧 配置选项

你可以在 VS Code 的 `settings.json` 文件中自定义以下配置：

| 配置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `markdownPreview.currentTheme` | `string` | `"vitesse-dark"` | 当前选择的主题名称 |
| `markdownPreview.fontSize` | `number` | `14` | 预览内容的字体大小 (px) |
| `markdownPreview.lineHeight` | `number` | `1.6` | 预览内容的行高 |
| `markdownPreview.syncScroll` | `boolean` | `true` | 是否启用双向同步滚动 |
| `markdownPreview.fontFamily` | `string` | `"system-ui"` | 预览内容的字体族 |

## 💻 源码与开发

本扩展的源码托管在 GitHub，欢迎贡献代码或提出建议！

- **源码位置**: [https://github.com/fxzer/vscode-markdown-shiki-preview](https://github.com/fxzer/vscode-markdown-shiki-preview)

### 开发环境设置

**前置要求**:
- Node.js (v18+)
- pnpm

**步骤**:
```bash
# 1. 克隆仓库
git clone https://github.com/fxzer/vscode-markdown-shiki-preview.git

# 2. 进入项目目录
cd vscode-markdown-shiki-preview

# 3. 安装依赖
pnpm install
```

### 开发命令

```bash
# 以开发模式构建（带文件监听和 sourcemap）
pnpm run dev

# 完整构建
pnpm run build

# 运行 ESLint 代码检查
pnpm run lint

# 运行 Vitest 测试
pnpm run test
```

### 调试扩展

1.  在 VS Code 中打开项目。
2.  按下 `F5` 键或通过 **Run > Start Debugging** 启动一个 "扩展开发宿主" 新窗口。
3.  在这个新窗口中，此扩展就已经被加载了。你可以打开一个 Markdown 文件来测试和调试功能。

## 📄 许可证

本项目基于 [MIT](./LICENSE.md) 许可证。

© 2025 [fxzer](https://github.com/fxzer)
