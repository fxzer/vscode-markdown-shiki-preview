# Details 测试

## 基础 Details

:::details
这是一个基础的 details 容器。
:::

## 带标题的 Details

:::details[自定义标题]
这是一个带有自定义标题的 details 容器。
:::

## 默认展开的 Details

:::details{open}
这是一个默认展开的 details 容器。
:::

## 带标题和默认展开

:::details[带标题的默认展开]{open}
这是一个既带标题又默认展开的 details 容器。
:::

## 带 ID 和类名

:::details#custom-id.custom-class
这是一个带有 ID 和类名的 details 容器。
:::

## 带自定义属性

:::details{data-toggle="collapse" data-target="#demo"}
这是一个带有自定义数据属性的 details 容器。
:::

## 复杂组合

:::details#section1.highlight{open data-theme="dark"}
这是一个组合了 ID、类、默认展开和自定义属性的 details 容器。
:::

## 包含 Markdown 内容

:::details[包含 Markdown 内容]
### 这是一个标题

- 列表项 1
- 列表项 2

```javascript
console.log('Hello, World!')
```

> 这是一个引用。

**粗体文本** 和 *斜体文本*。
:::