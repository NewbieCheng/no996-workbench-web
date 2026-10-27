/**
 * 口播/工厂共用字幕预设（原 IP TALK_CAPTION_PRESETS，抽入 video-editor 避免 features 反向依赖）。
 */

import type { CaptionStyle } from '../../core/project.ts'

export type CaptionPreset = {
  id: string
  name: string
  description: string
  category: '日常讲解' | '重点表达' | '故事与人文' | '信息与访谈'
  style: CaptionStyle
}

const base: CaptionStyle = {
  mode: 'clean',
  font: 'Alibaba PuHuiTi',
  weight: 700,
  size: 58,
  color: '#ffffff',
  emphasisColor: '#ffd60a',
  backgroundColor: '#101820cc',
  outlineColor: '#111111',
  outlineWidth: 0,
  xRatio: 0.5,
  yRatio: 0.8,
  widthRatio: 0.82,
  lineHeight: 1.4,
  letterSpacing: 0,
  motion: 0.5,
  entrance: 'fade-up',
  exit: 'fade',
  align: 'center',
  pageLines: 2,
  burn: true,
}

/** 12 套字幕组合；只改字幕外观，不改构图/配音。 */
export const CAPTION_PRESETS: CaptionPreset[] = [
  { id: 'studio', name: '清爽讲解', category: '日常讲解', description: '底部双行，黑体白字，轻柔上浮。', style: { ...base, size: 58 } },
  { id: 'editorial', name: '杂志观点', category: '信息与访谈', description: '宋体侧栏与朱红竖线，适合配合左右分区。', style: { ...base, mode: 'editorial', font: 'Noto Serif SC', weight: 400, size: 52, color: '#fff8e9', emphasisColor: '#ff795e', backgroundColor: '#121418e6', xRatio: 0.75, yRatio: 0.55, widthRatio: 0.38, lineHeight: 1.5, entrance: 'slide', align: 'left' } },
  { id: 'bold', name: '醒目短句', category: '重点表达', description: '黄油体居中大字，明黄强调与缩放入场。', style: { ...base, mode: 'kinetic', font: 'ZCOOL QingKe HuangYou', weight: 400, size: 94, emphasisColor: '#ffe43b', backgroundColor: '', outlineWidth: 4, yRatio: 0.5, widthRatio: 0.84, lineHeight: 1.25, motion: 0.65, entrance: 'pop', exit: 'fade-up', pageLines: 1 } },
  { id: 'warm', name: '温柔叙述', category: '故事与人文', description: '秀丽字形与暖棕衬底，前后句滚动。', style: { ...base, mode: 'rolling', font: 'ZCOOL XiaoWei', weight: 400, size: 62, color: '#fff8ef', emphasisColor: '#ffc58a', backgroundColor: '#2f1f1bd1', yRatio: 0.67, lineHeight: 1.55, motion: 0.38, entrance: 'fade' } },
  { id: 'playful', name: '轻松活泼', category: '重点表达', description: '手绘字、青柠重点与短句弹入。', style: { ...base, mode: 'kinetic', font: 'ZCOOL KuaiLe', weight: 400, size: 82, emphasisColor: '#a8f06a', backgroundColor: '#122525c7', outlineColor: '#102322', outlineWidth: 2, yRatio: 0.58, widthRatio: 0.84, lineHeight: 1.3, entrance: 'pop', exit: 'slide', pageLines: 1 } },
  { id: 'ink', name: '国风故事', category: '故事与人文', description: '楷书暖金字，墨色衬底与底部双行。', style: { ...base, font: 'Ma Shan Zheng', weight: 400, size: 66, color: '#fff4d7', emphasisColor: '#e9bd63', backgroundColor: '#161411d1', lineHeight: 1.5 } },
  { id: 'minimal', name: '极简单行', category: '日常讲解', description: '下方单行，无底色，细描边与原位淡入。', style: { ...base, size: 52, backgroundColor: '', outlineWidth: 2, yRatio: 0.84, widthRatio: 0.8, entrance: 'fade', pageLines: 1 } },
  { id: 'interview', name: '访谈名言', category: '信息与访谈', description: '左对齐双行宋体，适合访谈中的完整观点。', style: { ...base, font: 'Noto Serif SC', weight: 400, size: 60, color: '#f3f3ef', backgroundColor: '#18232be6', align: 'left', yRatio: 0.76, widthRatio: 0.78, lineHeight: 1.6, entrance: 'slide' } },
  { id: 'paper', name: '纸上笔记', category: '故事与人文', description: '浅纸色底、深墨字，双行重点笔记。', style: { ...base, font: 'ZCOOL XiaoWei', weight: 400, size: 64, color: '#28221c', emphasisColor: '#9a351e', backgroundColor: '#f5eee3f0', yRatio: 0.72, widthRatio: 0.78, lineHeight: 1.5, entrance: 'fade' } },
  { id: 'headline', name: '黑白宣言', category: '重点表达', description: '无底色白色大字，短句逐段出现。', style: { ...base, mode: 'kinetic', size: 88, emphasisColor: '#ffffff', backgroundColor: '', outlineWidth: 3, yRatio: 0.46, widthRatio: 0.8, entrance: 'fade-up', exit: 'fade-up', pageLines: 1 } },
  { id: 'lecture', name: '课堂重点', category: '日常讲解', description: '深蓝色底与浅蓝字，安静的双行解释。', style: { ...base, size: 60, color: '#e6f3ff', emphasisColor: '#84d5ff', backgroundColor: '#0c263ce6', yRatio: 0.77, widthRatio: 0.78, entrance: 'none', exit: 'none', motion: 0 } },
  { id: 'relay', name: '逐行接力', category: '信息与访谈', description: '黑体滚动三行，当前行白字，上下文弱化。', style: { ...base, mode: 'rolling', size: 60, color: '#b7c1cc', emphasisColor: '#ffffff', backgroundColor: '#121820e6', yRatio: 0.65, lineHeight: 1.65, motion: 0.65, entrance: 'fade', exit: 'fade' } },
]

/** @deprecated 使用 CAPTION_PRESETS；保留别名兼容 IP 口播 */
export const TALK_CAPTION_PRESETS = CAPTION_PRESETS
export type TalkCaptionPreset = CaptionPreset

export function matchingCaptionPreset(style: CaptionStyle): CaptionPreset | undefined {
  return CAPTION_PRESETS.find((preset) =>
    Object.entries(preset.style).every(([key, value]) => style[key as keyof CaptionStyle] === value),
  )
}

export function matchingTalkPreset(style: CaptionStyle): CaptionPreset | undefined {
  return matchingCaptionPreset(style)
}
