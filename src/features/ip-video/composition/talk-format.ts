/** New talking videos only offer these three frames. 3:4 stays readable for old projects. */
export const TALK_FORMAT_CHOICES = [
  { ratio: '9:16', aspect: '9 / 16' },
  { ratio: '16:9', aspect: '16 / 9' },
  { ratio: '1:1', aspect: '1 / 1' },
] as const

export type TalkFormatRatio = (typeof TALK_FORMAT_CHOICES)[number]['ratio']

/** Legacy cover canvas: kept for old projects, never offered as a new format. */
export const TALK_LEGACY_COVER_RATIO = '3:4'

export function talkAspectCss(ratio: string): string {
  if (ratio === '16:9') return '16 / 9'
  if (ratio === TALK_LEGACY_COVER_RATIO) return '3 / 4'
  if (ratio === '1:1') return '1 / 1'
  if (ratio === '4:3') return '4 / 3'
  return '9 / 16'
}
