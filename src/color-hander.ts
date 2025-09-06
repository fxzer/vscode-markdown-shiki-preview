import chroma from 'chroma-js'
import { adjustContrastColor, getContrastRatio, isDarkColor } from './color-utils'

// 定义回退颜色常量
const DARK_FALLBACKS = {
  tableHeader: '#2d3748',
  codeBlock: '#1a202c',
  tableBorder: 'rgba(255, 255, 255, 0.3)',
  strongForeground: '#a0a0a0',
  blockQuoteBackgrounds: [
    'rgba(255, 255, 255, 0.05)',
    'rgba(255, 255, 255, 0.08)',
    'rgba(255, 255, 255, 0.12)',
    'rgba(255, 255, 255, 0.16)',
    'rgba(255, 255, 255, 0.20)',
  ],
  blockQuoteBorder: 'rgba(255, 255, 255, 0.3)',
}

const LIGHT_FALLBACKS = {
  tableHeader: '#f7fafc',
  codeBlock: '#f7fafc',
  tableBorder: 'rgba(0, 0, 0, 0.3)',
  strongForeground: '#666666',
  blockQuoteBackgrounds: [
    'rgba(74, 85, 104, 0.04)',
    'rgba(74, 85, 104, 0.07)',
    'rgba(74, 85, 104, 0.10)',
    'rgba(74, 85, 104, 0.13)',
    'rgba(74, 85, 104, 0.16)',
  ],
  blockQuoteBorder: 'rgba(0, 0, 0, 0.3)',
}

export function generateBlockquoteBorderColor(
  backgroundColor: string,
  borderColor?: string,
  minContrast: number = 3.0,
): string {
  try {
    const bgColor = chroma(backgroundColor)
    const isDark = isDarkColor(backgroundColor)

    if (borderColor) {
      try {
        const currentBorder = chroma(borderColor)
        const contrast = getContrastRatio(bgColor, currentBorder)
        if (contrast >= minContrast) {
          return borderColor
        }
      }
      catch {
        console.warn('无效的边框颜色:', borderColor)
      }
    }

    if (isDark) {
      const lightness = bgColor.get('hsl.l')
      let borderLightness = Math.min(lightness + 0.3, 0.8)

      for (let i = 0; i < 10; i++) {
        const testBorder = bgColor.set('hsl.l', borderLightness)
        const contrast = getContrastRatio(bgColor, testBorder)
        if (contrast >= minContrast) {
          return testBorder.hex()
        }
        borderLightness = Math.min(borderLightness + 0.1, 0.9)
      }
      return 'rgba(255, 255, 255, 0.4)'
    }
    else {
      const lightness = bgColor.get('hsl.l')
      let borderLightness = Math.max(lightness - 0.3, 0.1)

      for (let i = 0; i < 10; i++) {
        const testBorder = bgColor.set('hsl.l', borderLightness)
        const contrast = getContrastRatio(bgColor, testBorder)
        if (contrast >= minContrast) {
          return testBorder.hex()
        }
        borderLightness = Math.max(borderLightness - 0.1, 0.05)
      }
      return 'rgba(0, 0, 0, 0.4)'
    }
  }
  catch (error) {
    console.error('生成边框颜色失败:', error)
    return isDarkColor(backgroundColor)
      ? 'rgba(255, 255, 255, 0.3)'
      : 'rgba(0, 0, 0, 0.3)'
  }
}

export function generateBlockquoteColors(baseColor: string, levels: number = 5): string[] {
  try {
    const base = chroma(baseColor)
    const isDark = isDarkColor(baseColor)
    const colors: string[] = []

    const baseAlpha = isDark ? 0.08 : 0.05
    const alphaStep = 0.03

    let overlayColor: chroma.Color
    if (isDark) {
      overlayColor = chroma('#ffffff')
    }
    else {
      overlayColor = chroma('#4a5568')
    }

    for (let i = 0; i < levels; i++) {
      const alpha = baseAlpha + (alphaStep * i)
      const mixRatio = Math.min(alpha * 2, 0.4)
      const levelColor = chroma.mix(base, overlayColor, mixRatio, 'lab')
      colors.push(levelColor.hex())
    }

    return colors
  }
  catch (error) {
    console.error('生成blockquote颜色失败:', error)
    const isDark = isDarkColor(baseColor)
    if (isDark) {
      return [
        'rgba(255, 255, 255, 0.05)',
        'rgba(255, 255, 255, 0.08)',
        'rgba(255, 255, 255, 0.12)',
        'rgba(255, 255, 255, 0.16)',
        'rgba(255, 255, 255, 0.20)',
      ]
    }
    else {
      return [
        'rgba(74, 85, 104, 0.04)',
        'rgba(74, 85, 104, 0.07)',
        'rgba(74, 85, 104, 0.10)',
        'rgba(74, 85, 104, 0.13)',
        'rgba(74, 85, 104, 0.16)',
      ]
    }
  }
}

