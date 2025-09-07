# iFlow CLI 项目上下文 - VSCode Markdown Shiki Preview

## 项目概述

**VSCode Markdown Shiki Preview** 是一个增强的 VS Code 扩展，专为 Markdown 文件预览设计，支持 Shiki 语法高亮主题切换、键盘导航和实时预览功能。

### 核心功能
- 🎨 **主题选择器**: 支持 60+ 个 Shiki 主题，无需手动输入主题名称
- ⌨️ **键盘导航**: 使用方向键预览主题，回车确认选择
- 🔄 **实时预览**: 主题切换时立即更新预览内容
- 📝 **同步滚动**: 编辑器与预览窗口同步滚动
- 🎯 **主题浏览器**: 侧边栏主题浏览器，方便快速切换
- 📐 **自定义字体**: 支持多种字体选择和自定义字体大小

### 技术栈
- **语言**: TypeScript
- **框架**: VS Code Extension API + reactive-vscode
- **语法高亮**: Shiki (基于 TextMate)
- **Markdown 解析**: markdown-it + @shikijs/markdown-it
- **构建工具**: tsdown (TypeScript 打包)
- **包管理**: pnpm
- **代码风格**: ESLint (@antfu/eslint-config)
- **测试**: Vitest

## 项目结构

```
vscode-markdown-shiki-preview/
├── src/                          # 源代码目录
│   ├── index.ts                  # 扩展入口点
│   ├── preview-provider.ts       # Markdown 预览提供者
│   ├── config.ts                 # 配置管理
│   ├── html-template.ts          # HTML 模板生成
│   ├── theme-renderer.ts         # 主题渲染器
│   ├── color-hander.ts           # 颜色处理器
│   ├── utils.ts                  # 工具函数
│   ├── generated/                # 生成的元数据
│   └── types/                    # TypeScript 类型定义
├── scripts/                      # 构建和开发脚本
│   └── README.md
├── res/                          # 资源文件
│   ├── icon.png                  # 扩展图标
│   ├── icon.svg                  # 图标 SVG
│   └── preview.svg               # 预览图标
├── test/                         # 测试文件
│   ├── index.test.ts             # 测试入口
│   ├── index.md                  # 测试索引
│   ├── test-basic-syntax.md      # 基础语法测试
│   ├── test-code-blocks.md       # 代码块测试
│   ├── test-details.md           # 折叠容器测试
│   ├── test-diagrams-and-charts.md # 图表测试
│   ├── test-images.md            # 图片测试
│   ├── test-katex.md             # KaTeX 数学公式测试
│   ├── test-links-and-quotes.md  # 链接和引用测试
│   ├── test-special-elements.md  # 特殊元素测试
│   ├── test-tables.md            # 表格测试
│   └── test-background-block.md  # 背景块测试
├── themes-cssvar/                # 主题 CSS 变量文件
├── dist/                         # 构建输出目录
├── .vscode/                      # VS Code 工作区配置
├── .github/                      # GitHub Actions 工作流
├── package.json                  # 扩展清单和依赖
├── tsconfig.json                 # TypeScript 配置
├── tsdown.config.ts              # 构建配置
├── eslint.config.mjs             # ESLint 配置
└── pnpm-workspace.yaml           # 工作区配置
```

## 开发环境设置

### 前置要求
- Node.js (推荐 v18+)
- pnpm (包管理器)
- VS Code (用于测试扩展)

### 安装依赖
```bash
pnpm install
```

### 开发命令

#### 构建和开发
```bash
# 构建扩展
pnpm run build

# 开发模式（监听文件变化）
pnpm run dev

# 类型检查
pnpm run typecheck

# 代码格式化
pnpm run lintfix

# 代码检查
pnpm run lint
```

#### 元数据更新
```bash
# 更新扩展元数据
pnpm run update
```

#### 测试
```bash
# 运行测试
pnpm run test
```

#### 发布相关
```bash
# 版本管理
pnpm run release

# 打包扩展
pnpm run ext:package

# 发布到 VS Code Marketplace
pnpm run ext:publish
```

### 调试扩展

