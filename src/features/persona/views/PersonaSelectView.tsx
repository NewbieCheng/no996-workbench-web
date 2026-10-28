import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
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

function ContextDetails({
  advantages,
  audience,
  redlines,
}: {
  advantages: NamedFieldBlock
  audience: NamedFieldBlock
  redlines: NamedFieldBlock
}) {
  const { t } = useTranslation('persona')
  return (
    <details className="persona-select-context">
      <summary>{t('select.contextSummary')}</summary>
      <div className="persona-select-context__body">
        <section>
          <h3>{t('select.advantages')}</h3>
          <FieldList block={advantages} />
        </section>
        <section>
          <h3>{t('select.audience')}</h3>
          <FieldList block={audience} />
        </section>
        <section>
          <h3>{t('select.redlines')}</h3>
          <FieldList block={redlines} />
        </section>
      </div>
    </details>
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
  const pickedPositioning = positioning ? POSITIONING_LABELS[positioning] : null
  const pickedPackaging = packaging ? PACKAGING_LABELS[packaging] : null

  return (
    <section className="persona-select" aria-label={t('select.title')}>
      <header className="persona-select__head">
        <div className="persona-select__head-copy">
          <h2>{t('select.title')}</h2>
          <p>{t('select.lead')}</p>
        </div>
        {onBackToQuestionnaire ? (
          <Button type="button" variant="ghost" size="sm" onClick={onBackToQuestionnaire}>
            {t('select.editQuestionnaire')}
          </Button>
        ) : null}
      </header>

      <ContextDetails
        advantages={parsed.advantages}
        audience={parsed.audience}
        redlines={parsed.redlines}
      />

      <fieldset className="persona-select-group">
        <legend>
          <span className="persona-select-group__step">1</span>
          {t('select.pickPositioning')}
        </legend>
        <div className="persona-select-list" role="radiogroup" aria-label={t('select.pickPositioning')}>
          {POSITIONING_IDS.map((id) => {
            const selected = positioning === id
            return (
              <label key={id} className={`persona-select-option${selected ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="positioning"
                  checked={selected}
                  onChange={() => setPositioning(id)}
                />
                <span className="persona-select-option__mark" aria-hidden="true" />
                <span className="persona-select-option__body">
                  <span className="persona-select-option__title">
                    {t('select.plan', { id })} · {POSITIONING_LABELS[id]}
                  </span>
                  <span className="persona-select-option__lead">
                    {fieldValue(parsed.positioning[id], '一句话专业定位')}
                  </span>
                  {selected ? (
                    <div className="persona-select-option__detail">
                      <FieldList block={parsed.positioning[id]} />
                    </div>
                  ) : null}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="persona-select-group">
        <legend>
          <span className="persona-select-group__step">2</span>
          {t('select.pickPackaging')}
        </legend>
        <div className="persona-select-list" role="radiogroup" aria-label={t('select.pickPackaging')}>
          {PACKAGING_IDS.map((id) => {
            const selected = packaging === id
            return (
              <label key={id} className={`persona-select-option${selected ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="packaging"
                  checked={selected}
                  onChange={() => setPackaging(id)}
                />
                <span className="persona-select-option__mark" aria-hidden="true" />
                <span className="persona-select-option__body">
                  <span className="persona-select-option__title">{PACKAGING_LABELS[id]}</span>
                  <span className="persona-select-option__lead">
                    {fieldValue(parsed.packaging[id], '账号简介')}
                  </span>
                  {selected ? (
                    <div className="persona-select-option__detail">
                      <FieldList block={parsed.packaging[id]} />
                    </div>
                  ) : null}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="persona-select__foot">
        <div className="persona-select__picks" aria-live="polite">
          {pickedPositioning || pickedPackaging ? (
            <>
              {pickedPositioning ? (
                <span className="persona-select__chip">
                  {t('select.chipPositioning', { label: pickedPositioning })}
                </span>
              ) : null}
              {pickedPackaging ? (
                <span className="persona-select__chip">
                  {t('select.chipPackaging', { label: pickedPackaging })}
                </span>
              ) : null}
            </>
          ) : (
            <span className="persona-select__picks-hint">{t('select.picksHint')}</span>
          )}
        </div>
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
