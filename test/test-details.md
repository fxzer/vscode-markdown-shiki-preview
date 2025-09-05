# 折叠与容器测试

## 基础折叠

:::details 点击展开
这是一段隐藏的文本，可以包含[链接](https://example.com)。
:::

## 嵌套折叠

:::details 外层折叠
这是外层折叠的内容。

:::details 内层折叠
这是内层折叠的内容。
```css
.nested { color: red; }
```
:::
:::

## 复杂内容的折叠

:::details 查看综合示例
### 这是一个标题

- 列表项 1
- 列表项 2
  - 嵌套列表项

| 表头1 | 表头2 |
|---|---|
| 单元格1 | 单元格2 |

```javascript
// 代码块
console.log('Hello from details');
```

> 这是一个引用。

![GitHub Logo](https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png)
:::

## 不同类型的容器

:::tip
这是一个提示容器。
:::

:::warning
这是一个警告容器。
:::

:::danger
这是一个危险警告！
:::

## 组合使用

> :::details 引用中的折叠
> 这是位于引用块内部的折叠区域。
> - 列表项 1
> - 列表项 2
> :::

:::details 折叠中的引用
> 这是位于折叠区域内部的引用。
> > 也可以是嵌套引用。
:::

## 标签用法测试

### 基本标签语法

:::details[自定义标题]
这是使用方括号语法的折叠容器。
:::

:::details{open}
默认展开的折叠容器。
:::

### 带有ID和类的标签

:::details#custom-id.custom-class
带有ID和自定义类的折叠容器。
:::

### 带有属性的标签

:::details{data-toggle="collapse" data-target="#demo"}
带有自定义数据属性的折叠容器。
:::

### 多属性组合

:::details#section1.highlight{open data-theme="dark"}
组合了ID、类、默认展开和自定义属性的折叠容器。
:::

### 嵌套标签属性

:::details.outer{open}
外层容器（默认展开）

:::details.inner{data-level="2"}
内层容器，带有自定义数据属性。
:::
:::

### 特殊字符测试

:::details[标题包含特殊字符: @#$%^&*()]
测试标题中包含特殊字符的情况。
:::

### 空内容测试

:::details[空内容测试]
:::

### 仅包含空白字符

:::details[仅空白字符]
   
:::

### HTML标签混合

:::details[包含HTML标签]
可以包含<strong>HTML标签</strong>和<em>强调文本</em>。
:::
