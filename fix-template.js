const fs = require('fs');
const content = fs.readFileSync('src/theme-manager.ts', 'utf8');

// 修复字符串模板问题
const fixedContent = content.replace(
    /return `<details\$\{attributes\}\$\{isOpen \? ' open' : ''}>/g,
    'return `<details\${attributes}\${isOpen ? \' open\' : \'\'}>\n<summary>\${summary}</summary>\n<div class="details-inner">\n`'
);

fs.writeFileSync('src/theme-manager.ts', fixedContent);
console.log('Fixed string template issue');