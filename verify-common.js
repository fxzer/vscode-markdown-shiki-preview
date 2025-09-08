const { createHighlighter, bundledThemes } = require('shiki');

(async () => {
  const excludedThemes = ['min-dark', 'aurora-x', 'synthwave-84'];
  const themes = Object.keys(bundledThemes).filter(t => !excludedThemes.includes(t));
  const highlighter = await createHighlighter({ themes });
  
  console.log('排除问题主题后，剩余主题数:', themes.length);
  console.log('排除的主题:', excludedThemes);
  
  // 检查 editor.background 和 editor.foreground 的出现情况
  let editorBackgroundCount = 0;
  let editorForegroundCount = 0;
  let missingEditorBackground = [];
  let missingEditorForeground = [];
  
  for (const themeName of themes) {
    const themeData = highlighter.getTheme(themeName);
    if ('editor.background' in themeData.colors) {
      editorBackgroundCount++;
    } else {
      missingEditorBackground.push(themeName);
    }
    
    if ('editor.foreground' in themeData.colors) {
      editorForegroundCount++;
    } else {
      missingEditorForeground.push(themeName);
    }
  }
  
  console.log('editor.background 出现次数:', editorBackgroundCount);
  console.log('editor.background 出现率:', (editorBackgroundCount / themes.length * 100).toFixed(1) + '%');
  
  console.log('editor.foreground 出现次数:', editorForegroundCount);
  console.log('editor.foreground 出现率:', (editorForegroundCount / themes.length * 100).toFixed(1) + '%');
  
  if (missingEditorBackground.length > 0) {
    console.log('缺少 editor.background 的主题:', missingEditorBackground);
  }
  
  if (missingEditorForeground.length > 0) {
    console.log('缺少 editor.foreground 的主题:', missingEditorForeground);
  }
  
  if (missingEditorBackground.length === 0 && missingEditorForeground.length === 0) {
    console.log('✅ 确认：所有剩余主题都有 editor.background 和 editor.foreground 变量！');
  }
})();
