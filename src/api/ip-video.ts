import { extensionClient } from '../services/extension/extension-client'

/** Collect existing public work text through the installed extension; this does not transcribe video audio. */
export async function extractIPVideoScript(url: string, signal?: AbortSignal): Promise<string> {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('请输入有效的 HTTP 或 HTTPS 作品链接。')
  const check = () => { if (signal?.aborted) throw new DOMException('采集已取消', 'AbortError') }
  check()
  const status = await extensionClient.checkStatus()
  check()
  if (!status.connected) throw new Error('请安装并连接采集扩展，或直接粘贴口播文案。')
  const work = await extensionClient.resolveWork(parsed.href)
  check()
  const content = work.content?.trim()
  if (!content || Array.from(content.replace(/\s/g, '')).length < 20) throw new Error('该作品未提供足够的正文。当前不支持视频语音转写，请直接粘贴口播文案。')
  return content
}
