const fs = require('node:fs')
const path = require('node:path')
const { createHighlighter } = require('shiki')

async function extractThemeColors() {
  console.log('正在初始化 Shiki 高亮器...')

  const themes = ['github-dark-default', 'vitesse-dark', 'dracula-soft', 'synthwave-84', 'min-dark', 'aurora-x']
  const highlighter = await createHighlighter({
    themes,
  })

  const outputDir = path.join(__dirname, '..', 'themes-cssvar')

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  for (const themeName of themes) {
    console.log(`正在处理主题: ${themeName}`)

    try {
      const themeData = highlighter.getTheme(themeName)

      if (!themeData || !themeData.colors) {
        console.warn(`主题 ${themeName} 数据不完整`)
        continue
      }

      // 生成 CSS 变量
      const cssVariables = Object.entries(themeData.colors)
        .map(([key, value]) => `  --${key.replace(/\./g, '-')}: ${value};`)
        .join('\n')

      // 生成完整的 CSS 文件内容
      const cssContent = `/* ${themeName} 主题 CSS 变量 */
:root {
${cssVariables}
}
`

      // 写入文件
      const outputPath = path.join(outputDir, `${themeName}.css`)
      fs.writeFileSync(outputPath, cssContent)

      console.log(`✅ 已生成: ${outputPath}`)
    }
    catch (error) {
      console.error(`❌ 处理主题 ${themeName} 时出错:`, error)
    }
  }

  console.log('主题颜色提取完成！')
}

// 运行脚本
extractThemeColors().catch(console.error)
