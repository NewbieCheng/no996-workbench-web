import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, Play, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@no996/ui/dialog'
import { VOICE_DISPLAY_NAME_MAX, type VoiceCloneMeta, type VoiceCloneRecord } from '../../../api/voice-clone'
import { VOICE_AVATAR_GRADIENTS, VOICE_WAVE_HEIGHTS } from '../voice-constants'
import { cloneStatusDetail, cloneStatusShort } from '../voice-clone-labels'

type Props = {
  voices: VoiceCloneRecord[]
  meta: VoiceCloneMeta | null
  loading?: boolean
  deleteBusy?: boolean
  renameBusy?: boolean
  previewBusyId?: string | null
  embedded?: boolean
  onBack?: () => void
  onRefresh: () => void
  onPreview: (voiceId: string) => void
  onRename: (voiceId: string, displayName: string) => Promise<void>
  onDelete: (voiceId: string) => Promise<void>
  onStartClone: () => void
}

function formatCreatedAt(iso?: string, locale = 'zh-CN'): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(locale, {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return '—'
  }
}

export function VoiceManagePanel({
  voices,
  meta,
  loading,
  deleteBusy,
  renameBusy,
  previewBusyId,
  embedded = false,
  onBack,
  onRefresh,
  onPreview,
  onRename,
  onDelete,
  onStartClone,
}: Props) {
  const { t, i18n } = useTranslation('voice')
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'zh-CN'
  const [pendingDelete, setPendingDelete] = useState<VoiceCloneRecord | null>(null)
  const [pendingRename, setPendingRename] = useState<VoiceCloneRecord | null>(null)
  const [renameInput, setRenameInput] = useState('')

  const quota =
    meta?.max_voices_per_user != null
      ? `${voices.length} / ${meta.max_voices_per_user}`
      : t('manage.quotaCount', { count: voices.length })

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const id = pendingDelete.voice_id
    try {
      await onDelete(id)
      setPendingDelete(null)
    } catch {
      // error surfaced on page; keep dialog open for retry or cancel
    }
  }

  const openRename = (voice: VoiceCloneRecord) => {
    setPendingRename(voice)
    setRenameInput(voice.display_name)
  }

  const confirmRename = async () => {
    if (!pendingRename) return
    const name = renameInput.trim()
    if (!name) return
    try {
      await onRename(pendingRename.voice_id, name)
      setPendingRename(null)
    } catch {
      // error surfaced on page
    }
  }

  return (
    <section
      className={`voice-manage${embedded ? ' voice-manage--embedded' : ''}`}
      aria-labelledby="voice-manage-title"
    >
      {!embedded && onBack ? (
        <div className="voice-manage__top">
          <button type="button" className="voice-manage__back" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden />
            {t('manage.back')}
          </button>
        </div>
      ) : null}

      <header className="voice-manage__head">
        <div className="voice-manage__head-main">
          <h2 id="voice-manage-title" className="voice-manage__title">{t('manage.title')}</h2>
          <p className="voice-manage__sub">{t('manage.sub')}</p>
        </div>
        <div className="voice-manage__head-aside">
          <p className="voice-manage__quota" aria-label={t('manage.quotaAria')}>
            {t('manage.quotaUsed')} <strong>{quota}</strong>
          </p>
          <button
            type="button"
            className="voice-btn-ghost voice-manage__refresh"
            aria-label={t('manage.refreshAria')}
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('manage.refresh')}
          </button>
        </div>
      </header>

      {voices.length === 0 ? (
        <div className="voice-manage__empty">
          <p>{t('manage.empty')}</p>
          <Button type="button" onClick={onStartClone}>{t('manage.startClone')}</Button>
        </div>
      ) : (
        <ul className="voice-manage__list">
          {voices.map((voice, index) => {
            const grad = VOICE_AVATAR_GRADIENTS[index % VOICE_AVATAR_GRADIENTS.length]
            const bars = VOICE_WAVE_HEIGHTS[index % VOICE_WAVE_HEIGHTS.length]
            const status = cloneStatusShort(voice)
            const previewing = previewBusyId === voice.voice_id
            return (
              <li key={voice.voice_id} className="voice-manage__row">
                <div
                  className="voice-ava voice-manage__ava"
                  style={{
                    background: `linear-gradient(145deg, ${grad[0]}, ${grad[1]})`,
                  }}
                  aria-hidden
                >
                  {bars.map((h, bi) => (
                    <i key={`${h}-${bi}`} style={{ ['--vh' as string]: `${Math.max(6, h - 4)}px` }} />
                  ))}
                </div>
                <div className="voice-manage__meta">
                  <p className="voice-manage__name">{voice.display_name}</p>
                  <p className="voice-manage__detail">{cloneStatusDetail(voice)}</p>
                  <p className="voice-manage__time">
                    {t('manage.createdAt', { time: formatCreatedAt(voice.created_at, locale) })}
                  </p>
                </div>
                <span
                  className={`voice-manage__status${voice.ready_for_synthesis ? ' voice-manage__status--ok' : ''}`}
                >
                  {status}
                </span>
                <div className="voice-manage__actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!voice.ready_for_synthesis || previewing}
                    onClick={() => onPreview(voice.voice_id)}
                  >
                    <Play size={14} fill="currentColor" aria-hidden />
                    {previewing ? t('manage.previewing') : t('manage.preview')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={renameBusy}
                    onClick={() => openRename(voice)}
                  >
                    <Pencil size={14} aria-hidden />
                    {t('manage.rename')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setPendingDelete(voice)}
                  >
                    <Trash2 size={14} aria-hidden />
                    {t('manage.delete')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog
        open={pendingRename != null}
        onOpenChange={(open) => {
          if (!open) setPendingRename(null)
        }}
      >
        <DialogContent className="voice-manage-dialog" showCloseButton>
          <DialogTitle>{t('manage.renameTitle')}</DialogTitle>
          <DialogDescription className="voice-manage-dialog__body">
            {t('manage.renameBody')}
          </DialogDescription>
          <Input
            value={renameInput}
            maxLength={VOICE_DISPLAY_NAME_MAX}
            placeholder={t('manage.renamePlaceholder')}
            autoFocus
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || renameBusy) return
              void confirmRename()
            }}
          />
          <div className="voice-manage-dialog__foot">
            <Button
              type="button"
              variant="outline"
              disabled={renameBusy}
              onClick={() => setPendingRename(null)}
            >
              {t('manage.cancel')}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={renameBusy || !renameInput.trim()}
              onClick={() => void confirmRename()}
            >
              {renameBusy ? t('manage.renaming') : t('manage.confirmRename')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete != null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="voice-manage-dialog" showCloseButton>
          <DialogTitle>{t('manage.deleteTitle')}</DialogTitle>
          <DialogDescription className="voice-manage-dialog__body">
            {t('manage.deleteBody', { name: pendingDelete?.display_name ?? '' })}
          </DialogDescription>
          <div className="voice-manage-dialog__foot">
            <Button type="button" variant="outline" disabled={deleteBusy} onClick={() => setPendingDelete(null)}>
              {t('manage.cancel')}
            </Button>
            <Button type="button" variant="destructive" disabled={deleteBusy} onClick={() => void confirmDelete()}>
              {deleteBusy ? t('manage.deleting') : t('manage.confirmDelete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
