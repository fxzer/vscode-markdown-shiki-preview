# Body Max Width 测试

这是一个用于测试 bodyMaxWidth 配置项的 Markdown 文件。

## 测试内容

1. 这是一个长段落，用于测试预览页面的最大宽度设置。当设置不同的 bodyMaxWidth 值时，预览页面的内容区域应该相应地调整宽度。如果设置为较小的值，内容区域应该变窄；如果设置为较大的值，内容区域应该变宽。

2. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

3. 这是另一个长段落，用于进一步测试宽度设置。Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

## 测试步骤

1. 打开 VS Code 设置，找到 `markdownPreview.bodyMaxWidth` 配置项
2. 尝试设置不同的值，如 '800px'、'1200px'、'50%' 等
3. 观察预览页面的宽度变化
4. 尝试设置无效值，如 'invalid'，观察是否回退到默认值 '1000px'

## 代码块测试

```javascript
// 这是一个用于测试代码块宽度的示例代码
function exampleFunction() {
  console.log('This is a test function to check code block width in preview')
  const longVariableNameToTestCodeBlockWidthInPreview = 'This is a very long string to test the width of code blocks in the preview'
  return longVariableNameToTestCodeBlockWidthInPreview
}
```

```python
# Python 代码块测试
def example_function():
    print('This is a test function to check code block width in preview')
    long_variable_name_to_test_code_block_width_in_preview = 'This is a very long string to test the width of code blocks in the preview'
    return long_variable_name_to_test_code_block_width_in_preview
```
