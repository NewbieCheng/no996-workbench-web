/**
 * 产品定位与分析：本机数据模型。
 *
 * 与原型（PRD v1）的差异：原型假定服务端持有产品、附件、快照与报告；
 * 本项目暂无产品域接口，因此全部落在本机 IndexedDB，并保留 ownerSub 便于
 * 同一浏览器切换账号时不串数据。报告原文（markdown）永远保留，解析结果只是
 * 程序内部视图模型。
 */

export const SKILL_VERSION = 'v1' as const
export const TEMPLATE_VERSION = 'v1' as const

/** 四个补充问题；键名与提示词、表单、解析保持单一来源。 */
export type ProductAnswerKey = 'usage' | 'current' | 'purchase' | 'delivery'

export type ProductAnswers = Record<ProductAnswerKey, string>

export const EMPTY_ANSWERS: ProductAnswers = {
  usage: '',
  current: '',
  purchase: '',
  delivery: '',
}

export type ProductSpecRow = {
  id: string
  /** 规格 / 版本 / 套餐名称 */
  name: string
  /** 价格与收费方式；「按需报价」「免费」是合法文本，空串不等于 0 元 */
  price: string
}

export type ProductAttachmentKind = 'txt' | 'md' | 'docx' | 'other'

/** 上传成功与内容可分析是两种状态，界面上不得合并。 */
export type ProductAttachmentStatus = 'uploading' | 'parsed' | 'unsupported' | 'failed'

export type ProductAttachment = {
  id: string
  fileName: string
  size: number
  kind: ProductAttachmentKind
  status: ProductAttachmentStatus
  /** 解析出的纯文本；仅 status === 'parsed' 时有意义 */
  text?: string
  error?: string
}

export type PersonaRef = {
  id: string
  name: string
  updatedAt: string
}

export type ProductRecord = {
  id: string
  /** JWT sub；用于同浏览器多账号隔离，缺省视为当前账号 */
  ownerSub?: string
  name: string
  type: string
  specs: ProductSpecRow[]
  answers: ProductAnswers
  attachments: ProductAttachment[]
  /** 提交时冻结的人设引用；生成过程中用户改人设不影响本次 */
  personaRef?: PersonaRef
  createdAt: string
  updatedAt: string
}

/* ---------------------------------- 报告 ---------------------------------- */

export type ReportField = {
  label: string
  value: string
}

export type ReportTable = {
  headers: string[]
  rows: string[][]
}

export type ReportItem = {
  id: string
  /** 条目名，例如「人群 1：副业新手」；无 H4 时为空串 */
  title: string
  /** 标题后附带的标记，例如「建议优先聚焦」 */
  tag?: string
  groups: ReportGroup[]
}

/**
 * 段落、字段、引用、表格的最小组合单元。
 *
 * 模板里既有「- **服务谁：**…」这种字段行，也有「**使用与购买角色**」这种
 * 只占一行的分组标题；统一收进 group，渲染层按顺序铺开，解析层不用为每个
 * 栏目单独写一套结构。
 */
export type ReportGroup = {
  /** 分组标题（模板里的加粗单行），没有就是该块/条目的主体内容 */
  title?: string
  paragraphs: string[]
  fields: ReportField[]
  bullets: string[]
  quotes: string[]
  tables: ReportTable[]
}

export type ReportBlock = {
  id: string
  heading: string
  groups: ReportGroup[]
  items: ReportItem[]
}

export type ReportChapter = {
  /** 1–6，对应模板六章 */
  index: number
  title: string
  blocks: ReportBlock[]
}

export type ProductReportView = {
  /** H1 里的产品名称 */
  title: string
  /** 标题下的简介引用块 */
  summary: string
  /** 基础信息表：产品类别 / 当前阶段 / 产品价格 / 交付形式 */
  meta: ReportField[]
  chapters: ReportChapter[]
  /** 无法归入六章的内容，原文保留，界面折叠展示，绝不丢弃 */
  unrecognized: ReportBlock[]
}

export type ParseIssueCode =
  | 'missing-title'
  | 'missing-chapter'
  | 'missing-block'
  | 'empty-body'
  | 'unclosed-table'
  | 'truncated'
  | 'unknown-section'

export type ParseIssue = {
  code: ParseIssueCode
  message: string
  /** 便于定位的路径，如「三、价值与优势 / 2. 用户说服逻辑链」 */
  path?: string
}

export type ParseResult = {
  view?: ProductReportView
  issues: ParseIssue[]
  /** 结构层面是否可接受（issues 里只有 unknown-section 类告警时仍通过） */
  ok: boolean
}

export type ReportStatus = 'running' | 'succeeded' | 'failed'

export type ReportInputSnapshot = {
  product: ProductRecord
  persona?: {
    id: string
    name: string
    updatedAt: string
    /** 生成时的问卷快照（已归一化） */
    questionnaire: Record<string, string | string[]>
    /** 生成时的主 Profile 正文 */
    content: string
  }
  attachments: Array<Pick<ProductAttachment, 'id' | 'fileName' | 'status' | 'text'>>
}

export type ProductReportSnapshot = {
  id: string
  ownerSub?: string
  productId: string
  taskId?: string
  markdown: string
  view?: ProductReportView
  status: ReportStatus
  issues: ParseIssue[]
  error?: string
  skillVersion: typeof SKILL_VERSION
  templateVersion: typeof TEMPLATE_VERSION
  inputSnapshot: ReportInputSnapshot
  createdAt: string
  updatedAt: string
}

/* ------------------------------- 界面辅助类型 ------------------------------ */

export type ProductListItem = {
  product: ProductRecord
  /** 最新一次成功报告；无则 undefined */
  latestReport?: ProductReportSnapshot
  /** 进行中的任务 id（若有） */
  runningTaskId?: string
  status: 'empty' | 'running' | 'ready' | 'failed'
  updatedAt: string
}

export const PRODUCT_TYPE_PRESETS = [
  '实体商品',
  '课程 / 训练营',
  '咨询 / 服务',
  '软件 / 工具',
  '会员 / 订阅',
  '线下活动',
] as const

export function newProductId(): string {
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID()
  return `prod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function newReportId(): string {
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID()
  return `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function createEmptyProduct(ownerSub?: string): ProductRecord {
  const now = nowIso()
  return {
    id: newProductId(),
    ownerSub,
    name: '',
    type: '',
    specs: [{ id: `spec-${Date.now().toString(36)}`, name: '', price: '' }],
    answers: { ...EMPTY_ANSWERS },
    attachments: [],
    createdAt: now,
    updatedAt: now,
  }
}
