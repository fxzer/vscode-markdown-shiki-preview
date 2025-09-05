import chroma from 'chroma-js'
/**
 * 检测主题类型
 * @param color 背景颜色
 * @returns 是否为深色主题
 */
export function isDarkColor(color: string): boolean {
  if (!color)
    return false

  try {
    const luminance = chroma(color).luminance()
    return luminance < 0.5
  }
  catch {
    return false
  }
}
export function adjustContrastColor(colorInput: string, options: { darkThreshold?: number, lightThreshold?: number, adjustmentAmount?: number } = {}) {
  // ... (此函数与之前版本完全相同)
  const {
    darkThreshold = 0.2,
    lightThreshold = 0.8,
    adjustmentAmount = 0.28,
  } = options

  const color = chroma(colorInput)
  const luminance = color.luminance()
  const midpoint = (darkThreshold + lightThreshold) / 2

  let newColor
  let status, range

  if (luminance < darkThreshold) {
    range = `L < ${darkThreshold}`
    status = '过暗 → 提亮'
    newColor = color.brighten(adjustmentAmount)
  }
  else if (luminance > lightThreshold) {
    range = `L > ${lightThreshold}`
    status = '过亮 → 压暗'
    newColor = color.darken(adjustmentAmount)
  }
  else {
    if (luminance < midpoint) {
      range = `${darkThreshold} ≤ L < ${midpoint}`
      status = '中间偏暗 → 压暗 (增反差)'
      newColor = color.darken(adjustmentAmount / 2)
    }
    else {
      range = `${midpoint} ≤ L ≤ ${lightThreshold}`
      status = '中间偏亮 → 提亮 (增反差)'
      newColor = color.brighten(adjustmentAmount / 2)
    }
  }
  return {
    originalHex: color.hex(),
    hex: newColor.hex(),
    luminance,
    status,
    range,
  }
}

/**
 * 计算两个颜色之间的对比度
 * @param color1 第一个颜色
 * @param color2 第二个颜色
 * @returns 对比度值 (1-21)
 */
