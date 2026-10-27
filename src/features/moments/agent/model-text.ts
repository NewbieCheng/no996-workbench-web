/** 规划/成稿 flow 共用：把 stage-runner 返回值规范成可解析的围栏文本。 */

export function coerceModelText(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim()
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'object') return JSON.stringify(raw)
  return String(raw).trim()
}

export function fenceJsonForMoments(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('```')) return trimmed
  return `\`\`\`json\n${trimmed}\n\`\`\``
}
