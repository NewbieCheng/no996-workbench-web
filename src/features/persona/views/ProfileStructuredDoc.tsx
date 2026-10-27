import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { isParseUsable, parseProfileMarkdown } from '../lib/profile-fields'

type Props = {
  markdown: string
}

function ExpandableFieldValue({ value, waitingText }: { value: string; waitingText: string }) {
  const { t } = useTranslation('persona')
  const valueRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  useLayoutEffect(() => {
    const element = valueRef.current
    if (!element || expanded) return
    const measure = () => setHasMore(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [expanded, value])

  return (
    <div className="brain-profile-field__value-wrap">
      <div
        ref={valueRef}
        className={`brain-profile-field__value${expanded ? ' brain-profile-field__value--expanded' : ' brain-profile-field__value--clamped'}`}
      >
        {value || <span className="text-muted-foreground/60">{waitingText}</span>}
      </div>
      {hasMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="brain-profile-field__more"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? t('preview.showLess') : t('preview.showMore')}
        </Button>
      ) : null}
    </div>
  )
}

export function ProfileStructuredDoc({ markdown }: Props) {
  const { t } = useTranslation('persona')
  const parsed = useMemo(() => parseProfileMarkdown(markdown), [markdown])
  const structured = isParseUsable(parsed)

  if (structured && parsed) {
    return (
      <article className="brain-profile-doc">
        {parsed.sections.map((section, sectionIdx) => (
          <section
            key={section.title}
            className={`brain-profile-doc__section${sectionIdx === 0 ? ' brain-profile-doc__section--first' : ''}`}
          >
            <h3 className="brain-profile-doc__section-title">{section.title}</h3>
            <div className="brain-profile-doc__fields">
              {section.fields.map((field, idx) => (
                <div key={`${field.label}-${idx}`} className="brain-profile-field">
                  <span className="brain-profile-field__label">{field.label}</span>
                  <ExpandableFieldValue value={field.value} waitingText={t('preview.waiting')} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </article>
    )
  }

  return (
    <pre className="prompt-preview brain-profile-doc" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
      {markdown || t('emptyDocument')}
    </pre>
  )
}
