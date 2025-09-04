# 标题更新测试

这是一个测试文件，用于验证预览标签页标题的动态更新功能。

## 功能说明

当你切换到不同的 Markdown 文件时，预览标签页的标题应该会自动更新为：

**Markdown Preview [文件名.md]**

## 测试步骤

1. 打开这个文件的预览
2. 切换到其他 Markdown 文件（如 README.md 或 test-scroll.md）
3. 观察预览标签页的标题是否正确更新

## 预期结果

- 对于这个文件：`Markdown Preview [test-title-update.md]`
- 对于 README.md：`Markdown Preview [README.md]`
- 对于 test-scroll.md：`Markdown Preview [test-scroll.md]`

## 代码更改

我们在 `MarkdownPreviewProvider` 类中添加了以下功能：

1. `updatePanelTitle()` 方法：动态设置标签页标题
2. 在多个关键方法中调用此方法：
   - `showPreview()`：初始预览时
   - `updateContent()`：内容更新时
   - `switchToDocument()`：文档切换时
   - `deserializeWebviewPanel()`：恢复预览面板时

这确保了无论何时预览的文档发生变化，标签页标题都会相应更新。
