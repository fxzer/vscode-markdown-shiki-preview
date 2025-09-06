import { defineConfigs } from 'reactive-vscode'

// 使用 reactive-vscode 的配置系统
export const {
  currentTheme,
  fontSize,
  lineHeight,
  syncScroll,
  fontFamily,
  documentWidth,
  enableMermaid,
} = defineConfigs('markdownPreview', {
  currentTheme: {
    type: String,
    default: 'vitesse-dark',
  },
  fontSize: {
    type: Number,
    default: 14,
  },
  lineHeight: {
    type: Number,
    default: 1.6,
  },
  syncScroll: {
    type: Boolean,
    default: true,
  },
  fontFamily: {
    type: String,
    default: 'system-ui',
  },
  documentWidth: {
    type: String,
    default: '1000px',
  },
  enableMermaid: {
    type: Boolean,
    default: true,
  },
})
