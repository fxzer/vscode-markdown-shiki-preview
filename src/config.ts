import { defineConfigs } from 'reactive-vscode'

// 使用 reactive-vscode 的配置系统
export const {
  currentTheme,
  fontSize,
  lineHeight,
  syncScroll
} = defineConfigs('markdownThemePreview', {
  currentTheme: String,
  fontSize: Number,
  lineHeight: Number,
  syncScroll: Boolean
})