1. **F5** 或 **Run > Start Debugging** 启动扩展开发主机
2. 在新窗口中打开 Markdown 文件测试功能
3. 使用 **Ctrl+Shift+P** 运行扩展命令

## 核心架构

### 1. 扩展激活 (src/index.ts)
- 使用 `reactive-vscode` 框架管理扩展生命周期
- 注册命令和 WebView 序列化器
- 监听配置变化和文档事件

### 2. Markdown 预览提供者 (src/preview-provider.ts)
- 管理 WebView 面板生命周期
- 集成 Shiki 语法高亮
- 实现滚动同步和内容更新防抖
- 支持主题实时切换

### 3. HTML 模板生成 (src/html-template.ts)
- 生成预览页面的 HTML 模板
- 处理主题 CSS 注入
- 管理预览页面的基本结构

### 4. 主题渲染器 (src/theme-renderer.ts)
- 处理主题切换逻辑
- 生成主题相关的 CSS
- 管理主题缓存

### 5. 颜色处理器 (src/color-hander.ts)
- 处理颜色相关的逻辑
- 支持颜色转换和格式化
- 管理主题颜色变量

### 6. 配置系统 (src/config.ts)
- 使用响应式配置管理
- 支持运行时配置更新
- 处理配置验证和默认值

### 7. 工具函数 (src/utils.ts)
- 提供通用工具函数
- 处理字符串操作
- 提供防抖和节流功能

## 配置选项

| 配置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `markdownPreview.currentTheme` | string | "vitesse-dark" | 当前选择的主题 |
| `markdownPreview.fontSize` | number | 14 | 预览内容字体大小 |
| `markdownPreview.lineHeight` | number | 1.6 | 预览内容行高 |
| `markdownPreview.syncScroll` | boolean | true | 启用同步滚动 |
| `markdownPreview.fontFamily` | string | "system-ui" | 预览内容字体族 |

## 扩展命令

| 命令 ID | 标题 | 描述 |
|---------|------|------|
| `markdownPreview.showPreview` | Open Markdown Preview | 打开 Markdown 预览 |
| `markdownPreview.switchTheme` | Switch Theme | 切换主题（带键盘导航） |

## 开发约定

### 代码风格
- 使用 ESLint (@antfu/eslint-config) 进行代码检查
- TypeScript 严格模式启用
- 使用 async/await 处理异步操作
- 函数和变量使用驼峰命名法

### 错误处理
- 使用 try-catch 处理异步操作
- 提供用户友好的错误消息
- 使用 VS Code 输出通道记录日志

### 性能优化
- 使用 lodash debounce 进行防抖处理
- 避免不必要的 DOM 更新
- 使用 WebView 缓存机制

## 测试

### 测试文件结构

项目包含全面的测试文件，覆盖各种 Markdown 语法和功能：

- `test-basic-syntax.md` - 基础 Markdown 语法测试
- `test-code-blocks.md` - 代码块和语法高亮测试
- `test-details.md` - 折叠容器和标签用法测试
- `test-diagrams-and-charts.md` - 图表和流程图测试
- `test-images.md` - 图片和链接测试
- `test-katex.md` - KaTeX 数学公式测试（包含各种数学符号和公式）
- `test-links-and-quotes.md` - 链接和引用测试
- `test-special-elements.md` - 特殊元素测试
- `test-tables.md` - 表格测试（包含复杂表格和嵌套内容）
- `test-background-block.md` - 背景块测试

### 运行测试

```bash
# 运行测试
pnpm run test

# 运行类型检查
pnpm run typecheck

# 运行代码检查
pnpm run lint
```

## 发布流程

1. **版本更新**: `pnpm run release`
2. **构建**: `pnpm run build`
3. **测试验证**: `pnpm run test` 和 `pnpm run typecheck`
4. **打包**: `pnpm run ext:package`
5. **发布**: `pnpm run ext:publish`

## 故障排除

### 调试技巧
- 使用 VS Code 开发者工具 (Help > Toggle Developer Tools)
- 查看扩展输出 (View > Output > VSCode Markdown Shiki Preview)
- 使用 `console.log` 在扩展主机中调试

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交前运行测试和代码检查
4. 提交 Pull Request

## 许可证

MIT License - 详见 LICENSE.md 文件