function getContrastRatio(color1: chroma.Color, color2: chroma.Color): number {
  const l1 = color1.luminance()
  const l2 = color2.luminance()
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 生成与背景有足够对比度的边框颜色
 * @param backgroundColor 背景颜色
 * @param borderColor 原始边框颜色（可能为空）
 * @param minContrast 最小对比度，默认3.0
 * @returns 优化后的边框颜色
 */
export function generateBlockquoteBorderColor(
  backgroundColor: string,
  borderColor?: string,
  minContrast: number = 3.0,
): string {
  try {
    const bgColor = chroma(backgroundColor)
    const isDark = isDarkColor(backgroundColor)

    // 如果提供了边框颜色，先检查对比度
    if (borderColor) {
      try {
        const currentBorder = chroma(borderColor)
        const contrast = getContrastRatio(bgColor, currentBorder)

        // 如果对比度足够，直接使用原边框颜色
        if (contrast >= minContrast) {
          return borderColor
        }
      }
      catch {
        console.warn('无效的边框颜色:', borderColor)
      }
    }

    // 对比度不足，生成新的边框颜色
    if (isDark) {
      // 深色主题：使用较亮的边框
      const lightness = bgColor.get('hsl.l')

      // 根据背景亮度调整边框亮度
      let borderLightness = Math.min(lightness + 0.3, 0.8)

      // 生成边框颜色并检查对比度
      for (let i = 0; i < 10; i++) {
        const testBorder = bgColor.set('hsl.l', borderLightness)
        const contrast = getContrastRatio(bgColor, testBorder)

        if (contrast >= minContrast) {
          return testBorder.hex()
        }

        borderLightness = Math.min(borderLightness + 0.1, 0.9)
      }

      // 回退到白色边框
      return 'rgba(255, 255, 255, 0.4)'
    }
    else {
      // 浅色主题：使用较暗的边框
      const lightness = bgColor.get('hsl.l')

      // 根据背景亮度调整边框亮度
      let borderLightness = Math.max(lightness - 0.3, 0.1)

      // 生成边框颜色并检查对比度
      for (let i = 0; i < 10; i++) {
        const testBorder = bgColor.set('hsl.l', borderLightness)
        const contrast = getContrastRatio(bgColor, testBorder)

        if (contrast >= minContrast) {
          return testBorder.hex()
        }

        borderLightness = Math.max(borderLightness - 0.1, 0.05)
      }

      // 回退到黑色边框
      return 'rgba(0, 0, 0, 0.4)'
    }
  }
  catch (error) {
    console.error('生成边框颜色失败:', error)
    // 安全回退
    return isDarkColor(backgroundColor)
      ? 'rgba(255, 255, 255, 0.3)'
      : 'rgba(0, 0, 0, 0.3)'
  }
}

/**
 * 生成blockquote嵌套层级背景颜色
 * @param baseColor 基础背景颜色
 * @param levels 生成的层级数量，默认5层
 * @returns 包含5个层级颜色的数组
 */
export function generateBlockquoteColors(baseColor: string, levels: number = 5): string[] {
  try {
    const base = chroma(baseColor)
    const isDark = isDarkColor(baseColor)
    const colors: string[] = []

    // 计算基础透明度和步进值
    const baseAlpha = isDark ? 0.08 : 0.05 // 深色主题使用更高的透明度
    const alphaStep =   0.03 // 每层递增的透明度

    // 选择一个与背景对比良好的叠加颜色
    let overlayColor: chroma.Color
    if (isDark) {
      // 深色主题：使用偏白色的叠加
      overlayColor = chroma('#ffffff')
    }
    else {
      // 浅色主题：使用偏灰蓝色的叠加
      overlayColor = chroma('#4a5568')
    }

    // 生成每个层级的颜色
    for (let i = 0; i < levels; i++) {
      const alpha = baseAlpha + (alphaStep * i)
      // 使用mix方法混合颜色，而不是简单的透明度叠加
      const mixRatio = Math.min(alpha * 2, 0.4) // 控制混合比例
      const levelColor = chroma.mix(base, overlayColor, mixRatio, 'lab')
      colors.push(levelColor.hex())
    }

    return colors
  }
  catch (error) {
    console.error('生成blockquote颜色失败:', error)
    // 返回安全的回退颜色
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

/**
 * 为选择区域生成智能背景色
 * 确保选择背景与前景文字有足够的对比度
 * @param foregroundColor 前景文字颜色
 * @param selectionBackground 原始选择背景色（可选）
 * @param minContrast 最小对比度要求（默认3.0）
 * @returns 优化后的选择背景色
 */
export function generateSelectionBackgroundColor(
  foregroundColor: string,
  selectionBackground?: string,
  minContrast: number = 3.0,
): string {
  try {
    const fgColor = chroma(foregroundColor)
    const isDarkForeground = isDarkColor(foregroundColor)

    // 如果提供了选择背景色，先检查对比度
    if (selectionBackground) {
      try {
        const currentSelection = chroma(selectionBackground)
        const contrast = getContrastRatio(currentSelection, fgColor)

        // 如果对比度足够，直接使用原选择背景色
        if (contrast >= minContrast) {
          return selectionBackground
        }
      }
      catch {
        console.warn('无效的选择背景色:', selectionBackground)
      }
    }

    // 对比度不足，生成新的选择背景色
    // 策略：选择背景应该与前景文字形成对比，但不能太突兀
    if (isDarkForeground) {
      // 深色前景文字：需要浅色选择背景
      const lightness = fgColor.get('hsl.l')
      
      // 从较亮的基础开始
      let bgLightness = Math.max(lightness + 0.4, 0.7)
      
      // 生成选择背景并检查对比度
      for (let i = 0; i < 10; i++) {
        const testBg = fgColor.set('hsl.l', bgLightness).alpha(0.3)
        const contrast = getContrastRatio(testBg, fgColor)
        
        if (contrast >= minContrast) {
          return testBg.css()
        }
        
        bgLightness = Math.min(bgLightness + 0.05, 0.95)
      }
      
      // 回退到浅色半透明背景
      return 'rgba(255, 255, 255, 0.3)'
      
    } else {
      // 浅色前景文字：需要深色选择背景
      const lightness = fgColor.get('hsl.l')
      
      // 从较暗的基础开始
      let bgLightness = Math.min(lightness - 0.4, 0.3)
      
      // 生成选择背景并检查对比度
      for (let i = 0; i < 10; i++) {
        const testBg = fgColor.set('hsl.l', bgLightness).alpha(0.4)
        const contrast = getContrastRatio(testBg, fgColor)
        
        if (contrast >= minContrast) {
          return testBg.css()
        }
        
        bgLightness = Math.max(bgLightness - 0.05, 0.05)
      }
      
      // 回退到深色半透明背景
      return 'rgba(0, 0, 0, 0.4)'
    }
    
  } catch (error) {
    console.error('生成选择背景色失败:', error)
    // 安全回退
    return isDarkColor(foregroundColor)
      ? 'rgba(255, 255, 255, 0.25)'
      : 'rgba(0, 0, 0, 0.25)'
  }
}

/**
 * 为特定主题生成提亮的前景色
 * 解决深色背景主题中前景色过暗的问题
 * @param themeName - 主题名称
 * @param backgroundColor - 背景色
 * @param originalForeground - 原始前景色
 * @returns 优化后的前景色
 */
export function generateBrightenedForegroundColor(
  themeName: string,
  backgroundColor: string,
  originalForeground: string
): string {
  // 需要前景色提亮的深色主题列表
  const themesThatNeedBrightening = [
    'synthwave-84',
    'min-dark', 
    'aurora-x'
  ]

  // 如果不是需要优化的主题，直接返回原前景色
  if (!themesThatNeedBrightening.includes(themeName)) {
    return originalForeground
  }

  try {
    const fgColor = chroma(originalForeground)
    
    // 简单提亮：增加亮度值
    const brightenedColor = fgColor.brighten(1.5) // 提亮 1.5 个单位
    
    return brightenedColor.hex()
  } catch (error) {
    console.warn(`生成提亮前景色失败 (${themeName}):`, error)
    
    // 安全回退颜色
    if (isDarkColor(backgroundColor)) {
      return '#E4E4E4' // 深色背景使用浅色前景
    } else {
      return originalForeground // 浅色背景保持原前景色
    }
  }
}
