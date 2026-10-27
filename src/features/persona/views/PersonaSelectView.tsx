import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@no996/ui/card'
import {
  PACKAGING_IDS,
  PACKAGING_LABELS,
  POSITIONING_IDS,
  POSITIONING_LABELS,
  fieldValue,
  parseAccountCard,
  type NamedFieldBlock,
} from '../lib/account-card'
import type { PackagingId, PositioningId } from '../../../services/persona/types'
import { ProfileStreamingPanel } from './ProfileStreamingPanel'

type Props = {
  markdown: string
  generating?: boolean
  livePartialMarkdown?: string
  initialPositioning?: PositioningId
  initialPackaging?: PackagingId
  onSave: (positioning: PositioningId, packaging: PackagingId) => void
  onBackToQuestionnaire?: () => void
}

function FieldList({ block }: { block: NamedFieldBlock }) {
  return (
    <dl className="persona-select-fields">
      {block.fields.map((field) => (
        <div key={field.label}>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function PersonaSelectView({
  markdown,
  generating = false,
  livePartialMarkdown = '',
  initialPositioning,
  initialPackaging,
  onSave,
  onBackToQuestionnaire,
}: Props) {
  const { t } = useTranslation('persona')
  const [positioning, setPositioning] = useState<PositioningId | ''>(initialPositioning ?? '')
  const [packaging, setPackaging] = useState<PackagingId | ''>(initialPackaging ?? '')
  const parsed = useMemo(() => parseAccountCard(markdown), [markdown])

  if (generating || !parsed) {
    return (
      <ProfileStreamingPanel
        kind="user"
        partialMarkdown={livePartialMarkdown || markdown}
        generating={generating}
      />
    )
  }

  const canSave = Boolean(positioning && packaging)

  return (
    <section className="persona-select" aria-label={t('select.title')}>
      <header className="persona-select__head">
        <div>
          <h2>{t('select.title')}</h2>
          <p>{t('select.lead')}</p>
        </div>
        {onBackToQuestionnaire ? (
          <Button type="button" variant="outline" onClick={onBackToQuestionnaire}>
            {t('select.editQuestionnaire')}
          </Button>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('select.advantages')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList block={parsed.advantages} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('select.audience')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList block={parsed.audience} />
        </CardContent>
      </Card>

      <fieldset className="persona-select-group">
        <legend>{t('select.pickPositioning')}</legend>
        <div className="persona-select-grid">
          {POSITIONING_IDS.map((id) => (
            <label key={id} className={positioning === id ? 'is-selected' : ''}>
              <input
                type="radio"
                name="positioning"
                checked={positioning === id}
                onChange={() => setPositioning(id)}
              />
              <strong>
                {t('select.plan', { id })}：{POSITIONING_LABELS[id]}
              </strong>
              <p>{fieldValue(parsed.positioning[id], '一句话专业定位')}</p>
              <FieldList block={parsed.positioning[id]} />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="persona-select-group">
        <legend>{t('select.pickPackaging')}</legend>
        <div className="persona-select-grid">
          {PACKAGING_IDS.map((id) => (
            <label key={id} className={packaging === id ? 'is-selected' : ''}>
              <input
                type="radio"
                name="packaging"
                checked={packaging === id}
                onChange={() => setPackaging(id)}
              />
              <strong>{PACKAGING_LABELS[id]}</strong>
              <p>{fieldValue(parsed.packaging[id], '账号简介')}</p>
              <FieldList block={parsed.packaging[id]} />
            </label>
          ))}
        </div>
      </fieldset>

      <Card>
        <CardHeader>
          <CardTitle>{t('select.redlines')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldList block={parsed.redlines} />
        </CardContent>
      </Card>

      <div className="persona-select__foot">
        <Button
          type="button"
          variant="generate"
          size="action"
          disabled={!canSave}
          onClick={() => {
            if (!positioning || !packaging) return
            onSave(positioning, packaging)
          }}
        >
          {t('select.saveMain')}
        </Button>
      </div>
    </section>
  )
}
