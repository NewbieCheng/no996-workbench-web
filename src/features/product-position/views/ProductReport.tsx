import { useMemo, useState } from 'react'
import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@no996/ui/tabs'
import { Button } from '@no996/ui/button'
import { runHardCheck } from '../../../agent/hard-check.ts'
import type { ProductRecord, ProductReportSnapshot, ReportChapter } from '../../../services/product-position/types'
import { collectMarketingSegments } from '../lib/report-view'
import { itemText } from '../lib/report-view'
import {
  BlockHeading,
  CopyButton,
  DataTableView,
  Expandable,
  GroupView,
  Paragraphs,
  ReportNumber,
} from './blocks/ReportBlocks'

/**
 * 报告页：公共信息条 + 五个页签 + 定位分析详情。
 *
 * 呈现完全来自已解析的视图模型；切换页签、展开、复制都不会触发模型调用。
 */

const TAB_SPECS = [
  { index: 1, key: 'positioning', label: '产品与定位' },
  { index: 2, key: 'customer', label: '客户与购买动机' },
  { index: 3, key: 'value', label: '价值与优势' },
  { index: 4, key: 'trust', label: '信任素材' },
  { index: 5, key: 'purchase', label: '购买与表达' },
] as const

function chapterNumber(index: number): string {
  return String(index).padStart(2, '0')
}

function itemSummary(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 96 ? `${flat.slice(0, 96)}…` : flat
}

function ChapterBody({ chapter }: { chapter: ReportChapter }) {
  return (
    <div className="pp-chapter">
      {chapter.blocks.map((block, blockIndex) => (
        <section className="pp-section" key={block.id}>
          <BlockHeading
            number={`${chapterNumber(chapter.index)}.${blockIndex + 1}`}
            title={block.heading || '未命名栏目'}
          />
          {block.groups.map((group, groupIndex) => (
            <GroupView key={`${block.id}-g${groupIndex}`} group={group} />
          ))}
          {block.items.map((item, itemIndex) => (
            <Expandable
              key={item.id}
              title={item.title || `条目 ${itemIndex + 1}`}
              tag={item.tag}
              defaultOpen={itemIndex === 0}
              summary={itemSummary(itemText(item))}
            >
              {item.groups.map((group, groupIndex) => (
                <GroupView key={`${item.id}-g${groupIndex}`} group={group} />
              ))}
              {itemText(item).trim() ? <CopyButton text={itemText(item)} label="复制这条" /> : null}
            </Expandable>
          ))}
        </section>
      ))}
    </div>
  )
}

