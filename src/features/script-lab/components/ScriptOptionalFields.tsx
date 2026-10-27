import { useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { type ScriptConfig, type ScriptMode } from '../agent/types'
import {
  polishScriptOptionalField,
  type ScriptOptionalFieldId,
} from '../agent/form-assist'
import {
  SCRIPT_AUDIENCE_PRESETS,
  SCRIPT_INTRO_PRESETS,
  SCRIPT_PAIN_PRESETS,
  SCRIPT_SELLING_POINTS_PRESETS,
} from '../copy/optional-field-presets'
import { ScriptOptionalFieldRow, type ScriptFieldRevision } from './ScriptOptionalFieldRow'

export type ScriptOptionalFieldsProps = {
  mode: ScriptMode
  config: ScriptConfig
  onChange: (patch: Partial<ScriptConfig>) => void
}

function FieldBadge({ filled, emptyLabel }: { filled: boolean; emptyLabel: string }) {
  const { t } = useTranslation('scriptLab')
  return (
    <span className={`sl-wiz-badge${filled ? ' sl-wiz-badge--on' : ''}`}>
      {filled ? t('form.filled') : emptyLabel}
    </span>
  )
}

function toList(text: string): string[] {
  return text
    .split(/[\n,，、;；]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function ScriptOptionalFields({
  mode,
  config,
  onChange,
}: ScriptOptionalFieldsProps) {
  const { t } = useTranslation('scriptLab')
  const intenDesc = [t('form.softHint'), t('form.balanceHint'), t('form.strongHint')]
  const isVideo = mode === 'video'
  const strengthIdx = config.strength < 34 ? 0 : config.strength < 67 ? 1 : 2
  const abortRef = useRef<AbortController | null>(null)
  const [polishingField, setPolishingField] = useState<ScriptOptionalFieldId | null>(null)
  const [tuningField, setTuningField] = useState<ScriptOptionalFieldId | null>(null)
  const [streamingByField, setStreamingByField] = useState<Partial<Record<ScriptOptionalFieldId, string>>>({})
  const [revisions, setRevisions] = useState<Partial<Record<ScriptOptionalFieldId, ScriptFieldRevision>>>({})
  const [polishErrors, setPolishErrors] = useState<Partial<Record<ScriptOptionalFieldId, string>>>({})

  function fieldValue(field: ScriptOptionalFieldId): string {
    return (config[field] ?? '') as string
  }

  function setFieldValue(field: ScriptOptionalFieldId, value: string, clearRevision = true) {
    onChange({ [field]: value })
    if (clearRevision && revisions[field]) {
      setRevisions((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    if (polishErrors[field]) {
      setPolishErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  async function runPolish(field: ScriptOptionalFieldId, instruction?: string) {
    setPolishErrors((prev) => ({ ...prev, [field]: undefined }))
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPolishingField(field)
    if (instruction) setTuningField(field)
    setStreamingByField((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    try {
      const original = fieldValue(field)
      const next = await polishScriptOptionalField({
        field,
        value: original,
        config,
        instruction,
        signal: controller.signal,
        onPartial: (text) => setStreamingByField((prev) => ({ ...prev, [field]: text })),
      })
      setRevisions((prev) => ({ ...prev, [field]: { original, suggestion: next } }))
    } catch (e) {
      if (controller.signal.aborted) return
      setPolishErrors((prev) => ({
        ...prev,
        [field]: e instanceof Error ? e.message : t('form.polishFailed'),
      }))
    } finally {
      setPolishingField(null)
      setTuningField(null)
      setStreamingByField((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  function adoptRevision(field: ScriptOptionalFieldId) {
    const rev = revisions[field]
    if (!rev) return
    setFieldValue(field, rev.suggestion, false)
    setRevisions((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function dismissRevision(field: ScriptOptionalFieldId) {
    setRevisions((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const optionalBusy = polishingField !== null

  return (
    <div className="sl-wiz-optional sl-wiz-optional--compact">
      <div className="sl-wiz-blk">
        <div className="sl-wiz-blk__head">
          <h3>{t('form.content')}</h3>
          <span>{t('form.styleHint')}</span>
        </div>
        <div className="sl-wiz-fgrid">
          <ScriptOptionalFieldRow
            fieldId="intro"
            label={t('form.intro')}
            placeholder={t('form.introPlaceholder')}
            value={config.intro ?? ''}
            maxLength={160}
            filledBadge={<FieldBadge filled={Boolean(config.intro?.trim())} emptyLabel={t('form.aiEstimate')} />}
            presetOptions={SCRIPT_INTRO_PRESETS}
            disabled={optionalBusy}
            revision={revisions.intro ?? null}
            streamingSuggestion={streamingByField.intro}
            polishing={polishingField === 'intro'}
            tuning={tuningField === 'intro'}
            polishError={polishErrors.intro}
            onChange={(v) => setFieldValue('intro', v)}
            onPolish={() => void runPolish('intro')}
            onTune={(instruction) => void runPolish('intro', instruction)}
            onAdopt={() => adoptRevision('intro')}
            onDismissRevision={() => dismissRevision('intro')}
          />
          <ScriptOptionalFieldRow
            fieldId="audience"
            label={t('form.audience')}
            placeholder={t('form.audiencePlaceholder')}
            value={config.audience ?? ''}
            maxLength={60}
            filledBadge={<FieldBadge filled={Boolean(config.audience?.trim())} emptyLabel={t('form.aiEstimate')} />}
            presetOptions={SCRIPT_AUDIENCE_PRESETS}
            disabled={optionalBusy}
            revision={revisions.audience ?? null}
            streamingSuggestion={streamingByField.audience}
            polishing={polishingField === 'audience'}
            tuning={tuningField === 'audience'}
            polishError={polishErrors.audience}
            onChange={(v) => setFieldValue('audience', v)}
            onPolish={() => void runPolish('audience')}
            onTune={(instruction) => void runPolish('audience', instruction)}
            onAdopt={() => adoptRevision('audience')}
            onDismissRevision={() => dismissRevision('audience')}
          />
          <ScriptOptionalFieldRow
            fieldId="sellingPoints"
            label={t('form.sellingPoints')}
            placeholder={t('form.sellingPointsPlaceholder')}
            value={config.sellingPoints ?? ''}
            maxLength={300}
            multiline
            filledBadge={<FieldBadge filled={Boolean(config.sellingPoints?.trim())} emptyLabel={t('form.aiEstimate')} />}
            presetOptions={SCRIPT_SELLING_POINTS_PRESETS}
            disabled={optionalBusy}
            revision={revisions.sellingPoints ?? null}
            streamingSuggestion={streamingByField.sellingPoints}
            polishing={polishingField === 'sellingPoints'}
            tuning={tuningField === 'sellingPoints'}
            polishError={polishErrors.sellingPoints}
            onChange={(v) => setFieldValue('sellingPoints', v)}
            onPolish={() => void runPolish('sellingPoints')}
            onTune={(instruction) => void runPolish('sellingPoints', instruction)}
            onAdopt={() => adoptRevision('sellingPoints')}
            onDismissRevision={() => dismissRevision('sellingPoints')}
          />
          <ScriptOptionalFieldRow
            fieldId="pain"
            label={t('form.pain')}
            placeholder={t('form.painPlaceholder')}
            value={config.pain ?? ''}
            maxLength={300}
            multiline
            filledBadge={<FieldBadge filled={Boolean(config.pain?.trim())} emptyLabel={t('form.aiEstimate')} />}
            presetOptions={SCRIPT_PAIN_PRESETS}
            disabled={optionalBusy}
            revision={revisions.pain ?? null}
            streamingSuggestion={streamingByField.pain}
            polishing={polishingField === 'pain'}
            tuning={tuningField === 'pain'}
            polishError={polishErrors.pain}
            onChange={(v) => setFieldValue('pain', v)}
            onPolish={() => void runPolish('pain')}
            onTune={(instruction) => void runPolish('pain', instruction)}
            onAdopt={() => adoptRevision('pain')}
            onDismissRevision={() => dismissRevision('pain')}
          />
        </div>
      </div>

      <div className="sl-wiz-blk">
        <div className="sl-wiz-blk__head">
          <h3>{t('form.style')}</h3>
        </div>
        <div className="sl-wiz-inten sl-wiz-inten--compact">
          <div className="sl-wiz-inten__row">
            <span className="sl-wiz-inten__label">{t('form.conversionStrength')}</span>
            <span className="sl-wiz-inten__value">
              {t(strengthIdx === 0 ? 'form.soft' : strengthIdx === 1 ? 'form.balanced' : 'form.strong')} · {config.strength}
            </span>
          </div>
          <input
            className="sl-wiz-range"
            type="range"
            min={0}
            max={100}
            step={1}
            value={config.strength}
            style={{ '--sl-wiz-range-p': `${config.strength}%` } as CSSProperties}
            aria-label={t('form.conversionStrengthAria', { strength: t(strengthIdx === 0 ? 'form.soft' : strengthIdx === 1 ? 'form.balanced' : 'form.strong'), value: config.strength })}
            onChange={(e) => onChange({ strength: Number(e.target.value) })}
          />
          <p className="sl-wiz-inten__desc">{intenDesc[strengthIdx]}</p>
        </div>
        {!isVideo ? (
          <div className="sl-wiz-fgrid sl-wiz-fgrid--top sl-wiz-live-extra">
            <label className="sl-wiz-fld sl-wiz-fld--full">
              <span className="sl-wiz-fld__label">
                {t('form.offer')}
                <FieldBadge filled={Boolean(config.offer?.trim())} emptyLabel={t('form.notRequired')} />
              </span>
              <textarea
                className="sl-wiz-txt"
                maxLength={200}
                rows={2}
                value={config.offer ?? ''}
                placeholder={t('form.offerPlaceholder')}
                onChange={(e) => onChange({ offer: e.target.value })}
              />
            </label>
            <label className="sl-wiz-fld sl-wiz-fld--full">
              <span className="sl-wiz-fld__label">
                {t('form.interactionCount', { count: config.interactionNodes ?? 3 })}
              </span>
              <input
                className="sl-wiz-range"
                type="range"
                min={1}
                max={5}
                step={1}
                value={config.interactionNodes ?? 3}
                style={
                  {
                    '--sl-wiz-range-p': `${(((config.interactionNodes ?? 3) - 1) / 4) * 100}%`,
                  } as CSSProperties
                }
                aria-label={t('form.interactionCountAria')}
                onChange={(e) => onChange({ interactionNodes: Number(e.target.value) })}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="sl-wiz-blk sl-wiz-blk--tight">
        <div className="sl-wiz-blk__head">
          <h3>{t('form.words')}</h3>
        </div>
        <div className="sl-wiz-fgrid">
          <label className="sl-wiz-fld">
            <span className="sl-wiz-fld__label">
              {t('form.mustWords')}
              <FieldBadge filled={Boolean(config.mustWords?.length)} emptyLabel={t('form.notRequired')} />
            </span>
            <textarea
              className="sl-wiz-txt"
              maxLength={200}
              rows={2}
              value={(config.mustWords ?? []).join('、')}
              placeholder={t('form.mustWordsPlaceholder')}
              onChange={(e) => onChange({ mustWords: toList(e.target.value) })}
            />
          </label>
          <label className="sl-wiz-fld">
            <span className="sl-wiz-fld__label">
              {t('form.bannedWords')}
              <FieldBadge filled={Boolean(config.bannedWords?.length)} emptyLabel={t('form.notRequired')} />
            </span>
            <textarea
              className="sl-wiz-txt sl-wiz-txt--ban"
              maxLength={200}
              rows={2}
              value={(config.bannedWords ?? []).join('、')}
              placeholder={t('form.bannedWordsPlaceholder')}
              onChange={(e) => onChange({ bannedWords: toList(e.target.value) })}
            />
          </label>
        </div>
      </div>

      <details className="sl-wiz-ref">
        <summary className="sl-wiz-ref__summary">
          <span>{t('form.references')}</span>
          <ChevronDown className="sl-wiz-ref__chevron" aria-hidden="true" />
        </summary>
        <div className="sl-wiz-fgrid sl-wiz-fgrid--top sl-wiz-ref__body">
          <label className="sl-wiz-fld">
            <span className="sl-wiz-fld__label">
              {t('form.ownReference')}
              <FieldBadge filled={Boolean(config.refGood?.trim())} emptyLabel={t('form.notRequired')} />
            </span>
            <textarea
              className="sl-wiz-txt"
              maxLength={1200}
              rows={3}
              value={config.refGood ?? ''}
              placeholder={t('form.ownReferencePlaceholder')}
              onChange={(e) => onChange({ refGood: e.target.value })}
            />
          </label>
          <label className="sl-wiz-fld">
            <span className="sl-wiz-fld__label">
              {t('form.competitorReference')}
              <FieldBadge filled={Boolean(config.refCompetitor?.trim())} emptyLabel={t('form.notRequired')} />
            </span>
            <textarea
              className="sl-wiz-txt"
              maxLength={1200}
              rows={3}
              value={config.refCompetitor ?? ''}
              placeholder={t('form.competitorReferenceHint')}
              onChange={(e) => onChange({ refCompetitor: e.target.value })}
            />
          </label>
        </div>
      </details>
    </div>
  )
}

export default ScriptOptionalFields
