import { useMemo, useRef, useState } from 'react'
import { Download, ImagePlus, LoaderCircle, RefreshCw, Sparkles, Upload } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { TemplateCanvas } from '../../components/TemplateCanvas'
import { createTalkCoverProject, TALK_COVER_RATIO_SIZE, type TalkCoverRatio } from '../../lib/cover'
import { talkLookById } from '../talk-looks'
import { useTalkV2Copy } from '../v2-copy'

export type TalkCoverSource = 'poster' | 'ai' | 'upload'

export function TalkCoverPanel({
  lookId,
  title,
  cropMode,
  ratio,
  photo,
  coverUrl,
  busy,
  generating,
  aiBusy,
  onTitle,
  onTitleCommit,
  onCrop,
  onRatio,
  onPhoto,
  onUploadCover,
  onGenerate,
  onGenerateAi,
  onDownload,
}: {
  lookId?: string
  title: string
  cropMode: 'cover' | 'contain'
  ratio: TalkCoverRatio
  photo?: File | Blob
  coverUrl?: string
  busy: boolean
  generating: boolean
  aiBusy?: boolean
  onTitle: (value: string) => void
  onTitleCommit: () => void
  onCrop: (mode: 'cover' | 'contain') => void
  onRatio: (ratio: TalkCoverRatio) => void
  onPhoto: (file: File) => void
  onUploadCover: (file: File) => void
  onGenerate: () => void
  onGenerateAi: (prompt: string) => void
  onDownload: () => void
}) {
  const { t } = useTalkV2Copy()
  const bgRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<TalkCoverSource>('poster')
  const [aiPrompt, setAiPrompt] = useState('')
  const project = useMemo(
    () => createTalkCoverProject({ lookId: lookId ?? talkLookById(lookId)?.id ?? 'scroll', title, ratio }),
    [lookId, title, ratio],
  )
  const size = TALK_COVER_RATIO_SIZE[ratio]
  const generated = !!coverUrl
  const aspect = `${size.width} / ${size.height}`
  return <section className="ipt-cover-studio" aria-labelledby="ipt-cover-title">
    <div className="ipt-section-heading">
      <h3 id="ipt-cover-title">{t('coverPanelTitle')}</h3>
      <span className="ipt-help">{t('coverPanelSize', { width: size.width, height: size.height })}</span>
    </div>
    <div className="ipt-cover-studio__layout">
      <div className="ipt-cover-preview" style={{ aspectRatio: aspect }}>
        {generated && coverUrl
          ? <img src={coverUrl} alt={t('coverPreviewAlt')} className="ipt-cover-preview__img" />
          : <TemplateCanvas project={project} cover={photo} time={0} />}
        {generated && <span className="ipt-cover-preview__badge">{t('coverGeneratedBadge')}</span>}
      </div>
      <div className="ipt-cover-fields">
        <div className="ipt-seg" role="radiogroup" aria-label={t('coverRatio')}>
          {(['1:1', '3:4', '9:16'] as const).map(item => (
            <button key={item} type="button" role="radio" aria-checked={ratio === item} className={ratio === item ? 'on' : undefined} disabled={busy} onClick={() => onRatio(item)}>
              {t(item === '1:1' ? 'coverRatioSquare' : item === '3:4' ? 'coverRatioPortrait' : 'coverRatioStory')}
            </button>
          ))}
        </div>
        <div className="ipt-seg" role="radiogroup" aria-label={t('coverSource')}>
          <button type="button" role="radio" aria-checked={source === 'poster'} className={source === 'poster' ? 'on' : undefined} disabled={busy} onClick={() => setSource('poster')}>{t('coverSourcePoster')}</button>
          <button type="button" role="radio" aria-checked={source === 'ai'} className={source === 'ai' ? 'on' : undefined} disabled={busy} onClick={() => setSource('ai')}>{t('coverSourceAi')}</button>
          <button type="button" role="radio" aria-checked={source === 'upload'} className={source === 'upload' ? 'on' : undefined} disabled={busy} onClick={() => setSource('upload')}>{t('coverSourceUpload')}</button>
        </div>

        {source === 'poster' ? <>
          <label className="ipt-field">{t('coverTitle')}
            <Input value={title} maxLength={36} disabled={busy} onChange={event => onTitle(event.target.value)} onBlur={onTitleCommit} />
          </label>
          <input ref={bgRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onPhoto(file)
          }} />
          <div className="ipt-inline-actions">
            <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={() => bgRef.current?.click()}><ImagePlus size={14} />{t('coverPhoto')}</Button>
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
        </> : null}

        {source === 'ai' ? <>
          <label className="ipt-field">{t('coverAiPrompt')}
            <Textarea value={aiPrompt} rows={3} maxLength={2000} disabled={busy || aiBusy} placeholder={t('coverAiPlaceholder')} onChange={event => setAiPrompt(event.target.value)} />
          </label>
          <div className="ipt-inline-actions">
            <Button type="button" variant="generate" size="sm" disabled={busy || aiBusy || !aiPrompt.trim()} onClick={() => onGenerateAi(aiPrompt.trim())}>
              {aiBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {t('coverAiGenerate')}
            </Button>
            <Button type="button" variant="toolbar" size="sm" disabled={!coverUrl || busy} onClick={onDownload}><Download size={14} />{t('coverDownload')}</Button>
          </div>
          <p className="ipt-help">{t('coverAiHint')}</p>
        </> : null}

        {source === 'upload' ? <>
          <input ref={coverRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onUploadCover(file)
          }} />
          <div className="ipt-inline-actions">
            <Button type="button" variant="generate" size="sm" disabled={busy} onClick={() => coverRef.current?.click()}><Upload size={14} />{t('coverUploadFinished')}</Button>
            <Button type="button" variant="toolbar" size="sm" disabled={!coverUrl || busy} onClick={onDownload}><Download size={14} />{t('coverDownload')}</Button>
          </div>
          <p className="ipt-help">{t('coverUploadHint')}</p>
        </> : null}

        <p className="ipt-help">{t('coverIndependentHint')}</p>
      </div>
    </div>
  </section>
}
