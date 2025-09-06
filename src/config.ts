import { defineConfigs } from 'reactive-vscode'

// 使用 reactive-vscode 的配置系统
export const {
  currentTheme,
  fontSize,
  lineHeight,
  syncScroll,
  fontFamily,
  documentWidth,
} = defineConfigs('markdownPreview', {
  currentTheme: String,
  fontSize: Number,
  lineHeight: Number,
  syncScroll: Boolean,
  fontFamily: String,
  documentWidth: {
    type: String,
    default: '1000px',
    description: '文档宽度 - 控制预览内容的容器宽度',
  },
})
