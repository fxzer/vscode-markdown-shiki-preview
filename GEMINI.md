# VSCode Markdown Shiki Preview 项目分析

## 项目概述

这是一个为 Visual Studio Code 设计的增强型 Markdown 预览扩展。它旨在提供比 VSCode 内置预览更强大、更美观的 Markdown 渲染体验。

该扩展的核心功能是使用 [Shiki](https://shiki.matsu.io/) 作为其语法高亮引擎。Shiki 是一个功能强大的代码高亮库，它使用与 VSCode 相同的 TextMate 语法定义，因此可以准确地渲染代码块，并支持海量的色彩主题。

**主要功能特性:**

*   **丰富的主题选择**: 内置了数十种流行的 Shiki 主题，用户可以轻松切换。
*   **实时主题预览**: 提供了一个交互式的主题选择器，用户可以使用键盘方向键实时预览不同主题的效果，无需保存配置。
*   **同步滚动**: 编辑器和预览窗口之间可以双向同步滚动，方便长文档的阅读和编辑。
*   **Mermaid 图表支持**: 可以在 Markdown 中直接编写 Mermaid 代码来生成流程图、序列图等。
*   **KaTeX 数学公式**: 支持使用 KaTeX 语法渲染复杂的数学公式。
*   **自定义容器**: 支持类似 VuePress 的自定义容器语法（例如 `:::tip`），用于突出显示特定信息。

### 核心技术栈

*   **TypeScript**: 项目的主要开发语言，提供了强类型支持，保证了代码的健壮性。
*   **VSCode API**: 扩展与 VSCode 编辑器深度集成所依赖的官方接口，用于创建 Webview 视图、注册命令、读取配置等。
*   **Shiki**: 核心的语法高亮库，负责将代码块转换为带有颜色信息的 HTML。
*   **markdown-it**: 一个高性能、可扩展的 Markdown 解析器，负责将 Markdown 文本解析并渲染成基础 HTML。
*   **Mermaid**: 用于在生成的预览中渲染流程图、序列图等图表。
*   **reactive-vscode**: 一个封装了 VSCode API 的库，使得可以用响应式编程（类似 Vue.js）的方式来开发扩展，极大地简化了状态管理和事件处理逻辑。

### 项目架构

该扩展的架构设计清晰，通过将不同职责分离到各自的管理器（Manager）中来实现：

*   `PreviewProvider`: 作为核心协调者，负责管理 Webview 面板的整个生命周期，包括创建、销毁、状态序列化（以便在重启 VSCode 后恢复）和消息通信。
*   `ContentManager`: 负责 Markdown 内容的渲染逻辑。它调用 `markdown-it` 和 `Shiki`，将 Markdown 纯文本转换为最终要在 Webview 中显示的完整 HTML。它还实现了防抖（debounce）机制以优化性能。
*   `ThemeManager`: 专门处理主题相关的逻辑。它负责初始化 Shiki 高亮器、加载所有可用主题、管理当前选中的主题状态，并能以增量更新的方式高效地切换主题样式，避免不必要的整个页面重绘。
*   `ScrollSyncManager`: 实现了编辑器和预览窗口之间的双向同步滚动功能。

## 构建与运行

项目使用 `pnpm` 作为首选的包管理器。`package.json` 中定义了以下关键脚本：

*   **`pnpm run build`**: 编译 TypeScript 源代码为 JavaScript。这是发布前或打包前必须执行的步骤。
*   **`pnpm run dev`**: 以监视（watch）模式编译代码。当任何源文件发生变化时，它会自动重新编译，非常适合在开发过程中使用。
*   **`pnpm run lint`**: 使用 ESLint 检查整个项目的代码风格和潜在的语法错误。
*   **`pnpm run test`**: 使用 Vitest 运行项目中编写的单元测试或集成测试。
*   **`pnpm run ext:package`**: 将整个扩展打包成一个 `.vsix` 文件。这个文件可以被手动安装到 VSCode 中。
*   **`pnpm run ext:publish`**: 将扩展发布到 Visual Studio Marketplace 和 Open VSX Registry。

### 开发模式

要在本地运行和调试此扩展，请按照以下步骤操作：

1.  确保你的系统已安装 Node.js 和 `pnpm`。
2.  在项目根目录下运行 `pnpm install` 来安装所有依赖项。
3.  使用 VSCode 打开该项目文件夹。
4.  按 `F5` 键，VSCode 将会启动一个“扩展开发宿主”新窗口。
5.  在这个新窗口中，此扩展就已经被加载了。你可以打开一个 Markdown 文件，然后通过命令面板（`Ctrl+Shift+P`）运行 "Open Markdown Preview" 来查看效果和调试。

## 开发规范

*   **代码风格**: 项目采用了 `@antfu/eslint-config` 这套严格且现代的 ESLint 规则集来保证代码风格的一致性。在提交代码前，建议运行 `pnpm run lint` 并修复所有报告的问题。
*   **测试**: 项目使用 Vitest 作为测试框架。
*   **版本与提交**: 项目使用 `bumpp` 工具来辅助进行版本号的提升。这通常意味着项目遵循 [约定式提交规范](https://www.conventionalcommits.org/)（Conventional Commits），这种规范有助于自动化生成变更日志（CHANGELOG）和版本发布。
*   **编程范式**: 项目的核心部分利用了 `reactive-vscode` 库，因此鼓励使用响应式编程范式来处理用户输入、配置变化等事件和状态。这种方式使代码更具声明性，逻辑更清晰。
