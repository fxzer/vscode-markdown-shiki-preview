# iFlow CLI 项目上下文 - VSCode Markdown Shiki Preview

## 项目概述

**VSCode Markdown Shiki Preview** 是一个增强的 VS Code 扩展，专为 Markdown 文件预览设计，支持 Shiki 语法高亮主题切换、键盘导航和实时预览功能。

### 核心功能
- 🎨 **主题选择器**: 支持 60+ 个 Shiki 主题，无需手动输入主题名称
- ⌨️ **键盘导航**: 使用方向键预览主题，回车确认选择
- 🔄 **实时预览**: 主题切换时立即更新预览内容
- 📝 **同步滚动**: 编辑器与预览窗口同步滚动
- 🎯 **主题浏览器**: 侧边栏主题浏览器，方便快速切换

### 技术栈
- **语言**: TypeScript
- **框架**: VS Code Extension API + reactive-vscode
- **语法高亮**: Shiki (基于 TextMate)
- **构建工具**: tsdown (TypeScript 打包)
- **包管理**: pnpm
- **代码风格**: ESLint (@antfu/eslint-config)

## 项目结构

```
vscode-markdown-shiki-preview/
├── src/                          # 源代码目录
│   ├── index.ts                  # 扩展入口点
│   ├── markdownPreviewProvider.ts # Markdown 预览提供者
│   ├── themeExplorer.ts          # 主题浏览器提供者
│   ├── config.ts                 # 配置管理
│   ├── utils.ts                  # 工具函数
│   └── generated/                # 生成的元数据
├── scripts/                      # 构建和开发脚本
│   ├── theme-manager.js          # 主题管理器
│   └── README.md
├── res/                          # 资源文件
│   ├── icon.png                  # 扩展图标
│   ├── icon.svg                  # 图标 SVG
│   └── preview.svg               # 预览图标
├── test/                         # 测试文件
│   └── index.test.ts
├── dist/                         # 构建输出目录
├── .vscode/                      # VS Code 工作区配置
├── .github/                      # GitHub Actions 工作流
├── package.json                  # 扩展清单和依赖
├── tsconfig.json                 # TypeScript 配置
├── tsdown.config.ts              # 构建配置
├── eslint.config.mjs             # ESLint 配置
└── theme-config.json             # 主题配置缓存
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
```

#### 主题管理
```bash
# 分析并同步主题配置
pnpm run update-themes

# 仅分析主题
node scripts/theme-manager.js analyze

# 仅更新 package.json
node scripts/theme-manager.js update
```

#### 发布相关
```bash
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
- 注册命令、WebView 序列化器和主题浏览器
- 监听配置变化和文档事件

### 2. Markdown 预览提供者 (src/markdownPreviewProvider.ts)
- 管理 WebView 面板生命周期
- 集成 Shiki 语法高亮
- 实现滚动同步和内容更新防抖
- 支持主题实时切换

### 3. 主题浏览器 (src/themeExplorer.ts)
- 提供侧边栏主题树视图
- 支持主题选择和预览
- 与预览窗口同步状态

### 4. 配置系统 (src/config.ts)
- 使用响应式配置管理
- 支持运行时配置更新

## 配置选项

| 配置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `markdownThemePreview.currentTheme` | string | "github-light" | 当前选择的主题 |
| `markdownThemePreview.fontSize` | number | 14 | 预览内容字体大小 |
| `markdownThemePreview.lineHeight` | number | 1.6 | 预览内容行高 |
| `markdownThemePreview.syncScroll` | boolean | true | 启用同步滚动 |

## 扩展命令

| 命令 ID | 标题 | 描述 |
|---------|------|------|
| `markdownThemePreview.showPreview` | Open Markdown Preview | 打开 Markdown 预览 |
| `markdownThemePreview.switchTheme` | Switch Theme | 切换主题（带键盘导航） |
| `markdownThemePreview.showThemePreview` | Show Theme Preview | 显示主题预览示例 |
| `markdownThemePreview.selectTheme` | Select Theme | 选择特定主题 |

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
3. **打包**: `pnpm run ext:package`
4. **发布**: `pnpm run ext:publish`

## 故障排除

### 常见问题

1. **主题不更新**
   - 检查 `theme-config.json` 是否存在
   - 运行 `pnpm run update-themes` 重新生成主题配置

2. **预览不显示**
   - 确保打开的是 Markdown 文件
   - 检查 VS Code 开发者工具中的错误日志

3. **构建失败**
   - 检查 TypeScript 类型错误: `pnpm run typecheck`
   - 检查 ESLint 错误: `pnpm run lint`

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