import { getPlatformVoiceCatalog } from '../../api/platform-voice-catalog'
import i18n from '../../i18n'

export const TTS_RATE = { min: 0.5, max: 2, step: 0.1, default: 1 }
export const TTS_VOLUME = { min: 0, max: 100, step: 1, default: 50 }
export const TTS_PITCH = { min: 0.5, max: 2, step: 0.1, default: 1 }
/** 直配：单次提交合成的文稿上限（与 TTS 任务、textarea maxLength 一致） */
export const TTS_INPUT_MAX = 10000

/** 高阶拆段：整篇输入文稿上限（拆段后各段仍按单次 TTS 上限分批合成） */
export const VOICE_ADVANCED_DOC_MAX = 20000

/** 单次 segment_planner 模型请求携带的正文上限（为 system + JSON 输出留余量） */
export const VOICE_ADVANCED_PLANNER_CHUNK_MAX = 5500

/** 拆段模型单步墙钟上限（流式有 chunk 时由 idle 续期，不超过此值） */
export const VOICE_ADVANCED_PLANNER_STEP_MAX_MS = 600_000

/** 拆段流式 idle：连续无 chunk 超过此时长才中断 */
export const VOICE_ADVANCED_PLANNER_STREAM_IDLE_MS = 120_000

/** 高阶配音合成前单段正文软上限，降低超长合成超时失败 */
export const VOICE_ADVANCED_TTS_SEGMENT_SOFT_MAX = 3500

/** 高阶拆段后单段正文硬顶（与直配 TTS API 上限一致） */
export const VOICE_ADVANCED_TTS_SEGMENT_HARD_MAX = TTS_INPUT_MAX

/** 方案校验后段数超过该值时在任务 meta 写 segments_warning */
export const VOICE_ADVANCED_SEGMENTS_WARN_COUNT = 80

/** 与上游 instruction(s) 对齐；空字符串表示不传。CosyVoice 建议 ≤100 字符（官方计数规则）。 */
export const TTS_INSTRUCTION_MAX_LEN = 100

/** Preset `value` is sent as TTS instruction; empty string clears. */
export const TTS_INSTRUCTION_PRESETS: Array<{ label: string; value: string }> = [
  { label: '默认', value: '' },
  { label: '开心轻松', value: '用开心、轻松的语气' },
  { label: '严肃正式', value: '用严肃、正式的语气' },
  { label: '温柔舒缓', value: '用温柔、舒缓的语气' },
  { label: '热情感染', value: '用热情、有感染力的语气' },
  { label: '新闻播报', value: '吐字清晰精准，字正腔圆，适合新闻播报' },
]

/** 底栏语气药丸与历史列表共用的展示文案 */
const INSTRUCTION_PRESET_I18N_KEYS: Record<string, string> = {
  '': 'instructionPreset.default',
  '用开心、轻松的语气': 'instructionPreset.relaxed',
  '用严肃、正式的语气': 'instructionPreset.formal',
  '用温柔、舒缓的语气': 'instructionPreset.gentle',
  '用热情、有感染力的语气': 'instructionPreset.passionate',
  '吐字清晰精准，字正腔圆，适合新闻播报': 'instructionPreset.news',
}

export function resolveInstructionPillLabel(instruction: string): string {
  const trimmed = instruction.trim()
  if (!trimmed) return i18n.t('voice:instructionPreset.default')
  const i18nKey = INSTRUCTION_PRESET_I18N_KEYS[trimmed]
  if (i18nKey) return i18n.t(`voice:${i18nKey}`)
  const preset = TTS_INSTRUCTION_PRESETS.find((p) => p.value && p.value === trimmed)
  if (preset) return preset.label
  if (trimmed.length <= 8) return trimmed
  return `${trimmed.slice(0, 7)}…`
}

export const VOICE_AVATAR_GRADIENTS: [string, string][] = [
  ['#ffc48a', '#ff7a1a'],
  ['#ffd2a0', '#f2994a'],
  ['#f9b7a0', '#eb6a4b'],
  ['#ffda9a', '#f5a524'],
  ['#f6bfb0', '#e4725f'],
  ['#ffcfa8', '#ff8f4d'],
]

export const VOICE_WAVE_HEIGHTS = [
  [10, 18, 26, 18, 10],
  [14, 24, 12, 24, 14],
  [8, 20, 28, 20, 8],
  [18, 10, 24, 10, 18],
]

export const PLATFORM_VOICE_TAGS: Record<string, string> = {
  longanlingxin: '知识分享',
  'longanhuan_v3.6': '教程课程',
  longanlufeng: '商业口播',
  longanlingxi: '故事讲述',
}

/** @deprecated Prefer `platformVoiceItems(t)` from `voice-i18n.ts` in React code. */
export function platformVoiceItems() {
  return getPlatformVoiceCatalog().map((v) => ({
    id: v.id,
    label: i18n.t(`voice:platformVoice.${v.id}.label`, { defaultValue: v.label }),
    tag: i18n.t(`voice:platformVoice.${v.id}.tag`, {
      defaultValue: PLATFORM_VOICE_TAGS[v.id] ?? i18n.t('voice:tag.platform'),
    }),
    kind: 'platform' as const,
    selectable: true,
  }))
}

/** 克隆音色展示名称上限（与步骤 2 计数器一致） */
export const CLONE_DISPLAY_NAME_MAX = 20

export const CLONE_NAME_SUGGESTIONS = ['我的主播音', '日常口播', '产品讲解'] as const

/** Step 2 左侧说明区：填充空白并降低误操作 */
export const CLONE_STEP2_GUIDE_TITLE = '创建前了解一下'

export const CLONE_STEP2_GUIDE_ITEMS = [
  '名称只用于你自己辨认，提交后可在「音色管理」查看审核进度。',
  '建议按用途起名（如口播、讲解），配音时更快找到对应音色。',
  '样本仅用于本次克隆；确认名称无误后再点「创建音色」。',
] as const

export const CLONE_READ_SCENES: Record<string, string> = {
  '随机':
    '做运营最怕的不是没灵感，而是灵感来了没抓住。我的办法特别简单：刷到好选题先别急着抄，顺手记下它为什么吸引你，再换成自己的经历讲一遍。',
  '大健康':
    '早上起床先喝一杯温水，再慢慢活动十分钟。这个小习惯坚持一个月，你会发现精神状态明显不一样。',
  '干货分享':
    '今天分享一个提高效率的方法：把一天的任务按重要程度排好序，只先做最重要的三件事。',
  '本地生活':
    '周末想找个安静的地方喝咖啡？这条老街后面藏着一家小店，豆子新鲜，窗边的位置阳光特别好。',
}

export const TTS_DEMO_TEXT =
  '嗨，欢迎来到今天的运营分享。接下来我会用更好懂、更有画面感的方式，把一个实用方法讲清楚，咱们现在就开始吧。'

/** 试听固定短句（会走真实 TTS 扣费，按字符计费） */
export function voicePreviewText(): string {
  return i18n.t('voice:preview.sampleText')
}

/** @deprecated Use `voicePreviewText()` so language follows UI locale. */
export const VOICE_PREVIEW_TEXT = '你好，这是当前音色的试听效果。'

export function ttsDemoText(): string {
  return i18n.t('voice:demo.sampleText')
}

export function formatPointsYuan(points: number): string {
  return (points / 100).toFixed(points % 100 === 0 ? 0 : 2)
}

export function estimateSpeechSeconds(charCount: number, rate: number): number {
  if (charCount <= 0) return 0
  return Math.max(0, Math.round(charCount / 4.5 / rate))
}

export function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
