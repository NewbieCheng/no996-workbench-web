import { copyText } from '../services/browser'
import { toastError, toastSuccess } from './toast'

export const VOICE_UPSTREAM_LINK_TIP = '厂商临时外链，约 24 小时有效；点击复制完整地址'

export async function copyVoiceUpstreamUrl(url: string): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed) return
  try {
    await copyText(trimmed)
    toastSuccess('原始链接已复制')
  } catch {
    toastError('复制失败，请手动选择链接复制。')
  }
}
