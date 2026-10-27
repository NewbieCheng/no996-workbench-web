import assert from 'node:assert/strict'
import test from 'node:test'
import { parseProductReport, structureIssues } from './report-parser.ts'
import { DEMO_REPORT_MARKDOWN } from '../agent/demo-report.ts'

test('完整模板报告：六章、五表、引用与动态条目都能解析', () => {
  const result = parseProductReport(DEMO_REPORT_MARKDOWN)
  assert.equal(result.ok, true, JSON.stringify(result.issues))
  const view = result.view
  assert.ok(view)
  assert.equal(view.title, '21 天声音训练营')
  assert.match(view.summary, /线上声音训练营/)
  assert.equal(view.meta.length, 4)
  assert.equal(view.meta[0].label, '产品类别')
  assert.equal(view.meta[2].value, '2980 元 / 期，支持分期')
  assert.equal(view.chapters.length, 6)

  const positioning = view.chapters[0]
  assert.equal(positioning.index, 1)
  assert.equal(positioning.blocks.length, 3)
  const personas = positioning.blocks[2].items
  assert.equal(personas.length, 2)
  assert.equal(personas[0].tag, '建议优先聚焦')
  assert.equal(personas[0].groups[0].fields.length, 4)
  assert.equal(personas[0].groups[0].fields[0].label, '服务谁')
})

test('动态表格：不适合客户表与需求匹配表按列解析', () => {
  const view = parseProductReport(DEMO_REPORT_MARKDOWN).view
  assert.ok(view)
  const chapter2 = view.chapters[1]
  const unsuitable = chapter2.blocks.find((block) => block.heading.includes('当前不适合的客户'))
  assert.ok(unsuitable)
  assert.deepEqual(unsuitable.groups[0].tables[0].headers, ['客户类型', '不适合的原因'])
  assert.equal(unsuitable.groups[0].tables[0].rows.length, 3)

  const demand = chapter2.blocks.find((block) => block.heading.includes('客户需求如何形成购买理由'))
  assert.ok(demand)
  const table = demand.items[0].groups[0].tables[0]
  assert.equal(table.headers.length, 4)
  assert.equal(table.rows[0][0], '想知道自己具体哪里不对')
})

test('引用块保留原话，不拆成新标题', () => {
  const view = parseProductReport(DEMO_REPORT_MARKDOWN).view
  assert.ok(view)
  const trust = view.chapters[3]
  const quoteBlock = trust.blocks.find((block) => block.heading.includes('用户反馈与原话'))
  assert.ok(quoteBlock)
  assert.match(quoteBlock.items[0].groups[0].quotes[0], /第三句该停/)
})

test('模板外的章节进入「原文未识别」而不是被丢掉', () => {
  const markdown = `${DEMO_REPORT_MARKDOWN}\n\n## 七、附录\n\n补充内容一段。\n`
  const result = parseProductReport(markdown)
  assert.ok(result.view)
  assert.ok(result.view.unrecognized.length >= 1)
  assert.ok(result.ok, '未知章节只是告警，不算结构失败')
  assert.equal(structureIssues(result.issues).length, 0)
})

test('缺少章节会给出可定位的结构问题', () => {
  const markdown = DEMO_REPORT_MARKDOWN.split('## 四、信任素材')[0]
  const result = parseProductReport(markdown)
  assert.equal(result.ok, false)
  const codes = result.issues.map((issue) => issue.code)
  assert.ok(codes.includes('missing-chapter'))
  const missing = result.issues.find((issue) => issue.code === 'missing-chapter')
  assert.ok(missing?.path)
})

test('表格中途截断会标记 truncated，不把半张表当完整表', () => {
  const truncated = `${DEMO_REPORT_MARKDOWN}\n\n| 维度 | 本产品 | 竞品 A |\n|---|---|---|\n| 价格 | 2980 元 |`
  const result = parseProductReport(truncated)
  assert.ok(result.issues.some((issue) => issue.code === 'truncated'))
})

test('空内容说明是合法值，不触发缺失错误', () => {
  const markdown = DEMO_REPORT_MARKDOWN.replace('2980 元 / 期，支持分期', '未提供')
  const result = parseProductReport(markdown)
  assert.equal(result.ok, true)
  assert.equal(result.view?.meta[2].value, '未提供')
})

test('空报告返回空视图与错误，而不是抛异常', () => {
  const result = parseProductReport('')
  assert.equal(result.ok, false)
  assert.ok(result.view)
  assert.ok(result.issues.some((issue) => issue.code === 'empty-body'))
})
