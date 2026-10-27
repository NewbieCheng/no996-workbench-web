import { Loader2, Mic, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '@no996/ui/card'
import type { VoiceCloneRecord } from '../../../api/voice-clone'
import { platformVoiceItems } from '../voice-i18n'

type Props = {
  clones: VoiceCloneRecord[]
  selectedVoiceId: string
  onSelectVoice: (id: string) => void
  onPreviewVoice?: (id: string) => void
  previewBusy?: boolean
  previewVoiceId?: string | null
  onManageVoices?: () => void
  onCloneVoice?: () => void
  /** 嵌在右侧坞内，不再单独成卡 */
  embedded?: boolean
  title?: string
  /** 弹窗等已有外层标题时，隐藏「全局音色 + 克隆」行 */
  hideHeader?: boolean
}

export function VoicePickerColumn({
  clones,
  selectedVoiceId,
  onSelectVoice,
  onPreviewVoice,
  previewBusy = false,
  previewVoiceId = null,
  onManageVoices,
  onCloneVoice,
  embedded = false,
  title,
  hideHeader = false,
}: Props) {
  const { t } = useTranslation('voice')
  const resolvedTitle = title ?? t('picker.titleDefault')
  const cloneItems = clones
    .filter((c) => c.ready_for_synthesis)
    .map((c) => ({
      id: c.voice_id,
      label: c.display_name,
      tag: t('picker.tagMine'),
    }))
  const platform = platformVoiceItems(t)
  const allVoices = [...cloneItems, ...platform]

  const content = (
    <>
      {!hideHeader ? (
        <div className="voice-side-title-row">
          <h3>{resolvedTitle}</h3>
          {embedded && onCloneVoice ? (
            <button
              type="button"
              className="voice-clone-entry-btn"
              onClick={onCloneVoice}
              title={t('picker.cloneTitle')}
            >
              <span className="voice-clone-entry-btn__hot" aria-hidden>HOT</span>
              <Mic size={13} aria-hidden />
              <span>{t('picker.clone')}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="voice-list-picker voice-list-picker--column" role="radiogroup" aria-label={t('picker.listAria')}>
        {allVoices.map((v) => {
          const isSelected = v.id === selectedVoiceId
          return (
            <div
              key={v.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={`voice-picker-item ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectVoice(v.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectVoice(v.id)
                }
              }}
            >
              <span className="voice-mw" aria-hidden>
                {[40, 80, 55, 100, 60, 35, 70].map((h, k) => (
                  <i
                    key={k}
                    style={
                      {
                        '--h': `${h}%`,
                        animationPlayState: isSelected ? 'running' : 'paused',
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
              <span className="voice-picker-info">
                <b>{v.label}</b>
                <small>{v.tag}</small>
              </span>
              {onPreviewVoice ? (
                <button
                  type="button"
                  className="voice-mini-play"
                  aria-label={t('picker.previewAria', { name: v.label })}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPreviewVoice(v.id)
                  }}
                >
                  {previewBusy && previewVoiceId === v.id ? (
                    <Loader2 size={11} className="voice-spin" />
                  ) : (
                    <Play size={11} />
                  )}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      {!embedded && (onCloneVoice || onManageVoices) && (
        <div className="voice-picker-foot">
          {onCloneVoice ? (
            <button type="button" className="voice-picker-foot-btn" onClick={onCloneVoice}>
              {t('picker.cloneTitle')}
            </button>
          ) : null}
          {onManageVoices ? (
            <button type="button" className="voice-picker-foot-btn voice-picker-foot-btn--muted" onClick={onManageVoices}>
              {t('picker.manageMine')}
            </button>
          ) : null}
        </div>
      )}
    </>
  )

  if (embedded) {
    return <div className="voice-picker-embedded">{content}</div>
  }

  return (
    <Card className="voice-panel-card voice-picker-column" aria-label={t('picker.columnAria')}>
      {content}
    </Card>
  )
}
