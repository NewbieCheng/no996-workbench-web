import { useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileKind } from '../../../services/persona'
import {
  fillSkeleton,
  filledSkeletonCount,
  parseProfileMarkdown,
  skeletonFieldTotal,
} from '../lib/profile-fields'

const PLACEHOLDER_WIDTHS = ['w-44', 'w-56', 'w-40', 'w-52']

type Props = {
  kind: ProfileKind
  partialMarkdown: string
  generating: boolean
  showProgress?: boolean
}

type FlatField = {
  key: string
  label: string
  value: string | null
  isExtra: boolean
}

function flattenSkeletonViews(
  views: ReturnType<typeof fillSkeleton>,
): FlatField[] {
  const flat: FlatField[] = []
  for (const section of views) {
    for (const field of section.fields) {
      flat.push({
        key: `${section.title}::${field.label}`,
        label: field.label,
        value: field.value,
        isExtra: false,
      })
    }
    for (const extra of section.extras) {
      flat.push({
        key: `${section.title}::extra::${extra.label}`,
        label: extra.label,
        value: extra.value,
        isExtra: true,
      })
    }
  }
  return flat
}

function resolveStreamingFieldKey(flat: FlatField[]): string | null {
  if (flat.length === 0) return null
  let lastFilled: string | null = null
  for (const field of flat) {
    if (field.value !== null && field.value.trim()) lastFilled = field.key
  }
  if (lastFilled) return lastFilled
  return flat.find((f) => f.value === null)?.key ?? null
}

export function ProfileStreamingPanel({ kind, partialMarkdown, generating, showProgress = true }: Props) {
  const { t } = useTranslation('persona')
  const prevValuesRef = useRef<Record<string, string | null>>({})
  const views = useMemo(() => {
    const parsed = parseProfileMarkdown(partialMarkdown)
    return fillSkeleton(kind, parsed)
  }, [kind, partialMarkdown])

  const flat = useMemo(() => flattenSkeletonViews(views), [views])
  const streamingKey = generating ? resolveStreamingFieldKey(flat) : null

  const streamInKeys = useMemo(() => {
    const next = new Set<string>()
    for (const field of flat) {
      const prev = prevValuesRef.current[field.key]
      if (field.value !== null && field.value.trim() && (prev === null || prev === undefined)) {
        next.add(field.key)
      }
    }
    return next
  }, [flat])

  useLayoutEffect(() => {
    const next: Record<string, string | null> = {}
    for (const field of flat) next[field.key] = field.value
    prevValuesRef.current = next
  }, [flat])

  const filled = filledSkeletonCount(views)
  const total = skeletonFieldTotal(views)
  const percent = total === 0 ? 0 : Math.min(100, Math.round((filled / total) * 100))

  return (
    <div className="profile-streaming-panel">
      {showProgress && generating ? (
        <div className="profile-streaming-panel__progress" role="status">
          <div className="profile-streaming-panel__progress-bar" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
          {total > 0 ? (
            <span className="profile-streaming-panel__progress-label tabular-nums">
              {filled}/{total}
            </span>
          ) : null}
        </div>
      ) : null}

      <article className="brain-profile-doc brain-profile-doc--streaming">
        {views.map((section, sectionIdx) => (
          <section
            key={section.title}
            className={`brain-profile-doc__section${sectionIdx === 0 ? ' brain-profile-doc__section--first' : ''}`}
          >
            <h3 className="brain-profile-doc__section-title">{section.title}</h3>
            <div className="brain-profile-doc__fields">
              {section.fields.map((field, idx) => {
                const key = `${section.title}::${field.label}`
                const streamIn = streamInKeys.has(key)
                const isStreaming = streamingKey === key
                return (
                  <div
                    key={key}
                    className={[
                      'brain-profile-field',
                      streamIn ? 'brain-profile-field--stream-in' : '',
                      isStreaming ? 'brain-profile-field--streaming' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="brain-profile-field__label">{field.label}</div>
                    {field.value !== null ? (
                      <div className="brain-profile-field__value">
                        {field.value}
                        {isStreaming ? <span className="brain-profile-field__cursor" aria-hidden="true" /> : null}
                      </div>
                    ) : (
                      <span
                        className={`inline-block h-4 rounded bg-muted animate-pulse ${PLACEHOLDER_WIDTHS[idx % PLACEHOLDER_WIDTHS.length]}`}
                      />
                    )}
                  </div>
                )
              })}
              {section.extras.map((extra, idx) => {
                const key = `${section.title}::extra::${extra.label}`
                const streamIn = streamInKeys.has(key)
                const isStreaming = streamingKey === key
                return (
                  <div
                    key={`${extra.label}-${idx}`}
                    className={[
                      'brain-profile-field',
                      streamIn ? 'brain-profile-field--stream-in' : '',
                      isStreaming ? 'brain-profile-field--streaming' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="brain-profile-field__label">{extra.label}</div>
                    <div className="brain-profile-field__value">
                      {extra.value}
                      {isStreaming ? <span className="brain-profile-field__cursor" aria-hidden="true" /> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
        {generating && flat.every((f) => f.value === null) ? (
          <p className="profile-streaming-panel__hint">{t('generating.hint')}</p>
        ) : null}
      </article>
    </div>
  )
}
