/** 中文口播 TTS（rate=1）实测约 6 个可读字/秒，与平台配音一致 */
const DEFAULT_CHARS_PER_SECOND = 6

/** 逗号、句号等轻停顿（秒） */
const PUNCTUATION_PAUSE_SECONDS = 0.15

/** 换行视为段落换气，等价两次轻停顿 */
const LINE_BREAK_PAUSE_WEIGHT = 2

const SPEAKABLE_CHAR = /[\p{Script=Han}\p{L}\p{N}]/u
const LIGHT_PAUSE_PUNCT = /[，,、；;：:。！？!?…]/

/** 与 meta 栏「N 字」一致：按 Unicode 码点计全文长度 */
export function countScriptCharacters(text: string): number {
  return Array.from(text).length
}

/**
 * 根据台词估算口播秒数（未生成配音前）。
 * 只按可读字计语速，标点与换行单独加停顿，避免「108 字 ≈ 28 秒」这类偏慢估计。
 */
export function estimateScriptDurationSeconds(text: string, speechRate = 1): number {
  const trimmed = text.trim()
  if (!trimmed) return 0

  let speakable = 0
  let pauseWeight = 0

  for (const ch of trimmed) {
    if (SPEAKABLE_CHAR.test(ch)) {
      speakable += 1
    } else if (LIGHT_PAUSE_PUNCT.test(ch)) {
      pauseWeight += 1
    } else if (ch === '\n') {
      pauseWeight += LINE_BREAK_PAUSE_WEIGHT
    }
  }

  if (speakable === 0 && pauseWeight === 0) return 0

  const rate = speechRate > 0 ? speechRate : 1
  const seconds =
    speakable / (DEFAULT_CHARS_PER_SECOND * rate) + pauseWeight * PUNCTUATION_PAUSE_SECONDS

  return Math.max(1, Math.round(seconds))
}

export type ScriptDurationDisplay = {
  seconds: number
  /** true 表示「~」预估；false 表示与当前配音一致的实际时长 */
  approximate: boolean
}

/** meta 栏展示：文案与当前配音一致时优先用实测 audioDuration */
export function resolveScriptDurationDisplay(input: {
  text: string
  versionText?: string
  audioDuration?: number
  speechRate?: number
}): ScriptDurationDisplay {
  const { text, versionText, audioDuration, speechRate } = input
  const hasMeasured =
    typeof audioDuration === 'number' &&
    Number.isFinite(audioDuration) &&
    audioDuration > 0 &&
    versionText !== undefined &&
    versionText === text

  if (hasMeasured) {
    return { seconds: Math.max(1, Math.round(audioDuration)), approximate: false }
  }

  return {
    seconds: estimateScriptDurationSeconds(text, speechRate),
    approximate: true,
  }
}