export function generateSelectionBackgroundColor(
  foregroundColor: string,
  selectionBackground?: string,
  minContrast: number = 3.0,
): string {
  try {
    const fgColor = chroma(foregroundColor)
    const isDarkForeground = isDarkColor(foregroundColor)

    if (selectionBackground) {
      try {
        const currentSelection = chroma(selectionBackground)
        const contrast = getContrastRatio(currentSelection, fgColor)
        if (contrast >= minContrast) {
          return selectionBackground
        }
      }
      catch {
        console.warn('无效的选择背景色:', selectionBackground)
      }
    }

    if (isDarkForeground) {
      const lightness = fgColor.get('hsl.l')
      let bgLightness = Math.max(lightness + 0.4, 0.7)

      for (let i = 0; i < 10; i++) {
        const testBg = fgColor.set('hsl.l', bgLightness).alpha(0.3)
        const contrast = getContrastRatio(testBg, fgColor)
        if (contrast >= minContrast) {
          return testBg.css()
        }
        bgLightness = Math.min(bgLightness + 0.05, 0.95)
      }
      return 'rgba(255, 255, 255, 0.3)'
    }
    else {
      const lightness = fgColor.get('hsl.l')
      let bgLightness = Math.min(lightness - 0.4, 0.3)

      for (let i = 0; i < 10; i++) {
        const testBg = fgColor.set('hsl.l', bgLightness).alpha(0.4)
        const contrast = getContrastRatio(testBg, fgColor)
        if (contrast >= minContrast) {
          return testBg.css()
        }
        bgLightness = Math.max(bgLightness - 0.05, 0.05)
      }
      return 'rgba(0, 0, 0, 0.4)'
    }
  }
  catch (error) {
    console.error('生成选择背景色失败:', error)
    return isDarkColor(foregroundColor)
      ? 'rgba(255, 255, 255, 0.25)'
      : 'rgba(0, 0, 0, 0.25)'
  }
}

export function generateBrightenedForegroundColor(
  themeName: string,
  backgroundColor: string,
  originalForeground: string,
): string {
  const themesThatNeedBrightening = [
    'synthwave-84',
    'min-dark',
    'aurora-x',
  ]

  if (!themesThatNeedBrightening.includes(themeName)) {
    return originalForeground
  }

  try {
    const fgColor = chroma(originalForeground)
    const brightenedColor = fgColor.brighten(1.5)
    return brightenedColor.hex()
  }
  catch (error) {
    console.warn(`生成提亮前景色失败 (${themeName}):`, error)
    return isDarkColor(backgroundColor) ? '#E4E4E4' : originalForeground
  }
}

export function generateStrongForeground(background: string, foreground: string, fallback: string): string {
  if (foreground === '#ffffff' || foreground === '#fff' || foreground === '#000000' || foreground === '#000') {
    return foreground
  }

  try {
    const chromaColor = chroma(foreground)
    const adjustedForeground = isDarkColor(background)
      ? chromaColor.brighten(0.6).hex()
      : chromaColor.darken(0.6).hex()
    return adjustedForeground
  }
  catch (e) {
    console.warn('Failed to generate strong foreground color, using fallback.', e)
    return fallback
  }
}

export function generateEnhancedColors(
  themeColors: Record<string, string>,
  isDark: boolean,
  themeName?: string,
): Record<string, string> {
  const enhanced: Record<string, string> = {}
  const fallbacks = isDark ? DARK_FALLBACKS : LIGHT_FALLBACKS

  const background = themeColors['editor.background'] || '#ffffff'

  enhanced['markdown.tableHeader.background'] = adjustContrastColor(background)
  enhanced['markdown.codeBlock.background'] = adjustContrastColor(background)

  const blockquoteColors = generateBlockquoteColors(background, 5)
  enhanced['markdown.blockQuote.background.level1'] = blockquoteColors[0]
  enhanced['markdown.blockQuote.background.level2'] = blockquoteColors[1]
  enhanced['markdown.blockQuote.background.level3'] = blockquoteColors[2]
  enhanced['markdown.blockQuote.background.level4'] = blockquoteColors[3]
  enhanced['markdown.blockQuote.background.level5'] = blockquoteColors[4]
  enhanced['markdown.blockQuote.background'] = blockquoteColors[0]

  const originalBorderColor = themeColors['panel.border']
  enhanced['markdown.blockQuote.border'] = generateBlockquoteBorderColor(
    background,
    originalBorderColor,
    3.0,
  )

  try {
    enhanced['markdown.table.border'] = chroma(enhanced['markdown.blockQuote.border']).alpha(0.5).css()
  }
  catch (e) {
    console.warn('Failed to generate table border color, using fallback.', e)
    enhanced['markdown.table.border'] = fallbacks.tableBorder
  }

  let foreground = themeColors['editor.foreground'] || (isDark ? '#ffffff' : '#000000')

  if (themeName) {
    const optimizedForeground = generateBrightenedForegroundColor(themeName, background, foreground)
    if (optimizedForeground !== foreground) {
      foreground = enhanced['editor.foreground'] = optimizedForeground
    }
  }

  const originalSelectionBackground = themeColors['editor.selectionBackground']
  enhanced['editor.selectionBackground'] = generateSelectionBackgroundColor(
    foreground,
    originalSelectionBackground,
    3.0,
  )

  enhanced['markdown.strong.foreground'] = generateStrongForeground(
    background,
    foreground,
    fallbacks.strongForeground,
  )

  return enhanced
}
