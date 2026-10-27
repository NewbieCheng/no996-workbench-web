import type {
  ParseIssue,
  ParseResult,
  ProductReportView,
  ReportBlock,
  ReportChapter,
  ReportField,
  ReportGroup,
  ReportItem,
  ReportTable,
} from '../../../services/product-position/types.ts'
import { CHAPTER_SPECS, META_LABELS, isChapterTitle, matchesBlockHeading } from './report-template.ts'

/**
 * 把模型返回的固定 Markdown 报告解析成页面视图模型。
 *
 * 设计原则：
 * - 以模板的标题层级为准（H1/H2/H3/H4），不按空行或关键词硬拆；
 * - 无法识别的内容一律保留在 `unrecognized`，界面折叠展示，绝不丢弃；
 * - `未提供 / 尚待确认 / 不适用` 是合法内容，不当作缺失；
 * - 解析只做结构与归属，不做商业判断，也不改写原文。
 */

type Target = {
  chapter?: ReportChapter
  block?: ReportBlock
  item?: ReportItem
  group: ReportGroup
}

const EMPTY_GROUP = (): ReportGroup => ({
  paragraphs: [],
  fields: [],
  bullets: [],
  quotes: [],
  tables: [],
})

function newGroup(title?: string): ReportGroup {
  return { title, ...EMPTY_GROUP() }
}

function splitRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '\\' && line[i + 1] === '|') {
      current += '|'
      i += 1
      continue
    }
    if (ch === '|') {
      cells.push(current)
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current)
  if (cells.length > 0 && cells[0].trim() === '') cells.shift()
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop()
  return cells.map((cell) =>
    cell
      .trim()
      .replace(/\\\|/g, '|')
      .replace(/<br\s*\/?>/gi, '\n'),
  )
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(line) && line.includes('-')
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|')
}

const FIELD_RE = /^(?:[-*+]|\d+[.)])\s+\*\*(.+?)\*\*\s*(.*)$/
const BULLET_RE = /^(?:[-*+]|\d+[.)])\s+(.*)$/
const BOLD_ONLY_RE = /^\*\*(.+?)\*\*\s*$/
const QUOTE_RE = /^>\s?(.*)$/
/** 水平分隔线只是排版，不是内容；模型常在开头或章节之间加 `---`。 */
const HR_RE = /^(?:-{3,}|\*{3,}|_{3,})$/

/** 模板开头的基础信息表：四列且表头是固定字段。 */
function isMetaTable(table: ReportTable): boolean {
  if (table.headers.length !== META_LABELS.length) return false
  return META_LABELS.some((label) => table.headers.some((header) => header.includes(label)))
}

function groupHasContent(group: ReportGroup): boolean {
  return (
    group.paragraphs.length > 0 ||
    group.fields.length > 0 ||
    group.bullets.length > 0 ||
    group.quotes.length > 0 ||
    group.tables.length > 0
  )
}

function pruneBlock(block: ReportBlock): ReportBlock | null {
  block.groups = block.groups.filter(groupHasContent)
  block.items = block.items.filter((item) => {
    item.groups = item.groups.filter(groupHasContent)
    return item.groups.length > 0 || Boolean(item.title)
  })
  if (block.groups.length === 0 && block.items.length === 0) return null
  return block
}

function splitLabel(raw: string): string {
  return raw.trim().replace(/[：:]\s*$/, '')
}

function cjkEdge(text: string): boolean {
  return /[\u4e00-\u9fff]$/.test(text)
}

function joinParagraph(buffer: string[]): string {
  return buffer.reduce((acc, part) => {
    if (!acc) return part
    if (cjkEdge(acc) || /^[\u4e00-\u9fff]/.test(part)) return acc + part
    return `${acc} ${part}`
  }, '')
}

/** 章节内的当前写入目标；H4 出现后写入条目，否则写块级分组。 */
function targetGroup(target: Target): ReportGroup {
  return target.group
}

