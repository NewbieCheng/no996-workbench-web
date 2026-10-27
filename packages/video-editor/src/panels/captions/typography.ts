/**
 * 中文字符宽度测算、标点避头尾折行与溢出检测纯函数
 * 严守原则：绝不截断用户正文
 */

// 避头标点（不能出现在行首）
const NO_START_PUNCTUATION = new Set([
  '，', '。', '！', '？', '；', '：', '、', '）', '》', '”', '’', '…', '—',
  ',', '.', '!', '?', ';', ':', ')', '>', '"', '\'', ']', '}',
])

// 避尾标点（不能出现在行尾）
const NO_END_PUNCTUATION = new Set([
  '（', '《', '“', '‘', '【', '(', '<', '"', '\'', '[', '{',
])

export type TypographyMeasureOptions = {
  fontSize: number
  maxWidth: number
  maxLines?: number
  letterSpacing?: number
}

export type TypographyLayoutResult = {
  lines: string[]
  totalWidth: number
  totalHeight: number
  isOverflow: boolean
  overflowChars: number
  recommendedLines: number
}

/**
 * 计算单个字符在指定字号下的近似显示宽度（全角中文 1em，半角英数 0.5em）
 */
export function getCharWidth(char: string, fontSize: number): number {
  const code = char.charCodeAt(0)
  // 半角 ASCII 与半角片假名等
  if ((code >= 0x0020 && code <= 0x007e) || (code >= 0xff61 && code <= 0xff9f)) {
    return fontSize * 0.55
  }
  return fontSize
}

/**
 * 对中文/英文混合文本进行真实折行与溢出计算（绝不截断文本）
 */
export function layoutChineseText(
  text: string,
  options: TypographyMeasureOptions
): TypographyLayoutResult {
  const { fontSize, maxWidth, maxLines = 2, letterSpacing = 0 } = options

  if (!text || text.length === 0) {
    return {
      lines: [''],
      totalWidth: 0,
      totalHeight: 0,
      isOverflow: false,
      overflowChars: 0,
      recommendedLines: 1,
    }
  }

  const lines: string[] = []
  let currentLine = ''
  let currentLineWidth = 0
  let maxLineWidth = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '\n') {
      lines.push(currentLine)
      if (currentLineWidth > maxLineWidth) maxLineWidth = currentLineWidth
      currentLine = ''
      currentLineWidth = 0
      continue
    }

    const charWidth = getCharWidth(char, fontSize) + letterSpacing

    // 检查是否超出最大宽度
    if (currentLineWidth + charWidth > maxWidth && currentLine.length > 0) {
      // 避头法则：当前字是避头标点时，把上一行末字一起带到下一行，避免标点顶行首。
      if (NO_START_PUNCTUATION.has(char) && currentLine.length > 1) {
        const lastChar = currentLine.slice(-1)
        currentLine = currentLine.slice(0, -1)
        lines.push(currentLine)
        if (currentLineWidth > maxLineWidth) maxLineWidth = currentLineWidth
        currentLine = lastChar + char
        currentLineWidth = getCharWidth(lastChar, fontSize) + letterSpacing + charWidth
      } else if (NO_END_PUNCTUATION.has(currentLine.slice(-1)) && currentLine.length > 1) {
        // 避尾法则：行尾若落在左括号/左引号上，把它挪到下一行，避免与后文断开。
        const lastChar = currentLine.slice(-1)
        const kept = currentLine.slice(0, -1)
        lines.push(kept)
        if (currentLineWidth > maxLineWidth) maxLineWidth = currentLineWidth
        currentLine = lastChar + char
        currentLineWidth = getCharWidth(lastChar, fontSize) + letterSpacing + charWidth
      } else {
        lines.push(currentLine)
        if (currentLineWidth > maxLineWidth) maxLineWidth = currentLineWidth
        currentLine = char
        currentLineWidth = charWidth
      }
    } else {
      currentLine += char
      currentLineWidth += charWidth
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine)
    if (currentLineWidth > maxLineWidth) maxLineWidth = currentLineWidth
  }

  const isOverflow = lines.length > maxLines
  let overflowChars = 0

  if (isOverflow) {
    for (let i = maxLines; i < lines.length; i++) {
      overflowChars += lines[i].length
    }
  }

  const lineHeight = fontSize * 1.4

  return {
    lines, // 必须完整返回所有行，绝不掐头去尾
    totalWidth: Math.round(maxLineWidth),
    totalHeight: Math.round(lines.length * lineHeight),
    isOverflow,
    overflowChars,
    recommendedLines: lines.length,
  }
}
