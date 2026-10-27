/**
 * 模型输出解析。
 *
 * 原先 titles-agent-loop.ts:51 extractJson 与 content-generation.ts:9 extractJsonObject
 * 是两份几乎相同的实现，且都用「第一个 { 到最后一个 }」的方式切分，
 * 模型一次输出多段 JSON 时会切错。这里统一为按括号配对扫描。
 */

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = /^```(?:json|javascript|js)?\s*([\s\S]*?)```$/i.exec(trimmed)
  return fenced ? fenced[1].trim() : trimmed
}

/**
 * 按括号配对从文本中取出第一个完整 JSON 对象（或数组）文本。
 * 无法配对时回退到首个 `{`（或 `[`）到文末。
 */
export function extractJsonObject(text: string): string {
  const body = stripCodeFence(text)
  const objStart = body.indexOf('{')
  const arrStart = body.indexOf('[')
  let start = objStart
  let open = '{'
  let close = '}'
  if (objStart < 0 || (arrStart >= 0 && arrStart < objStart)) {
    start = arrStart
    open = '['
    close = ']'
  }
  if (start < 0) return body

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < body.length; i += 1) {
    const ch = body[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === open) depth += 1
    else if (ch === close) {
      depth -= 1
      if (depth === 0) return body.slice(start, i + 1)
    }
  }
  return body.slice(start)
}

/** 解析 JSON，失败时抛出面向用户的错误（不暴露原始堆栈）。 */
export function parseStrictJson<T>(text: string, label = '模型返回'): T {
  const raw = extractJsonObject(text)
  if (!raw.trim()) throw new Error(`${label}为空，请重试。`)
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`${label}不是合法 JSON，已中断本次解析。`)
  }
}

/** 取出 ```fence ... ``` 之间的内容，用于人设所用的围栏 Markdown。 */
export function extractFencedMarkdown(text: string, fence: string): string {
  const re = new RegExp('```' + fence + '\\s*([\\s\\S]*?)```', 'i')
  const match = re.exec(text)
  if (match) return match[1].trim()
  const generic = /```\s*(?:markdown|md)?\s*([\s\S]*?)```/i.exec(text)
  if (generic) return generic[1].trim()
  return text.trim()
}

/** 是否已产出指定围栏 */
export function hasFence(text: string, fence: string): boolean {
  return new RegExp('```' + fence + '\\b', 'i').test(text)
}
