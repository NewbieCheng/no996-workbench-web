/**
 * 爆款标题 · 内置句式库
 *
 * 与 script-lab 的结构库同构：默认内置一份可审计的句式表，
 * 通过 setLibraryProvider 预留「换成本机/后端检索」的接线点，
 * 因此页面与流程都不需要关心句式从哪来。
 */
import type { TargetPlatform, VocabularyFormulaItem } from './types'

export const BUILTIN_FORMULAS: VocabularyFormulaItem[] = [
  {
    id: '#A07',
    formulaName: '数字对比',
    sourceTag: '#A07 数字锚点',
    templateWords: 'N天复盘 / 只留N件 / 前后对比',
    historicalPerformance: '收藏意愿强',
    applicablePlatforms: ['小红书', '抖音', '公众号', 'B站'],
  },
  {
    id: '#B12',
    formulaName: '悬念缺口',
    sourceTag: '#B12 悬念缺口',
    templateWords: '第一步就错？ / 难怪一直 / 为什么很少有人提',
    historicalPerformance: '点击意愿强，注意别做成标题党',
    applicablePlatforms: ['抖音', '小红书', 'B站'],
  },
  {
    id: '#C03',
    formulaName: '身份点名',
    sourceTag: '#C03 身份点名',
    templateWords: '写给XX / XX必看 / 真正拉开差距的',
    historicalPerformance: '受众匹配精准',
    applicablePlatforms: ['小红书', '公众号', '抖音'],
  },
  {
    id: '#D15',
    formulaName: '反常识',
    sourceTag: '#D15 反常识',
    templateWords: '别盲目 / 真正起作用的 / 原来一直想反了',
    historicalPerformance: '容易引发讨论',
    applicablePlatforms: ['公众号', 'B站', '小红书'],
  },
  {
    id: '#E09',
    formulaName: '痛点提问',
    sourceTag: '#E09 痛点提问',
    templateWords: '为什么总 / 没效果？问题多半在 / 卡住的原因',
    historicalPerformance: '共鸣感强',
    applicablePlatforms: ['小红书', '抖音', '公众号'],
  },
  {
    id: '#F21',
    formulaName: '收藏价值',
    sourceTag: '#F21 收藏动机',
    templateWords: '清单收好 / 照抄就行 / 这一篇就够了',
    historicalPerformance: '长尾表现稳定',
    applicablePlatforms: ['小红书', 'B站', '公众号'],
  },
]

/** 每个平台最多取几个句式 */
export const MAX_FORMULAS = 6

export interface TitleLibraryProvider {
  /** 按平台取出候选句式（顺序即提示词里的顺序） */
  list(platform: TargetPlatform, limit?: number): VocabularyFormulaItem[]
}

export const builtinTitleLibrary: TitleLibraryProvider = {
  list(platform, limit = MAX_FORMULAS) {
    const hit = BUILTIN_FORMULAS.filter((f) => f.applicablePlatforms.includes(platform))
    const rest = BUILTIN_FORMULAS.filter((f) => !f.applicablePlatforms.includes(platform))
    return [...hit, ...rest].slice(0, limit)
  },
}

let provider: TitleLibraryProvider = builtinTitleLibrary

export function titleLibrary(): TitleLibraryProvider {
  return provider
}

/** 预留接线点：后续可换成后端/本机检索实现，页面无需改动 */
export function setTitleLibraryProvider(next: TitleLibraryProvider): void {
  provider = next
}

/** 渲染成提示词里可读的一行一条 */
export function renderFormulasForPrompt(formulas: VocabularyFormulaItem[]): string {
  if (!formulas.length) return '（无）'
  return formulas
    .map((f) => `${f.id}｜${f.formulaName}｜可套用词：${f.templateWords}`)
    .join('\n')
}
