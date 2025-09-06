import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
  ],
  format: ['cjs'],
  shims: false,
  dts: false,
  external: [
    'vscode',
  ],
  plugins: [
    {
      name: 'copy-webview-files',
      generateBundle() {
        const files = [
          { src: 'template.hbs', type: 'asset' },
          { src: 'styles.css', type: 'asset' },
          { src: 'webview.js', type: 'asset' },
        ]
        files.forEach(({ src, type }: any) => {
          this.emitFile({
            type,
            fileName: `webview/${src}`,
            source: fs.readFileSync(path.resolve(__dirname, `src/webview/${src}`), 'utf-8'),
          })
        })
      },
    },
  ],
})