export function ProductReport({
  product,
  report,
  isMock,
  regenerating = false,
  onRegenerate,
  onBackToInput,
}: {
  product: ProductRecord
  report: ProductReportSnapshot
  isMock: boolean
  regenerating?: boolean
  onRegenerate: () => void
  onBackToInput: () => void
}) {
  const [tab, setTab] = useState<string>('positioning')
  const view = report.view

  const check = useMemo(() => {
    const segments = collectMarketingSegments(view)
    if (segments.length === 0) return null
    // 产品资料里已经写明的数字（天数、次数、价格）不是「无来源数字」。
    const snapshot = report.inputSnapshot
    const source = [
      product.name,
      product.type,
      ...product.specs.map((spec) => `${spec.name} ${spec.price}`),
      ...Object.values(product.answers),
      ...(snapshot?.attachments ?? []).map((attachment) => attachment.text ?? ''),
      ...view.meta.map((field) => field.value),
    ].join('\n')
    return runHardCheck({
      text: segments.map((segment) => segment.text).join('\n'),
      segments,
      allowedNumberSources: source,
    })
  }, [product, report.inputSnapshot, view])

  if (!view) {
    return (
      <div className="pp-report pp-report--empty">
        <p>这份报告没有可解析的内容。</p>
        <div className="pp-report__empty-actions">
          <Button type="button" variant="outline" size="sm" onClick={onBackToInput}>
            回到资料
          </Button>
          <Button type="button" size="sm" onClick={onRegenerate}>
            重新分析
          </Button>
        </div>
      </div>
    )
  }

  const detailChapter = view.chapters.find((chapter) => chapter.index === 6)
  // 模板 H1 通常就是产品名，页头已显示一次；这里只在它真的不同时才展示模型起的标题。
  const heading =
    view.title && view.title.trim() && view.title.trim() !== product.name.trim()
      ? view.title
      : '定位与优势分析报告'

  return (
    <div className="pp-report">
      <header className="pp-report__header">
        <div className="pp-report__title-row">
          <div>
            <h2 className="pp-report__title">{heading}</h2>
            {isMock ? <span className="pp-badge pp-badge--demo">演示</span> : null}
          </div>
          <div className="pp-report__actions">
            <Button type="button" variant="outline" size="sm" onClick={onBackToInput}>
              修改资料
            </Button>
            <Button
              type="button"
              variant="toolbar"
              size="sm"
              onClick={onRegenerate}
              disabled={regenerating}
              aria-busy={regenerating}
            >
              <RefreshCw aria-hidden="true" className={regenerating ? 'pp-spin' : undefined} />
              {regenerating ? '分析中…' : '重新分析'}
            </Button>
          </div>
        </div>

        {view.summary ? <p className="pp-report__summary">{view.summary}</p> : null}

        {view.meta.length > 0 ? (
          <dl className="pp-meta">
            {view.meta.map((field) => (
              <div className="pp-meta__item" key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value || '未提供'}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <p className="pp-report__stamp">
          生成于 {new Date(report.createdAt).toLocaleString('zh-CN', { hour12: false })}
          <span aria-hidden="true"> · </span>
          模板 {report.templateVersion}
          <span aria-hidden="true"> · </span>
          本机保存，未上传服务端
        </p>
      </header>

      {check ? (
        <div className={`pp-check${check.pass ? '' : ' pp-check--warn'}`} role="status">
          <span className="pp-check__icon" aria-hidden="true">
            {check.pass ? <ShieldCheck /> : <ShieldAlert />}
          </span>
          <span className="pp-check__text">
            {check.pass
              ? '营销表达已过内置合规检查（违禁词、无来源数字、绝对化用语）。'
              : (() => {
                  const details = [...new Set(check.hits.map((hit) => hit.detail || hit.label))]
                  return `营销表达有 ${check.hits.length} 处需要人工确认：${details.slice(0, 3).join('；')}${details.length > 3 ? '…' : ''}`
                })()}
          </span>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="pp-tabs">
        <TabsList variant="toolbar" className="pp-tabs__list" aria-label="报告页签">
          {TAB_SPECS.map((spec) => (
            <TabsTrigger key={spec.key} value={spec.key} className="pp-tabs__trigger">
              <ReportNumber value={chapterNumber(spec.index)} />
              <span>{spec.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_SPECS.map((spec) => {
          const chapter = view.chapters.find((item) => item.index === spec.index)
          return (
            <TabsContent key={spec.key} value={spec.key} className="pp-tabs__panel">
              {chapter ? <ChapterBody chapter={chapter} /> : <p className="pp-empty-note">这一章没有可识别的内容。</p>}
            </TabsContent>
          )
        })}
      </Tabs>

      {detailChapter ? (
        <section className="pp-detail">
          <BlockHeading number="06" title="定位分析详情" hint="竞争比较 / 其他方向 / 薄弱环节 / 验证计划" />
          <ChapterBody chapter={detailChapter} />
        </section>
      ) : null}

      {view.unrecognized.length > 0 ? (
        <details className="pp-raw">
          <summary>原文未识别的内容（{view.unrecognized.length} 段）</summary>
          {view.unrecognized.map((block) => (
            <div className="pp-raw__block" key={block.id}>
              {block.heading ? <h4>{block.heading}</h4> : null}
              <Paragraphs items={block.groups.flatMap((group) => group.paragraphs)} />
              {block.groups.flatMap((group) =>
                group.tables.map((table, index) => <DataTableView key={`${block.id}-t${index}`} table={table} />),
              )}
            </div>
          ))}
        </details>
      ) : null}
    </div>
  )
}
