import chroma from 'chroma-js'

export function adjustContrastColor(colorInput: string, options: { darkThreshold?: number, lightThreshold?: number, adjustmentAmount?: number } = {}) {
  // ... (此函数与之前版本完全相同)
  const {
    darkThreshold = 0.2,
    lightThreshold = 0.8,
    adjustmentAmount = 0.3,
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
