import type { ChatContentPart, ChatMessage } from '../../api/chat'
import type { StoredChatAttachment } from './types'

function documentBlock(name: string, text: string): string {
  const body = text.trim()
  if (!body) return `【附件：${name}】\n（未能抽出正文）`
  return `【附件：${name}】\n${body}`
}

/**
 * 组装 OpenAI 形 user 消息：先 image_url，再 text（对齐桌面 buildPromptContent 顺序）。
 */
export function buildUserChatMessage(
  text: string,
  attachments: readonly StoredChatAttachment[],
): ChatMessage {
  const parts: ChatContentPart[] = []

  for (const item of attachments) {
    if (item.kind === 'image') {
      parts.push({
        type: 'image_url',
        image_url: { url: item.dataUri },
      })
    }
  }

  const docSections = attachments
    .filter((a): a is Extract<StoredChatAttachment, { kind: 'document' }> => a.kind === 'document')
    .map((a) => documentBlock(a.name, a.text))

  const mergedText = [text.trim(), ...docSections].filter(Boolean).join('\n\n')
  if (mergedText) {
    parts.push({ type: 'text', text: mergedText })
  }

  if (parts.length === 0) {
    return { role: 'user', content: text.trim() || ' ' }
  }
  if (parts.length === 1 && parts[0].type === 'text') {
    return { role: 'user', content: parts[0].text ?? '' }
  }
  return { role: 'user', content: parts }
}
