import type {
  ProductReportView,
  ReportBlock,
  ReportChapter,
  ReportItem,
} from '../../../services/product-position/types.ts'

/**
 * 报告的读取辅助：页面与硬校验共用，避免各处自己按标题字符串找栏目。
 */

export function getChapter(view: ProductReportView | undefined, index: number): ReportChapter | undefined {
  return view?.chapters.find((chapter) => chapter.index === index)
}

export function findBlock(chapter: ReportChapter | undefined, keyword: string): ReportBlock | undefined {
  if (!chapter) return undefined
  return chapter.blocks.find((block) => block.heading.includes(keyword))
}

export function findItem(block: ReportBlock | undefined, keyword: string): ReportItem | undefined {
  if (!block) return undefined
  return block.items.find((item) => item.title.includes(keyword))
}

export function itemText(item: ReportItem | undefined): string {
  if (!item) return ''
  const parts: string[] = []
  for (const group of item.groups) {
    parts.push(...group.paragraphs)
    parts.push(...group.bullets)
    parts.push(...group.quotes)
    for (const field of group.fields) {
      if (field.value) parts.push(`${field.label}：${field.value}`)
    }
  }
  return parts.join('\n').trim()
}

export type SellingPoint = {
  id: string
  title: string
  text: string
  benefit: string
  advantage: string
}

export type PurchaseReason = {
  id: string
  title: string
  text: string
  audience: string
  advantage: string
}

export type ReportExpressions = {
  oneLinerPositioning: string
  oneLinerValue: string
  sellingPoints: SellingPoint[]
  intro30s: string
  oralIntro: string
  purchaseReasons: PurchaseReason[]
}

function firstParagraph(item: ReportItem | undefined): string {
  if (!item) return ''
  for (const group of item.groups) {
    if (group.paragraphs.length > 0) return group.paragraphs.join('\n')
  }
  return ''
}

function fieldValue(item: ReportItem | undefined, label: string): string {
  if (!item) return ''
  for (const group of item.groups) {
    const field = group.fields.find((entry) => entry.label.includes(label))
    if (field?.value) return field.value
  }
  return ''
}

/** 可直接复制的表达单元；缺失时返回空串，页面据此隐藏复制按钮。 */
export function collectExpressions(view: ProductReportView | undefined): ReportExpressions {
  const chapter5 = getChapter(view, 5)
  const core = findBlock(chapter5, '可以直接调用的核心表达')
  const intro = findBlock(chapter5, '产品介绍参考')
  const reasons = findBlock(chapter5, '客户为什么值得买')

  const sellingPoints: SellingPoint[] = (core?.items ?? [])
    .filter((item) => item.title.startsWith('核心卖点'))
    .map((item) => ({
      id: item.id,
      title: item.title.replace(/^核心卖点[：:]\s*/, '').trim(),
      text: fieldValue(item, '卖点表达') || firstParagraph(item),
      benefit: fieldValue(item, '客户利益'),
      advantage: fieldValue(item, '对应优势'),
    }))
    .filter((point) => point.text.trim().length > 0)

  const purchaseReasons: PurchaseReason[] = (reasons?.items ?? []).map((item) => ({
    id: item.id,
    title: item.title.replace(/^购买理由[：:]\s*/, '').trim(),
    text: firstParagraph(item) || itemText(item),
    audience: fieldValue(item, '对应人群与场景'),
    advantage: fieldValue(item, '对应优势'),
  }))

  return {
    oneLinerPositioning: firstParagraph(findItem(core, '一句话产品定位')),
    oneLinerValue: firstParagraph(findItem(core, '一句话客户价值')),
    sellingPoints,
    intro30s: firstParagraph(findItem(intro, '30 秒')),
    oralIntro: firstParagraph(findItem(intro, '口语介绍')),
    purchaseReasons,
  }
}

/** 硬校验输入：只取面向客户的营销表达，不把内部判断当成文案检查。 */
export function collectMarketingSegments(view: ProductReportView | undefined): Array<{ id: string; text: string }> {
  const expressions = collectExpressions(view)
  const segments: Array<{ id: string; text: string }> = []
  if (expressions.oneLinerPositioning.trim()) {
    segments.push({ id: 'one-liner-positioning', text: expressions.oneLinerPositioning })
  }
  if (expressions.oneLinerValue.trim()) {
    segments.push({ id: 'one-liner-value', text: expressions.oneLinerValue })
  }
  expressions.sellingPoints.forEach((point, index) => {
    segments.push({ id: `selling-point-${index + 1}`, text: `${point.title}：${point.text}` })
  })
  expressions.purchaseReasons.forEach((reason, index) => {
    if (reason.text.trim()) segments.push({ id: `reason-${index + 1}`, text: reason.text })
  })
  if (expressions.intro30s.trim()) segments.push({ id: 'intro-30s', text: expressions.intro30s })
  if (expressions.oralIntro.trim()) segments.push({ id: 'oral-intro', text: expressions.oralIntro })
  return segments
}

/** 报告是否具备可读内容（用于空态判断）。 */
export function reportHasContent(view: ProductReportView | undefined): boolean {
  if (!view) return false
  return view.chapters.some((chapter) => chapter.blocks.length > 0) || view.unrecognized.length > 0
}
