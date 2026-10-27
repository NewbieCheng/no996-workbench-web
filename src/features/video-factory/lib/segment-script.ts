/**
 * 文案分段
 *
 * 把用户输入的一整段口播稿切成「一句一镜」。
 * 纯算法，不调模型 —— 一键出片的镜头选择由规则映射完成（决策 D2）。
 *
 * 切分依据是中文标点与长度上限：一句话太长会让单镜过长，节奏拖沓。
 */

export type ScriptSegment = {
  /** 段落在原文中的序号 */
  index: number
  text: string
  /** 建议时长（微秒），按中文字符数估算 */
  suggestedDurationUs: number
}

/** 中文播报大约每秒 5 个字；标点处留顿挫。 */
const CHARS_PER_SECOND = 5
/** 单镜最长不超过这个字数，超过就按逗号再切 */
const MAX_CHARS_PER_SHOT = 26
/** 单镜最短时长，避免一闪而过 */
const MIN_DURATION_US = 1_500_000

/** 把长句按逗号等次级标点再切，直到每段不超过上限。 */
function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= MAX_CHARS_PER_SHOT) return [sentence]
  const parts = sentence.split(/(?<=[，,；;：:、])/)
  const merged: string[] = []
  let buffer = ''
  for (const part of parts) {
    if ((buffer + part).length > MAX_CHARS_PER_SHOT && buffer) {
      merged.push(buffer)
      buffer = part
    } else {
      buffer += part
    }
  }
  if (buffer) merged.push(buffer)

  // 仍然过长（例如整句无标点），按字数硬切
  return merged.flatMap((chunk) =>
    chunk.length <= MAX_CHARS_PER_SHOT * 1.6
      ? [chunk]
      : chunk.match(new RegExp(`.{1,${MAX_CHARS_PER_SHOT}}`, 'g')) ?? [chunk],
  )
}

export function segmentScript(script: string): ScriptSegment[] {
  const trimmed = script.trim()
  if (!trimmed) return []

  // 先按句末标点切，保留标点
  const sentences = trimmed
    .split(/(?<=[。！？!?…\n])/)
    .map((part) => part.trim())
    .filter(Boolean)

  const pieces = sentences.flatMap((sentence) =>
    splitLongSentence(sentence.replace(/\n+/g, ' ').trim()),
  )

  return pieces.map((text, index) => {
    // 统计有效字符（去掉标点与空白）
    const charCount = text.replace(/[\s，,。.！!？?；;：:、…—""''（）()]/g, '').length
    const seconds = Math.max(MIN_DURATION_US / 1_000_000, charCount / CHARS_PER_SECOND)
    return {
      index,
      text,
      suggestedDurationUs: Math.round(seconds * 1_000_000),
    }
  })
}

/** 供 UI 显示：总字数与估算时长。 */
export function scriptStats(segments: ScriptSegment[]): { chars: number; durationUs: number } {
  return {
    chars: segments.reduce((sum, item) => sum + item.text.length, 0),
    durationUs: segments.reduce((sum, item) => sum + item.suggestedDurationUs, 0),
  }
}
