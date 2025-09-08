const fs = require('node:fs')
const path = require('node:path')
const { createHighlighter, bundledThemes } = require('shiki')

async function extractThemeColors() {
  const themes = Object.keys(bundledThemes)
  const highlighter = await createHighlighter({
    themes,
  })

  const outputDir = path.join(__dirname, '..', 'themes-cssvar')

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // 收集所有主题的变量名
  const allVariableNames = new Set()
  const themeVariables = new Map()
  const themeColors = new Map()

  // 第一遍：收集所有变量名（排除问题主题）
  const excludedThemes = ['min-dark', 'aurora-x', 'synthwave-84']
  for (const themeName of themes) {
    // 排除问题主题
    if (excludedThemes.includes(themeName)) {
      console.log(`跳过主题: ${themeName}`)
      continue
    }

    try {
      const themeData = highlighter.getTheme(themeName)

      if (!themeData || !themeData.colors) {
        console.warn(`主题 ${themeName} 数据不完整`)
        continue
      }

      const variables = Object.keys(themeData.colors)
      themeVariables.set(themeName, variables)
      themeColors.set(themeName, themeData.colors)

      // 将所有变量名添加到集合中
      variables.forEach(varName => allVariableNames.add(varName))
    }
    catch (error) {
      console.error(`❌ 处理主题 ${themeName} 时出错:`, error)
    }
  }

  // 计算每个变量的出现频率
  const variableFrequency = new Map()
  for (const varName of allVariableNames) {
    let count = 0
    for (const themeVars of themeVariables.values()) {
      if (themeVars.includes(varName)) {
        count++
      }
    }
    variableFrequency.set(varName, count)
  }

  // 按出现频率排序，找出最常见的变量
  const sortedVariables = Array.from(variableFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([varName, count]) => ({ varName, count, percentage: (count / themes.length * 100).toFixed(1) }))

  // 显示一些统计信息
  console.log(`\n统计信息:`)
  console.log(`- 总主题数: ${themes.length}`)
  console.log(`- 总变量数: ${allVariableNames.size}`)

  // 显示最常见的20个变量
  console.log(`\n最常见的20个变量:`)
  sortedVariables.slice(0, 20).forEach(({ varName, count, percentage }) => {
    console.log(`- ${varName}: ${count}/${themes.length} (${percentage}%)`)
  })

  // 获取频率前10的变量名
  const top10VariableNames = sortedVariables.slice(0, 10).map(item => item.varName)

  // 为每个主题生成CSS文件，只包含频率前10的变量
  for (const themeName of themes) {
    if (excludedThemes.includes(themeName)) {
      continue
    }

    const colors = themeColors.get(themeName)
    if (!colors)
      continue

    // 只提取频率前10的变量
    const themeTop10Variables = []
    for (const varName of top10VariableNames) {
      if (colors[varName]) {
        themeTop10Variables.push({
          varName,
          count: variableFrequency.get(varName),
          percentage: ((variableFrequency.get(varName) / themes.length) * 100).toFixed(1),
        })
      }
    }

    if (themeTop10Variables.length > 0) {
      const cssContent = generateThemeCSS(themeName, themeTop10Variables, colors)
      const outputPath = path.join(outputDir, `${themeName}.css`)
      fs.writeFileSync(outputPath, cssContent)
      console.log(`✅ 已生成主题文件: ${themeName}.css (包含 ${themeTop10Variables.length} 个变量)`)
    }
    else {
      console.log(`⚠️  主题 ${themeName} 没有频率前10的变量，跳过`)
    }
  }
}

function generateThemeCSS(themeName, variables, colors) {
  const cssVars = variables.map(({ varName, percentage }) => {
    const cssVarName = varName.replace(/\./g, '-')
    const colorValue = colors[varName]
    return `  --${cssVarName}: ${colorValue}; /* ${percentage}% */`
  }).join('\n')

  const comments = variables.map(({ varName, count, percentage }) => {
    return ` * --${varName.replace(/\./g, '-')}: ${varName} (${count}/${Object.keys(bundledThemes).length}, ${percentage}%)`
  }).join('\n')

  return `/* 主题: ${themeName} - 频率最高的变量 */
:root {
${cssVars}
}

/* 变量说明：
${comments}
 */
`
}

// 运行脚本
extractThemeColors().catch(console.error)
