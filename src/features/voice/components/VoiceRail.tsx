import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Play, RefreshCw } from 'lucide-react'
import type { VoiceCloneRecord } from '../../../api/voice-clone'
import { cloneStatusShort } from '../voice-clone-labels'
import { VOICE_AVATAR_GRADIENTS, VOICE_WAVE_HEIGHTS } from '../voice-constants'
import i18n from '../../../i18n'
import { platformVoiceItems, type VoiceTFunction } from '../voice-i18n'

function buildRailVoices(clones: VoiceCloneRecord[], t: VoiceTFunction) {
  const platform = platformVoiceItems(t)
  const mine = clones.map((v) => ({
    id: v.voice_id,
    label: v.display_name,
    tag: v.ready_for_synthesis ? t('picker.tagMine') : cloneStatusShort(v),
    kind: 'clone' as const,
    selectable: v.ready_for_synthesis,
    status: cloneStatusShort(v),
  }))
  return [...mine, ...platform]
}

export function findVoiceLabel(clones: VoiceCloneRecord[], id: string): string {
  const tv = i18n.getFixedT(null, 'voice') as VoiceTFunction
  const all = [
    ...clones.map((c) => ({ id: c.voice_id, label: c.display_name })),
    ...platformVoiceItems(tv),
  ]
  return all.find((v) => v.id === id)?.label ?? id
}

export function isVoiceSelectable(clones: VoiceCloneRecord[], id: string): boolean {
  const tv = i18n.getFixedT(null, 'voice') as VoiceTFunction
  if (platformVoiceItems(tv).some((p) => p.id === id)) return true
  const found = clones.find((c) => c.voice_id === id)
  return found?.ready_for_synthesis ?? false
}

type Props = {
  clones: VoiceCloneRecord[]
  selectedId: string
  onSelect: (id: string) => void
  onAddClone: () => void
  onRefresh: () => void
  onPreview: () => void
  previewBusy?: boolean
  loading?: boolean
  pollingId?: string | null
}

export function VoiceRail({
  clones,
  selectedId,
  onSelect,
  onAddClone,
  onRefresh,
  onPreview,
  previewBusy,
  loading,
  pollingId,
}: Props) {
  const { t } = useTranslation('voice')
  const [collapsed, setCollapsed] = useState(false)
  const items = buildRailVoices(clones, t)
  const current = items.find((i) => i.id === selectedId)

  return (
    <section className="voice-section" aria-label={t('rail.sectionAria')}>
      <div className="voice-block-head">
        <button
          type="button"
          className="voice-rail-collapse"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          <b>{t('rail.title')}</b>
          <ChevronDown size={16} className={collapsed ? 'voice-rail-collapse__icon--up' : ''} />
        </button>
        <small>
          {current?.label ? t('rail.current', { name: current.label }) : t('rail.select')}
          {pollingId ? t('rail.polling') : ''}
        </small>
      </div>

      {!collapsed && (
        <div className="voice-rail-wrap">
          <div className="voice-rail" role="listbox" aria-label={t('rail.listAria')}>
            <button type="button" className="voice-card voice-card--add" onClick={onAddClone}>
              <div className="voice-ava" style={{ background: 'var(--accent)', color: 'var(--primary)' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 300 }}>＋</span>
              </div>
              <span className="voice-card__name" style={{ color: 'var(--primary)' }}>{t('rail.cloneCard')}</span>
              <span className="voice-card__tag">{t('rail.cloneEta')}</span>
            </button>
            {items.map((item, index) => {
              const grad = VOICE_AVATAR_GRADIENTS[index % VOICE_AVATAR_GRADIENTS.length]
              const bars = VOICE_WAVE_HEIGHTS[index % VOICE_WAVE_HEIGHTS.length]
              const pressed = item.id === selectedId
              return (
                <div
                  key={item.id}
                  className={`voice-card-shell${pressed ? ' voice-card-shell--selected' : ''}`}
                >
                  <div
                    role="option"
                    tabIndex={item.selectable ? 0 : -1}
                    aria-pressed={pressed}
                    aria-disabled={!item.selectable}
                    className="voice-card"
                    onClick={() => item.selectable && onSelect(item.id)}
                    onKeyDown={(e) => {
                      if (!item.selectable) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(item.id)
                      }
                    }}
                  >
                    <div
                      className="voice-ava"
                      style={{
                        background: `linear-gradient(145deg, ${grad[0]}, ${grad[1]})`,
                      }}
                    >
                      {bars.map((h, bi) => (
                        <i key={`${h}-${bi}`} style={{ ['--vh' as string]: `${h}px` }} />
                      ))}
                    </div>
                    <span className="voice-card__name">{item.label}</span>
                    <span className="voice-card__tag">{item.tag}</span>
                    {!item.selectable && item.kind === 'clone' && (
                      <span className="voice-card__badge">{item.status}</span>
                    )}
                    {pressed && item.selectable && (
                      <button
                        type="button"
                        className="voice-card__preview"
                        aria-label={t('picker.previewAria', { name: item.label })}
                        disabled={previewBusy}
                        onClick={(e) => {
                          e.stopPropagation()
                          onPreview()
                        }}
                      >
                        <Play size={11} fill="currentColor" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <button
            type="button"
            className="voice-btn-ghost"
            aria-label={t('rail.refreshAria')}
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      )}
    </section>
  )
}
