#!/usr/bin/env node
/**
 * 主题管理器 - 自动从 Shiki 生成和更新主题配置
 *
 * 使用方法:
 *   node scripts/theme-manager.js analyze    # 分析主题
 *   node scripts/theme-manager.js update     # 更新 package.json
 *   node scripts/theme-manager.js sync       # 分析 + 更新 (推荐)
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { bundledThemes } from 'shiki'

const CONFIG_FILE = 'theme-config.json'
const PACKAGE_FILE = 'package.json'

// 简化版本 - 不需要主题翻译映射

// 简化版本：不再需要描述生成函数

/**
 * 分析所有可用的主题
 */
async function analyzeThemes() {
  console.log('🔍 分析 Shiki 主题中...')

  try {
    // 直接获取主题名称列表，无需创建 highlighter
    const themeNames = Object.keys(bundledThemes)
    console.log(`✅ 发现 ${themeNames.length} 个主题`)

    // 生成配置 - 简化版，只保留主题名称
    const sortedThemes = themeNames.sort()

    const configData = {
      enum: sortedThemes,
      themeCount: sortedThemes.length,
      generatedAt: new Date().toISOString(),
      metadata: {
        shikiVersion: await getShikiVersion(),
        generator: 'theme-manager.js',
      },
    }

    // 保存配置
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2))
    console.log(`💾 主题配置已保存到 ${CONFIG_FILE}`)
    console.log(`📊 共分析 ${configData.themeCount} 个主题`)

    return configData
  }
  catch (error) {
    console.error('❌ 分析主题失败:', error.message)
    throw error
  }
}

// 简化版本：不再需要类型推断

/**
 * 获取 Shiki 版本
 */
async function getShikiVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    return packageJson.dependencies?.shiki || packageJson.devDependencies?.shiki || 'unknown'
  }
  catch {
    return 'unknown'
  }
}

/**
 * 更新 package.json 中的主题配置
 */
async function updatePackageJson(configData = null) {
  console.log('📝 更新 package.json 中...')

  // 如果没有提供配置数据，尝试从文件读取
  if (!configData) {
    if (!fs.existsSync(CONFIG_FILE)) {
      console.error(`❌ ${CONFIG_FILE} 不存在，请先运行 analyze 命令`)
      return false
    }
    configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  }

  // 读取 package.json
  if (!fs.existsSync(PACKAGE_FILE)) {
    console.error(`❌ ${PACKAGE_FILE} 不存在`)
    return false
  }

  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'))

  // 创建备份
  const backupPath = `${PACKAGE_FILE}.backup.${Date.now()}`
  fs.writeFileSync(backupPath, JSON.stringify(packageJson, null, 2))
  console.log(`💾 备份已创建: ${backupPath}`)

  // 更新配置
  const themeProperty = packageJson.contributes?.configuration?.properties?.['markdownThemePreview.currentTheme']

  if (!themeProperty) {
    console.error('❌ 未找到 markdownThemePreview.currentTheme 配置项')
    return false
  }

  const oldCount = themeProperty.enum?.length || 0
  const newCount = configData.enum.length

  console.log(`📊 主题数量: ${oldCount} → ${newCount}`)

  // 更新配置 - 简化版，只设置主题列表
  themeProperty.enum = configData.enum

  // 更新描述
  const baseDescription = 'Select from all available Shiki themes'
  const timestamp = new Date().toLocaleDateString('zh-CN')
  themeProperty.description = `${baseDescription} (自动生成于 ${timestamp})`

  // 保存
  fs.writeFileSync(PACKAGE_FILE, JSON.stringify(packageJson, null, 2))
  console.log('✅ package.json 更新成功')

  // 显示变化
  if (newCount !== oldCount) {
    console.log(`🔄 主题数量变化: ${newCount - oldCount > 0 ? '+' : ''}${newCount - oldCount}`)
  }

  return true
}

/**
 * 显示使用帮助
 */
function showHelp() {
  console.log(`
🎨 主题管理器

用法:
  node scripts/theme-manager.js <command>

命令:
  analyze    分析所有可用的 Shiki 主题
  update     更新 package.json 中的主题配置
  sync       分析主题并更新配置 (推荐)
  help       显示此帮助信息

示例:
  node scripts/theme-manager.js sync
`)
}

/**
 * 主函数
 */
async function main() {
  const command = process.argv[2]

  try {
    switch (command) {
      case 'analyze':
        await analyzeThemes()
        console.log('\\n🎯 下一步: 运行 "node scripts/theme-manager.js update" 更新 package.json')
        break

      case 'update':
        await updatePackageJson()
        console.log('\\n🎯 下一步: 运行 "npm run build" 重新构建扩展')
        break

      case 'sync': {
        console.log('🔄 同步主题配置...')
        const configData = await analyzeThemes()
        await updatePackageJson(configData)
        console.log('\\n✨ 同步完成!')
        console.log('🎯 下一步: 运行 "npm run build" 重新构建扩展')
        break
      }

      case 'help':
      case '--help':
      case '-h':
        showHelp()
        break

      default:
        console.error('❌ 未知命令:', command)
        showHelp()
        process.exit(1)
    }
  }
  catch (error) {
    console.error('❌ 执行失败:', error.message)
    process.exit(1)
  }
}

// 确保 scripts 目录存在
const scriptsDir = path.dirname(process.argv[1])
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true })
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
