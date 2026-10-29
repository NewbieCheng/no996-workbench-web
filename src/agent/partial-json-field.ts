/**
 * 从「还在流式生成、可能不完整」的 JSON 里取一个字符串字段。
 *
 * 规划类流程返回 JSON，界面不能直接展示花括号。这里只把指定字段的字符
 * 抽出来（支持被截断的半截值），用于「文字正在长出来」的等待反馈。
 * 找不到/未开始/已结束引号都只返回当前已拿到的部分，不抛错。
 */
export function extractPartialJsonField(raw: string, key: string): string {
  if (!raw) return ''
  const marker = `"${key}"`
  const keyAt = raw.indexOf(marker)
  if (keyAt < 0) return ''
  const colonAt = raw.indexOf(':', keyAt + marker.length)
  if (colonAt < 0) return ''
  let quoteAt = colonAt + 1
  while (quoteAt < raw.length && /\s/.test(raw[quoteAt])) quoteAt += 1
  if (raw[quoteAt] !== '"') return ''

  let out = ''
  let escaped = false
  for (let i = quoteAt + 1; i < raw.length; i += 1) {
    const char = raw[i]
    if (escaped) {
      if (char === 'n') out += '\n'
      else if (char === 't') out += '\t'
      else if (char === 'r') out += ''
      else if (char === '"' || char === '\\' || char === '/') out += char
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') break
    out += char
  }
  return out
}

/** 取数组字段里的第一个字符串（例如 suggestedTitles[0]），用于规划早期反馈。 */
export function extractPartialFirstArrayString(raw: string, key: string): string {
  if (!raw) return ''
  const marker = `"${key}"`
  const keyAt = raw.indexOf(marker)
  if (keyAt < 0) return ''
  const bracketAt = raw.indexOf('[', keyAt + marker.length)
  if (bracketAt < 0) return ''
  const quoteAt = raw.indexOf('"', bracketAt + 1)
  if (quoteAt < 0) return ''
  let out = ''
  let escaped = false
  for (let i = quoteAt + 1; i < raw.length; i += 1) {
    const char = raw[i]
    if (escaped) {
      if (char === 'n') out += '\n'
      else if (char === 't') out += '\t'
      else if (char === '"' || char === '\\' || char === '/') out += char
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') break
    out += char
  }
  return out
}
