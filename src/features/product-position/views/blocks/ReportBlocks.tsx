import { useId, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { copyText } from '../../../../services/browser'
import { toastError, toastSuccess } from '../../../../lib/toast'
import type { ReportField, ReportGroup, ReportTable } from '../../../../services/product-position/types'

/**
 * 报告渲染的原子件。
 *
 * 密度按「管理页」标准：行高 24–28，卡片内边距 12/16，标题与正文只差一到两级。
 * 这些件只负责呈现，不做数据解释，也不发起模型调用。
 */

export function ReportNumber({ value }: { value: string }) {
  return (
    <span className="pp-num" aria-hidden="true">
      {value}
    </span>
  )
}

/** 模板标题本身带序号（`### 1. 建议优先采用的产品定位`），避免与外层编号重复。 */
function stripLeadingNumber(title: string): string {
  return title.replace(/^\d+\s*[.．、)]\s+/, '')
}

export function BlockHeading({
  number,
  title,
  hint,
  actions,
}: {
  number?: string
  title: string
  hint?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="pp-block-head">
      <div className="pp-block-head__title">
        {number ? <ReportNumber value={number} /> : null}
        <h3>{stripLeadingNumber(title)}</h3>
        {hint ? <span className="pp-block-head__hint">{hint}</span> : null}
      </div>
      {actions ? <div className="pp-block-head__actions">{actions}</div> : null}
    </div>
  )
}

export function Paragraphs({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="pp-paragraphs">
      {items.map((text, index) => (
        <p key={`${index}-${text.slice(0, 12)}`}>{text}</p>
      ))}
    </div>
  )
}

export function FieldList({ fields }: { fields: ReportField[] }) {
  if (fields.length === 0) return null
  return (
    <dl className="pp-fields">
      {fields.map((field) => (
        <div className="pp-fields__row" key={field.label}>
          <dt>{field.label}</dt>
          <dd>{field.value || <span className="pp-muted">未提供</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

export function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="pp-bullets">
      {items.map((text, index) => (
        <li key={`${index}-${text.slice(0, 12)}`}>{text}</li>
      ))}
    </ul>
  )
}

export function QuoteBlock({ quotes }: { quotes: string[] }) {
  if (quotes.length === 0) return null
  return (
    <div className="pp-quotes">
      {quotes.map((text, index) => (
        <blockquote key={`${index}-${text.slice(0, 12)}`}>{text}</blockquote>
      ))}
    </div>
  )
}

export function DataTableView({ table }: { table: ReportTable }) {
  if (table.headers.length === 0) return null
  return (
    <div className="pp-table-scroll">
      <table className="pp-table">
        <thead>
          <tr>
            {table.headers.map((header, index) => (
              <th key={`${header}-${index}`} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {table.headers.map((_, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`}>{row[cellIndex] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const disabled = !text.trim()

  async function handleCopy() {
    if (disabled) return
    try {
      await copyText(text)
      setCopied(true)
      toastSuccess(`已复制${label === '复制' ? '' : label}`)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toastError('复制失败', '请手动选择文本复制')
    }
  }

  return (
    <button
      type="button"
      className="pp-copy"
      onClick={() => void handleCopy()}
      disabled={disabled}
      aria-label={copied ? '已复制' : label}
      title={label}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{copied ? '已复制' : label}</span>
    </button>
  )
}

export function Expandable({
  title,
  tag,
  summary,
  defaultOpen = false,
  children,
  className,
}: {
  title: string
  tag?: string
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <article className={`pp-item${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="pp-item__head"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="pp-item__title">
          {title}
          {tag ? <em className="pp-tag">{tag}</em> : null}
        </span>
        <span className="pp-item__toggle">
          {open ? '收起' : '展开'}
          <ChevronDown aria-hidden="true" />
        </span>
      </button>
      {!open && summary ? <div className="pp-item__summary">{summary}</div> : null}
      {open ? (
        <div className="pp-item__body" id={panelId}>
          {children}
        </div>
      ) : null}
    </article>
  )
}

export function GroupView({ group }: { group: ReportGroup }) {
  return (
    <div className="pp-group">
      {group.title ? <h4 className="pp-group__title">{group.title}</h4> : null}
      <Paragraphs items={group.paragraphs} />
      <FieldList fields={group.fields} />
      <BulletList items={group.bullets} />
      <QuoteBlock quotes={group.quotes} />
      {group.tables.map((table, index) => (
        <DataTableView key={`table-${index}`} table={table} />
      ))}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="pp-empty-note">{children}</p>
}
