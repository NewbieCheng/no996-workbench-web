import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  LIVE_STRUCTURE_PRESETS,
  LIVE_STRUCTURE_QUICK_SEGMENTS,
  structureCustomText,
  libraryProvider,
} from '../agent/library'
import { structuresForPurpose } from '../agent/purposes'
import type { ScriptConfig, ScriptGoal, ScriptMode } from '../agent/types'
import { STRUCTURE_QUICK_SEGMENTS, isHookSegment } from '../copy/structure-segments'
import { ScriptOptionTile } from './ScriptOptionTile'

export type ScriptStructureEditorProps = {
  mode: ScriptMode
  config: ScriptConfig
  goal: ScriptGoal
  onChange: (patch: Partial<ScriptConfig>) => void
}

function activePresetId(config: ScriptConfig, mode: ScriptMode): string {
  if (config.structure.kind === 'custom') return 'custom'
  if (config.structure.kind === 'preset' && config.structure.presetId) {
    return config.structure.presetId
  }
  return mode === 'video' ? '' : 'live-five-chapter'
}

function segmentLabelsFromConfig(config: ScriptConfig): string[] {
  const text = structureCustomText(config)
  if (text && config.structure.kind !== 'auto') {
    return text
      .split(/[+＋]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  const hit = libraryProvider.search({
    mode: config.mode,
    goal: config.goal,
    durationSec: config.durationSec,
    presetId: config.structure.kind === 'preset' ? config.structure.presetId : undefined,
  })[0]
  return hit?.segments.map((s) => s.name) ?? []
}

export function ScriptStructureEditor({ mode, config, onChange }: ScriptStructureEditorProps) {
  const { t } = useTranslation('scriptLab')
  const isLive = mode === 'live'
  const presetId = activePresetId(config, mode)
  const purposeStructures = useMemo(() => structuresForPurpose(config.purpose), [config.purpose])
  const quickSegments = isLive ? LIVE_STRUCTURE_QUICK_SEGMENTS : STRUCTURE_QUICK_SEGMENTS
  const maxSegments = isLive ? 10 : 7
  const segments = useMemo(() => segmentLabelsFromConfig(config), [config])
  const liveOfferWarning = isLive && !config.offer?.trim() && segments.some((name) => /福利|优惠|赠品|秒杀|限量/.test(name))
  const [dragFrom, setDragFrom] = useState<number | null>(null)

  const commitSegments = useCallback(
    (next: string[]) => {
      if (next.length < 2) return
      onChange({
        structure: {
          kind: 'custom',
          text: next.join(' + '),
        },
      })
    },
    [onChange],
  )

  const selectPreset = (id: string) => {
    if (id === 'custom') {
      onChange({
        structure: {
          kind: 'custom',
          text: segments.join(' + ') || defaultCustomLabels.join(' + '),
        },
      })
      return
    }
    onChange({ structure: { kind: 'preset', presetId: id } })
  }

  const defaultCustomLabels = useMemo(
    () =>
      t(isLive ? 'structure.defaultCustomLive' : 'structure.defaultCustom')
        .split(/[+＋]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [isLive, t],
  )

  const renderStructureTile = (
    id: string,
    title: ReactNode,
    labels: string[],
    selected: boolean,
    onSelect: () => void,
    recommended?: boolean,
    className?: string,
    subtitle?: string,
  ) => (
    <ScriptOptionTile
      key={id}
      role="radio"
      className={className}
      selected={selected}
      onSelect={onSelect}
      title={
        <>
          {title}
          {recommended ? <em className="sl-wiz-tile__rec">{t('structure.recommended')}</em> : null}
        </>
      }
      subtitle={subtitle ?? labels.join(' → ')}
    >
      <div className="sl-wiz-mini" aria-hidden="true">
        {labels.map((name) => (
          <i key={name} className={isHookSegment(name) ? 'sl-wiz-mini__hk' : undefined} />
        ))}
      </div>
    </ScriptOptionTile>
  )

  return (
    <div className="sl-wiz-blk sl-wiz-blk--struct">
      <div className="sl-wiz-blk__head">
        <h3>{t(isLive ? 'structure.liveTitle' : 'structure.title')}</h3>
        <span>
          {isLive
            ? t('structure.liveSubtitle')
            : config.purpose
              ? t('structure.purposeSubtitle')
              : t('structure.purposeFirst')}
        </span>
      </div>

      {!isLive && !config.purpose ? (
        <p className="sl-wiz-live-warning" role="note">
          {t('structure.purposeFirst')}
        </p>
      ) : null}

      {config.structure.kind !== 'custom' && (isLive || config.purpose) ? (
        <div className="sl-wiz-tiles sl-wiz-tiles--2" role="radiogroup" aria-label={t('structure.templates')}>
          {isLive
            ? LIVE_STRUCTURE_PRESETS.map((p) =>
                renderStructureTile(
                  p.id,
                  t('structure.livePreset.' + p.id),
                  p.segmentLabels,
                  presetId === p.id,
                  () => selectPreset(p.id),
                  p.recommended,
                ),
              )
            : purposeStructures.map((p) =>
                renderStructureTile(
                  p.id,
                  p.name,
                  p.segments.map((segment) => segment.name),
                  presetId === p.id,
                  () => selectPreset(p.id),
                  undefined,
                  undefined,
                  p.summary,
                ),
              )}
          {renderStructureTile(
            'custom',
            <>
              <span className="sl-wiz-tile__hl">{t('structure.preset.customEmphasis')}</span>
              {t('structure.preset.customRest')}
            </>,
            defaultCustomLabels,
            false,
            () => selectPreset('custom'),
            undefined,
            'sl-wiz-tile--custom',
          )}
        </div>
      ) : null}

      {liveOfferWarning ? (
        <p className="sl-wiz-live-warning" role="note">
          {t('structure.liveOfferWarning')}
        </p>
      ) : null}

      {config.structure.kind === 'custom' ? (
        <>
          <div className="sl-wiz-chips" aria-label={t('structure.sequence')}>
            {segments.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className={`sl-wiz-chip${dragFrom === i ? ' sl-wiz-chip--drag' : ''}`}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragEnd={() => setDragFrom(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragFrom === null || dragFrom === i) return
                  const next = [...segments]
                  const [moved] = next.splice(dragFrom, 1)
                  next.splice(i, 0, moved)
                  setDragFrom(null)
                  commitSegments(next)
                }}
              >
                <span className="sl-wiz-chip__n">{i + 1}</span>
                {name}
                <button
                  type="button"
                  aria-label={t('structure.deleteSegment', { name })}
                  onClick={() => {
                    if (segments.length <= 2) return
                    commitSegments(segments.filter((_, j) => j !== i))
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              className="sl-wiz-chip-add"
              placeholder={t('structure.addSegment')}
              maxLength={12}
              aria-label={t('structure.addSegmentAria')}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                e.preventDefault()
                const v = (e.target as HTMLInputElement).value.trim()
                if (!v || segments.length >= maxSegments || segments.includes(v)) return
                ;(e.target as HTMLInputElement).value = ''
                commitSegments([...segments, v])
              }}
            />
          </div>
          <div className="sl-wiz-quick">
            <span>{t('structure.common')}</span>
            {quickSegments.filter((x) => !segments.includes(x)).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => {
                  if (segments.length >= maxSegments) return
                  commitSegments([...segments, x])
                }}
              >
                +{x}
              </button>
            ))}
            <span className="sl-wiz-quick__hint">{t('structure.reorderHint')}</span>
          </div>
          <button
            type="button"
            className="sl-link sl-wiz-custom-link"
            onClick={() => {
              const fallbackId = isLive ? 'live-five-chapter' : purposeStructures[0]?.id
              if (fallbackId) selectPreset(fallbackId)
            }}
          >
            {t('structure.backToTemplates')}
          </button>
        </>
      ) : null}
    </div>
  )
}

export default ScriptStructureEditor
