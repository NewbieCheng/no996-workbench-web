export type TonePreset =
  | '自然'
  | '热情'
  | '沉稳'
  | '亲切'
  | '开心轻松'
  | '新闻播报'
  | '自定义'

export const TONE_PRESET_CUSTOM: TonePreset = '自定义'

export const TONE_PRESETS: Array<{ label: TonePreset; instruction: string }> = [
  { label: '自然', instruction: '' },
  { label: '热情', instruction: '热情洋溢，语调明快，富有亲和力与感染力' },
  { label: '沉稳', instruction: '沉稳从容，语速稍慢，重点突出，信任感强' },
  { label: '亲切', instruction: '亲切温暖，像朋友近距离交谈，语调柔和上扬' },
  { label: '开心轻松', instruction: '用开心、轻松的语气，语速稍快' },
  { label: '新闻播报', instruction: '吐字清晰精准，字正腔圆，严肃专业' },
  { label: '自定义', instruction: '' },
]

export function isTonePreset(value: string): value is TonePreset {
  return TONE_PRESETS.some((p) => p.label === value)
}
