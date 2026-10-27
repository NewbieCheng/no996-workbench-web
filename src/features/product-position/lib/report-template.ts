/**
 * 报告模板的结构描述（唯一来源）。
 *
 * 完整的「正式模板正文」在 `src/prompts/product-positioning.ts` 里逐字内联给模型；
 * 这里只保留解析与校验需要的标题、栏目和字段清单，两边共用同一份模板版本号。
 */

export type ChapterSpec = {
  index: number
  /** H2 标题（模板原文） */
  title: string
  /** 该章固定栏目（H3）；判断时做包含匹配，模型换措辞也能识别 */
  blocks: string[]
  /** 该章允许的 H4 条目前缀，用于解析时识别条目而不是普通段落 */
  itemPrefixes?: string[]
}

export const CHAPTER_SPECS: ChapterSpec[] = [
  {
    index: 1,
    title: '产品与定位',
    blocks: ['建议优先采用的产品定位', '核心客户价值', '可以优先服务哪些人'],
    itemPrefixes: ['人群'],
  },
  {
    index: 2,
    title: '客户与购买动机',
    blocks: ['最值得服务的客户', '当前不适合的客户', '客户在什么情况下会想买', '客户需求如何形成购买理由'],
    itemPrefixes: ['场景', '对应人群与场景'],
  },
  {
    index: 3,
    title: '价值与优势',
    blocks: ['最值得主打的产品优势', '用户说服逻辑链', '有什么独特经验与方法'],
    itemPrefixes: ['优势', '对应人群与场景'],
  },
  {
    index: 4,
    title: '信任素材',
    blocks: [
      '真实客户故事',
      '用户反馈与原话',
      '可以展示的产品细节',
      '团队经历与实践',
      '已有效果与数据',
      '还可以补充哪些信任素材',
    ],
  },
  {
    index: 5,
    title: '购买与表达',
    blocks: [
      '客户具体会获得什么',
      '客户为什么值得买',
      '客户购买前会有哪些顾虑',
      '可以直接调用的核心表达',
      '产品介绍参考',
    ],
    itemPrefixes: ['购买理由', '客户问题'],
  },
  {
    index: 6,
    title: '定位分析详情',
    blocks: [
      '为什么推荐当前定位',
      '客户替代方案比较',
      '其他可选定位方向',
      '当前定位最薄弱的环节',
      '验证与改进计划',
    ],
  },
]

/** 报告基础信息表固定四列。 */
export const META_LABELS = ['产品类别', '当前阶段', '产品价格', '交付形式'] as const

/** 空内容说明是合法值，不触发解析失败。 */
export const EMPTY_MARKERS = ['未提供', '尚待确认', '不适用', '暂无', '待确认'] as const

export function isChapterTitle(title: string, spec: ChapterSpec): boolean {
  return title.replace(/^[一二三四五六]\s*、\s*/, '').includes(spec.title)
}

export function matchesBlockHeading(heading: string, expected: string): boolean {
  const normalized = heading.replace(/^\d+[.、]\s*/, '').trim()
  if (normalized.includes(expected)) return true
  // 允许「用户说服逻辑链」写成「用户说服链路」这类轻微差异
  const core = expected.replace(/[与和的]/g, '')
  return core.length >= 4 && normalized.includes(core)
}

export function isKnownItemTitle(title: string, chapter: ChapterSpec | undefined): boolean {
  if (!chapter?.itemPrefixes?.length) return false
  const head = title.split(/[：:｜|]/)[0]?.trim() ?? ''
  return chapter.itemPrefixes.some((prefix) => head.startsWith(prefix))
}
