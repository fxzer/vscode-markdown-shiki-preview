# 主题管理器

这个目录包含用于自动管理 Shiki 主题的脚本。

## 📁 文件说明

- `theme-manager.js` - 主题管理器脚本，用于自动从 Shiki 生成和更新主题配置

## 🚀 使用方法

### 方式 1: 使用 npm 脚本 (推荐)

```bash
# 同步主题配置 (分析 + 更新 + 构建)
npm run update-themes

# 只分析主题
npm run analyze-themes
```

### 方式 2: 直接运行脚本

```bash
# 显示帮助
node scripts/theme-manager.js help

# 分析所有可用的 Shiki 主题
node scripts/theme-manager.js analyze

# 更新 package.json 中的主题配置
node scripts/theme-manager.js update

# 分析主题并更新配置 (推荐)
node scripts/theme-manager.js sync
```

## 🔄 工作流程

主题管理器的完整工作流程：

1. **分析阶段** (`analyze`)
   - 初始化 Shiki Highlighter
   - 获取所有可用主题的详细信息
   - 生成中文描述
   - 保存到 `theme-config.json`

2. **更新阶段** (`update`)
   - 读取 `theme-config.json`
   - 备份 `package.json`
   - 更新 `markdownThemePreview.currentTheme` 配置
   - 更新 `enum` 和 `enumDescriptions`

3. **构建阶段** (通过 npm 脚本)
   - 重新构建扩展
   - 使新主题在 VS Code 中生效

## 📊 生成的文件

### theme-config.json
包含所有主题的配置数据：
```json
{
  "enum": ["主题名称数组"],
  "enumDescriptions": ["中文描述数组"],
  "themeCount": 60,
  "generatedAt": "2025-09-03T10:07:41.656Z",
  "metadata": {
    "shikiVersion": "^3.12.1",
    "generator": "theme-manager.js"
  }
}
```

### package.json 备份
每次更新时会自动创建备份文件：
- `package.json.backup.{timestamp}`

## 🎨 主题描述

脚本会自动为每个主题生成中文描述：

- **特殊主题**: 使用预定义的中文名称映射
- **GitHub 主题**: "GitHub 浅色主题", "GitHub 深色主题" 等
- **VS Code 主题**: "VS Code 默认深色主题" 等
- **品牌主题**: "Material 设计主题", "Dracula 主题" 等
- **通用主题**: 基于主题名称和类型自动生成

## 🔧 自定义

### 添加新的主题描述

在 `theme-manager.js` 中的 `THEME_TRANSLATIONS` 对象中添加：

```javascript
const THEME_TRANSLATIONS = {
    'new-theme': '新主题的中文名称',
    // ...
}
```

### 修改描述生成逻辑

编辑 `generateDescription()` 函数来自定义描述生成规则。

## 📝 注意事项

1. **Node.js 版本**: 需要支持 ES modules 的 Node.js 版本
2. **Shiki 依赖**: 确保项目已安装 Shiki
3. **权限**: 脚本会修改 `package.json`，请确保有写入权限
4. **备份**: 每次更新都会自动创建备份，可以安全回滚

## 🐛 故障排除

### 模块类型警告
如果看到 "MODULE_TYPELESS_PACKAGE_JSON" 警告，可以在 `package.json` 中添加：
```json
{
  "type": "module"
}
```

### 主题加载失败
如果某个主题无法加载，脚本会：
- 显示警告信息
- 使用推断的主题类型
- 继续处理其他主题

### 权限错误
确保脚本有执行权限：
```bash
chmod +x scripts/theme-manager.js
```

## 🚀 最佳实践

1. **定期更新**: Shiki 更新时运行 `npm run update-themes`
2. **版本控制**: 将生成的配置文件纳入版本控制
3. **测试验证**: 更新后测试几个主题确保正常工作
4. **备份保留**: 保留重要的备份文件以防需要回滚
