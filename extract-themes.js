const { createHighlighter } = require('shiki')
const fs = require('fs')
const path = require('path')

async function extractThemeCSS() {
  console.log('正在初始化 Shiki 高亮器...')
  
  const highlighter = await createHighlighter({
    themes: ['github-dark-default', 'vitesse-dark', 'dracula-soft']
  })

  const themes = ['github-dark-default', 'vitesse-dark', 'dracula-soft']
  const outputDir = path.join(__dirname, 'themes-cssvar')

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

      // 默认颜色配置
      const defaultColors = {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f6f8fa',
        'editor.foreground': '#24292e',
        'editorLineNumber.foreground': '#6a737d',
        'panel.border': '#d0d7de',
        'editor.selectionBackground': 'rgba(175,184,193,0.2)',
        'textLink.foreground': '#0969da',
        'textCodeBlock.background': '#f6f8fa',
        'editor.foldBackground': 'rgba(175,184,193,0.15)',
        'textBlockQuote.background': 'rgba(175,184,193,0.1)',
      }

      // 合并主题颜色
      const colors = { ...defaultColors, ...themeData.colors }

      // 生成 CSS 变量
      const cssVariables = Object.entries(colors)
        .map(([key, value]) => `  --${key.replace(/\./g, '-')}: ${value};`)
        .join('\n')

      // 生成完整的 CSS 文件内容
      const cssContent = `/* ${themeName} 主题 CSS 变量 */
:root {
${cssVariables}
}

/* 基础样式 */
body {
  background-color: var(--editor-background);
  color: var(--editor-foreground);
}

h1, h2, h3, h4, h5, h6 {
  color: var(--editor-foreground);
}

blockquote {
  color: var(--editorLineNumber-foreground);
  background-color: var(--textBlockQuote-background);
  border-left-color: var(--panel-border);
  border-radius: 3px;
}

th {
  background-color: var(--editor-lineHighlightBackground);
  color: var(--editor-foreground);
}

th, td {
  border-color: var(--panel-border);
}

code {
  background-color: var(--editor-foldBackground);
  color: var(--editor-foreground);
}

a {
  color: var(--textLink-foreground);
}

/* Shiki 代码块样式 */
.shiki {
  background-color: var(--textCodeBlock-background) !important;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 16px 0;
}
`

      // 写入文件
      const outputPath = path.join(outputDir, `${themeName}.css`)
      fs.writeFileSync(outputPath, cssContent)
      
      console.log(`✅ 已生成: ${outputPath}`)
      
    } catch (error) {
      console.error(`❌ 处理主题 ${themeName} 时出错:`, error)
    }
  }

  console.log('主题 CSS 变量提取完成！')
}

// 运行脚本
extractThemeCSS().catch(console.error)