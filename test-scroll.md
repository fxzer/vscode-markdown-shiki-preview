# 滚动同步测试文档

这是一个用于测试滚动同步优化效果的长文档。

## 第一节

这里是第一节的内容。在优化之前，快速滚动预览区时编辑区的跟随滚动可能会出现卡顿。

现在我们已经实现了以下优化：

1. **防抖处理** - 使用 `requestAnimationFrame` 对预览区滚动事件进行防抖
2. **滚动阈值** - 只有滚动变化超过 0.5% 时才触发同步
3. **缓存机制** - 缓存文档高度和视口高度计算结果
4. **统一状态管理** - 编辑器和预览区的滚动源重置时机统一为 150ms

## 第二节

这里是第二节的内容。通过这些优化，我们期望：

- 减少不必要的消息传递
- 降低 CPU 使用率
- 提升滚动流畅度
- 避免循环滚动

## 第三节

这里是第三节的内容。测试时可以：

1. 快速滚动预览区
2. 观察编辑区是否能流畅跟随
3. 检查是否还有卡顿现象

## 第四节

这里是第四节的内容。优化的核心思路：

- **减少事件频率**：通过防抖和阈值控制
- **减少计算开销**：通过缓存机制
- **改善状态管理**：统一重置时机

## 第五节

这里是第五节的内容。如果优化效果不明显，可以考虑：

1. 调整滚动阈值（当前为 0.5%）
2. 调整防抖延迟（当前使用 requestAnimationFrame）
3. 调整状态重置延迟（当前为 150ms）

## 第六节

这里是第六节的内容。更多内容...

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## 第七节

这里是第七节的内容。更多内容...

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

## 第八节

这里是第八节的内容。更多内容...

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

## 第九节

这里是第九节的内容。更多内容...

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

## 第十节

这里是第十节的内容。更多内容...

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.

## 结论

通过这些优化，滚动同步的性能应该有显著提升。测试时请注意观察：

1. 滚动是否更加流畅
2. CPU 使用率是否降低
3. 是否还有明显的卡顿现象

如果仍有问题，可以进一步调整参数或实施更高级的优化策略。
