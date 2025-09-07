#!/usr/bin/env python3

# 读取文件
with open('src/theme-manager.ts', 'r') as f:
    lines = f.readlines()

# 找到需要修改的行并修复
fixed_lines = []
for i, line in enumerate(lines):
    if 'return `<details${attributes}${isOpen ? \' open\' : \'\'}>' in line:
        # 替换这一行
        fixed_lines.append('        return `<details${attributes}${isOpen ? \' open\' : \'\'}>\n`\n')
        fixed_lines.append('        <summary>${summary}</summary>\n`\n')
        fixed_lines.append('        <div class="details-inner">\n`\n')
    else:
        fixed_lines.append(line)

# 写回文件
with open('src/theme-manager.ts', 'w') as f:
    f.writelines(fixed_lines)

print('Fixed template string issue')