export function parseProductReport(markdown: string): ParseResult {
  const issues: ParseIssue[] = []
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n')
  const lines = source.split('\n')

  let title = ''
  let summary = ''
  const meta: ReportField[] = []
  const chapters: ReportChapter[] = []
  const unrecognized: ReportBlock[] = []

  let currentChapter: ReportChapter | undefined
  let currentBlock: ReportBlock | undefined
  let currentItem: ReportItem | undefined
  let unrecognizedBlock: ReportBlock | undefined
  const preambleBlock: ReportBlock = { id: 'u-pre', heading: '', groups: [newGroup()], items: [] }
  let target: Target = { group: preambleBlock.groups[0] }
  let paragraph: string[] = []
  let quoteBuffer: string[] = []
  let table: ReportTable | null = null
  let inFence = false
  let sawMetaTable = false

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    const text = joinParagraph(paragraph).trim()
    paragraph = []
    if (!text) return
    targetGroup(target).paragraphs.push(text)
  }

  const flushQuote = () => {
    if (quoteBuffer.length === 0) return
    const text = joinParagraph(quoteBuffer).trim()
    quoteBuffer = []
    if (!text) return
    if (currentChapter) {
      targetGroup(target).quotes.push(text)
    } else if (!summary) {
      summary = text
    }
  }

  const flushTable = () => {
    if (!table) return
    const finished = table
    table = null
    if (finished.headers.length === 0) return
    if (!currentChapter && !sawMetaTable && isMetaTable(finished)) {
      sawMetaTable = true
      META_LABELS.forEach((label, index) => {
        meta.push({ label, value: finished.rows[0]?.[index]?.trim() ?? '' })
      })
      return
    }
    targetGroup(target).tables.push(finished)
  }

  const closeItem = () => {
    currentItem = undefined
  }

  const ensureBlock = (heading: string): ReportBlock => {
    currentItem = undefined
    const block: ReportBlock = {
      id: '',
      heading,
      groups: [newGroup()],
      items: [],
    }
    currentBlock = block
    return block
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (/^```/.test(trimmed)) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      paragraph.push(trimmed)
      continue
    }

    if (trimmed === '') {
      flushParagraph()
      flushQuote()
      flushTable()
      continue
    }

    if (HR_RE.test(trimmed)) {
      flushParagraph()
      flushQuote()
      flushTable()
      continue
    }

    if (isTableRow(trimmed)) {
      flushParagraph()
      if (!table) table = { headers: splitRow(trimmed), rows: [] }
      else if (isTableSeparator(trimmed)) {
        /* 表头分隔行，跳过 */
      } else {
        table.rows.push(splitRow(trimmed))
      }
      continue
    }
    if (table) flushTable()

    const h1 = /^#\s+(.+)$/.exec(trimmed)
    if (h1) {
      flushParagraph()
      const raw = h1[1].trim()
      const parts = raw.split(/[｜|]/)
      title = (parts.length > 1 ? parts[parts.length - 1] : raw).trim()
      continue
    }

    const h2 = /^##\s+(.+)$/.exec(trimmed)
    if (h2) {
      flushParagraph()
      flushQuote()
      closeItem()
      const heading = h2[1].trim()
      const spec = CHAPTER_SPECS.find((item) => isChapterTitle(heading, item))
      if (spec) {
        const chapter: ReportChapter = {
          index: spec.index,
          title: heading.replace(/^[一二三四五六]\s*、\s*/, '').trim(),
          blocks: [],
        }
        chapters.push(chapter)
        currentChapter = chapter
        // 章节里 H3 之前如果直接出现正文，先挂到一个空的引导块上，避免内容丢失。
        const intro: ReportBlock = { id: `c${spec.index}-intro`, heading: '', groups: [newGroup()], items: [] }
        chapter.blocks.push(intro)
        currentBlock = intro
        unrecognizedBlock = undefined
        target = { chapter, block: intro, group: intro.groups[0] }
      } else {
        currentChapter = undefined
        unrecognizedBlock = ensureBlock(heading)
        unrecognizedBlock.id = `u-${unrecognized.length}`
        unrecognized.push(unrecognizedBlock)
        target = { block: unrecognizedBlock, group: unrecognizedBlock.groups[0] }
      }
      continue
    }

    const h3 = /^###\s+(.+)$/.exec(trimmed)
    if (h3) {
      flushParagraph()
      flushQuote()
      closeItem()
      const heading = h3[1].trim()
      if (currentChapter) {
        const block = ensureBlock(heading)
        block.id = `c${currentChapter.index}-b${currentChapter.blocks.length}`
        currentChapter.blocks.push(block)
        target = { chapter: currentChapter, block, group: block.groups[0] }
      } else if (unrecognizedBlock) {
        const block = ensureBlock(heading)
        block.id = `u-${unrecognized.length}`
        unrecognized.push(block)
        unrecognizedBlock = block
        target = { block, group: block.groups[0] }
      } else {
        const block = ensureBlock(heading)
        block.id = `u-${unrecognized.length}`
        unrecognizedBlock = block
        unrecognized.push(block)
        target = { block, group: block.groups[0] }
      }
      continue
    }

    const h4 = /^####\s+(.+)$/.exec(trimmed)
    if (h4) {
      flushParagraph()
      flushQuote()
      const raw = h4[1].trim()
      const [namePart, ...tagParts] = raw.split(/[｜|]/)
      const item: ReportItem = {
        id: '',
        title: namePart.trim(),
        tag: tagParts.join('｜').trim() || undefined,
        groups: [newGroup()],
      }
      if (currentBlock) {
        item.id = `${currentBlock.id}-i${currentBlock.items.length}`
        currentBlock.items.push(item)
        currentItem = item
        target = { chapter: currentChapter, block: currentBlock, item, group: item.groups[0] }
      } else {
        const block = ensureBlock('未归类内容')
        block.id = `u-${unrecognized.length}`
        unrecognized.push(block)
        currentBlock = block
        unrecognizedBlock = block
        item.id = `${block.id}-i0`
        block.items.push(item)
        currentItem = item
        target = { block, item, group: item.groups[0] }
      }
      continue
    }

    const quote = QUOTE_RE.exec(trimmed)
    if (quote) {
      flushParagraph()
      quoteBuffer.push(quote[1])
      continue
    }
    if (quoteBuffer.length > 0) flushQuote()

    const boldOnly = BOLD_ONLY_RE.exec(trimmed)
    if (boldOnly) {
      flushParagraph()
      const group = newGroup(boldOnly[1].trim())
      if (currentItem) currentItem.groups.push(group)
      else if (currentBlock) currentBlock.groups.push(group)
      else if (unrecognizedBlock) unrecognizedBlock.groups.push(group)
      target = { chapter: currentChapter, block: currentBlock, item: currentItem, group }
      continue
    }

    const field = FIELD_RE.exec(trimmed)
    if (field) {
      flushParagraph()
      const label = splitLabel(field[1])
      const value = field[2].trim()
      const group = targetGroup(target)
      if (label) group.fields.push({ label, value })
      else if (value) group.bullets.push(value)
      continue
    }

    const bullet = BULLET_RE.exec(trimmed)
    if (bullet) {
      flushParagraph()
      targetGroup(target).bullets.push(bullet[1].trim())
      continue
    }

    paragraph.push(trimmed)
  }

  flushParagraph()
  flushQuote()
  // 报告在表格中途结束 = 被截断
  if (table) {
    if (table.headers.length > 0) targetGroup(target).tables.push(table)
    issues.push({ code: 'truncated', message: '报告在表格中途结束，可能是生成被截断。' })
    table = null
  }

  // 章节之外的开头内容（模板外）保留，不丢
  const preamble = pruneBlock(preambleBlock)
  if (preamble) unrecognized.unshift(preamble)
  for (let index = unrecognized.length - 1; index >= 0; index -= 1) {
    const pruned = pruneBlock(unrecognized[index])
    if (pruned) unrecognized[index] = pruned
    else unrecognized.splice(index, 1)
  }
  for (const chapter of chapters) {
    chapter.blocks = chapter.blocks
      .map((block) => pruneBlock(block))
      .filter((block): block is ReportBlock => Boolean(block))
  }

  const meaningful = chapters.some((chapter) => chapter.blocks.length > 0) || unrecognized.length > 0
  if (!title) {
    issues.push({ code: 'missing-title', message: '缺少报告标题（H1），无法确定产品名称。' })
  }
  if (!meaningful) {
    issues.push({ code: 'empty-body', message: '报告没有可识别的内容。' })
  }

  for (const spec of CHAPTER_SPECS) {
    const chapter = chapters.find((item) => item.index === spec.index)
    if (!chapter) {
      issues.push({
        code: 'missing-chapter',
        message: `缺少「${spec.title}」章节。`,
        path: spec.title,
      })
      continue
    }
    if (chapter.blocks.length === 0) {
      issues.push({
        code: 'missing-block',
        message: `「${spec.title}」章节没有固定栏目。`,
        path: spec.title,
      })
      continue
    }
    for (const blockTitle of spec.blocks) {
      const found = chapter.blocks.some((block) => matchesBlockHeading(block.heading, blockTitle))
      if (!found) {
        issues.push({
          code: 'missing-block',
          message: `「${spec.title}」缺少栏目「${blockTitle}」。`,
          path: `${spec.title} / ${blockTitle}`,
        })
      }
    }
  }

  if (unrecognized.length > 0) {
    issues.push({
      code: 'unknown-section',
      message: `有 ${unrecognized.length} 段内容不在固定模板内，已保留在「原文未识别」。`,
    })
  }

  // 章节顺序按 index 排，避免模型打乱顺序影响页签
  chapters.sort((a, b) => a.index - b.index)

  const view: ProductReportView = {
    title,
    summary,
    meta,
    chapters,
    unrecognized,
  }

  const ok = issues.every((issue) => issue.code === 'unknown-section')
  return { view, issues, ok }
}

/** 结构问题（不含「未知章节」告警）。 */
export function structureIssues(issues: ParseIssue[]): ParseIssue[] {
  return issues.filter((issue) => issue.code !== 'unknown-section')
}
