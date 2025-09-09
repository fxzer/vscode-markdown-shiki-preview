import { useLogger } from 'reactive-vscode'
import { displayName } from './generated/meta'

export const logger = useLogger(displayName)

/**
 * 生成一个随机的 nonce 字符串
 * 用于 Content Security Policy (CSP) 中的脚本安全验证
 *
 * @returns 32位随机字符串
 */
export function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const possibleLength = possible.length

  return Array.from({ length: 32 }, () =>
    possible.charAt(Math.floor(Math.random() * possibleLength))).join('')
}
