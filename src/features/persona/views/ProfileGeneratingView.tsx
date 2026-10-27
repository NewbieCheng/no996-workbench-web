import { useTranslation } from 'react-i18next'
import { Loader2Icon, XIcon } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Card, CardContent } from '@no996/ui/card'
import type { ProfileKind } from '../../../services/persona'
import {
  extractStreamingFenced,
  fillSkeleton,
  filledSkeletonCount,
  parseProfileMarkdown,
  skeletonFieldTotal,
} from '../lib/profile-fields'

type Props = {
  kind: ProfileKind
  streamedText: string
  fence: string
  headline: string
  onCancel?: () => void
}

const PLACEHOLDER_WIDTHS = ['w-44', 'w-56', 'w-40', 'w-52']

export function ProfileGeneratingView({ kind, streamedText, fence, headline, onCancel }: Props) {
  const { t } = useTranslation('persona')
  const partial = extractStreamingFenced(streamedText, fence)
  const views = fillSkeleton(kind, parseProfileMarkdown(partial))
  const filled = filledSkeletonCount(views)
  const total = skeletonFieldTotal(views)
  const percent = total === 0 ? 0 : Math.min(100, Math.round((filled / total) * 100))

  return (
    <div className="brain-profile-generating">
      <Card>
        <CardContent className="brain-profile-generating__status pt-6 pb-6">
          <div className="flex items-center gap-3">
            <Loader2Icon className="h-5 w-5 text-primary animate-spin shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground tracking-tight">{headline}</h3>
            </div>
            {onCancel ? (
              <Button variant="outline" size="sm" className="shrink-0 text-xs gap-2" onClick={onCancel}>
                <XIcon className="h-3.5 w-3.5" />
                {t('cancel')}
              </Button>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{t('generating.hint')}</p>
          </div>
        </CardContent>
      </Card>

      <article className="brain-profile-doc">
        <div className="brain-profile-doc__header">
          <span className="text-xs font-medium text-muted-foreground">{t('generating.skeleton')}</span>
          {total > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {filled}/{total}
            </span>
          ) : null}
        </div>
        {views.map((section, sectionIdx) => (
          <section
            key={section.title}
            className={`brain-profile-doc__section${sectionIdx === 0 ? ' brain-profile-doc__section--first' : ''}`}
          >
            <h3 className="brain-profile-doc__section-title">{section.title}</h3>
            <div className="brain-profile-doc__fields">
              {section.fields.map((field, idx) => (
                <div key={field.label} className="brain-profile-field">
                  <div className="brain-profile-field__label">{field.label}</div>
                  {field.value !== null ? (
                    <div className="brain-profile-field__value">{field.value}</div>
                  ) : (
                    <span
                      className={`inline-block h-4 rounded bg-muted animate-pulse ${PLACEHOLDER_WIDTHS[idx % PLACEHOLDER_WIDTHS.length]}`}
                    />
                  )}
                </div>
              ))}
              {section.extras.map((extra, idx) => (
                <div key={`${extra.label}-${idx}`} className="brain-profile-field">
                  <div className="brain-profile-field__label">{extra.label}</div>
                  <div className="brain-profile-field__value">{extra.value}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </article>
    </div>
  )
}
