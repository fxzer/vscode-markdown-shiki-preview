# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

这是一个 VS Code 扩展项目，提供带有 Shiki 语法高亮的 Markdown 实时预览功能。

## Architecture & Structure

项目采用模块化架构，主要组件包括：

### Core Components
- **MarkdownPreviewProvider** (`src/preview-provider.ts`): 核心预览服务管理器
- **ContentManager** (`src/content-manager.ts`): 内容管理和渲染处理
- **ThemeManager** (`src/theme-manager.ts`): 主题管理和Shiki语法高亮配置
- **ScrollSyncManager** (`src/scroll-sync-manager.ts`): 滚动同步控制
- **ConfigService** (`src/config-service.ts`): 配置管理服务

### WebView Components
- **webview.js** (`src/webview/webview.js`): WebView 端脚本处理
- **template.hbs** (`src/webview/template.hbs`): HTML模板文件
- **styles.css** (`src/webview/styles.css`): 样式文件

### Utility Modules
- **file-cache-service.ts**: 文件缓存管理
- **color-handers.ts**: 颜色处理工具
- **utils.ts**: 通用工具函数

## Available Commands

### Development Commands
- `npm run build` - 构建扩展
- `npm run dev` - 开发模式构建（带监听和sourcemap）
- `npm run typecheck` - TypeScript类型检查
- `npm run lint` - ESLint代码检查
- `npm run lintfix` - 自动修复代码格式
- `npm run test` - 运行测试

### Release Commands
- `npm run release` - 版本管理和发布
- `npm run ext:package` - 构建VSIX包
- `npm run ext:publish` - 发布到VSCode市场

### Build Configuration
- 构建工具：tsdown (替代Webpack/Rollup)
- TypeScript配置：tsconfig.json
- 外部依赖：vscode API需要标记为external

## Key Development Tasks

### 添加新主题支持
1. 在 ThemeManager 中添加新的主题配置
2. 更新 theme-renderer.ts 中的主题渲染逻辑
3. 确保颜色兼容性在 color-utils.ts 中正确处理

### 扩展语法支持
1. 修改 content-manager.ts 中的Markdown处理逻辑
2. 更新 webview.js 中的渲染器配置
3. 确保新语法块在HTML模板中正确渲染

### 配置新功能
1. 更新 config.ts 中的配置接口
2. 在 config-service.ts 中添加配置监听器
3. 在 preview-provider.ts 中添加相应的事件处理

### 调试和测试
- 使用 `.vscode/launch.json` 中的调试配置进行扩展调试
- 运行 `npm run test` 执行单元测试
- 运行 `npm run typecheck` 验证TypeScript类型
