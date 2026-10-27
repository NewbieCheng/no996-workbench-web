import type { ReactNode } from 'react'

/**
 * 指标行：竖分割线而非卡片，用于结果区顶部展示留存、转化力、字数等。
 */
export type AgentMetric = {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'good' | 'warn'
}

export function AgentMetrics({ items, label }: { items: AgentMetric[]; label?: string }) {
  if (!items.length) return null
  return (
    <dl className="agent-metrics" aria-label={label}>
      {items.map((item) => (
        <div className="agent-metrics__item" key={item.label} data-tone={item.tone ?? 'default'}>
          <dt className="agent-metrics__label">{item.label}</dt>
          <dd className="agent-metrics__value">{item.value}</dd>
          {item.hint ? <p className="agent-metrics__hint">{item.hint}</p> : null}
        </div>
      ))}
    </dl>
  )
}

export default AgentMetrics
