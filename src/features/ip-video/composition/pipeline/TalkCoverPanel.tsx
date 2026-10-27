import { useMemo, useRef } from 'react'
import { Download, ImagePlus, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { TemplateCanvas } from '../../components/TemplateCanvas'
import { createTalkCoverProject, TALK_COVER_SIZE } from '../../lib/cover'
import { talkLookById } from '../talk-looks'
import { useTalkV2Copy } from '../v2-copy'

export function TalkCoverPanel({
  lookId,
  title,
  cropMode,
  photo,
  coverUrl,
  busy,
  generating,
  onTitle,
  onTitleCommit,
  onCrop,
  onPhoto,
  onGenerate,
  onDownload,
}: {
  lookId?: string
  title: string
  cropMode: 'cover' | 'contain'
  photo?: File | Blob
  coverUrl?: string
  busy: boolean
  generating: boolean
  onTitle: (value: string) => void
  onTitleCommit: () => void
  onCrop: (mode: 'cover' | 'contain') => void
  onPhoto: (file: File) => void
  onGenerate: () => void
  onDownload: () => void
}) {
  const { t } = useTalkV2Copy()
  const fileRef = useRef<HTMLInputElement>(null)
  const project = useMemo(() => createTalkCoverProject({ lookId: lookId ?? talkLookById(lookId)?.id ?? 'scroll', title }), [lookId, title])
  const generated = !!coverUrl
  return <section className="ipt-cover-panel" aria-labelledby="ipt-cover-title">
    <div className="ipt-section-heading"><h3 id="ipt-cover-title">{t('coverPanelTitle')}</h3><span className="ipt-help">{t('coverPanelSize', { size: TALK_COVER_SIZE })}</span></div>
    <div className="ipt-cover-preview">
      <TemplateCanvas project={project} cover={photo} time={0} />
      {generated && <span className="ipt-cover-preview__badge">{t('coverGeneratedBadge')}</span>}
    </div>
    <div className="ipt-cover-fields">
      <label className="ipt-field">{t('coverTitle')}
        <Input value={title} maxLength={36} disabled={busy} onChange={event => onTitle(event.target.value)} onBlur={onTitleCommit} />
      </label>
      <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) onPhoto(file)
      }} />
      <div className="ipt-inline-actions">
        <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={14} />{t('coverPhoto')}</Button>
        <Button type="button" variant="toolbar" size="sm" aria-pressed={cropMode === 'cover'} disabled={busy} onClick={() => onCrop('cover')}>{t('coverFill')}</Button>
        <Button type="button" variant="toolbar" size="sm" aria-pressed={cropMode === 'contain'} disabled={busy} onClick={() => onCrop('contain')}>{t('coverFit')}</Button>
      </div>
      <div className="ipt-inline-actions">
        <Button type="button" variant="generate" size="sm" disabled={busy || generating} onClick={onGenerate}>
          {generating ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {coverUrl ? t('coverRegenerate') : t('coverGenerate')}
        </Button>
        <Button type="button" variant="toolbar" size="sm" disabled={!coverUrl || busy} onClick={onDownload}><Download size={14} />{t('coverDownload')}</Button>
      </div>
      <p className="ipt-help">{t('coverIndependentHint')}</p>
      {generated ? <p className="ipt-help">{t('coverPreviewHint')}</p> : null}
    </div>
  </section>
}
