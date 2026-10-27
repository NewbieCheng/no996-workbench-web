import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MomentsContent } from '../domain/moments'
import { clampVersionIndex } from '../domain/moments'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@no996/ui/dialog'
import { Button } from '@no996/ui/button'
import { Textarea } from '@no996/ui/textarea'
import { Label } from '@no996/ui/label'
import { Separator } from '@no996/ui/separator'
import { CopyIcon, Loader2Icon, PencilIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react'
import { formatDayLabel, weekdayKey } from '../service/week-range'

interface ContentDetailDrawerProps {
  content: MomentsContent
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdopt: (version: number) => void
  onSaveEdited: (text: string) => void
  onCopy: (text: string) => void
  onRewrite: (instruction: string) => void
  rewriting: boolean
}

const VERSION_LABELS = ['一', '二', '三'] as const

export function ContentDetailDrawer({
  content,
  open,
  onOpenChange,
  onAdopt,
  onSaveEdited,
  onCopy,
  onRewrite,
  rewriting,
}: ContentDetailDrawerProps) {
  const { t } = useTranslation('workbench')
  const [viewing, setViewing] = useState(() => clampVersionIndex(content.currentVersion))
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [instruction, setInstruction] = useState('')

  useEffect(() => {
    setViewing(clampVersionIndex(content.currentVersion))
    setEditing(false)
  }, [content.id, content.currentVersion, content.versions])

  const meta = content.versionMeta.find((row) => row.version === viewing)
  const body = content.versions[viewing] ?? ''
  const adopted = viewing === content.currentVersion
  const showingEdited = content.manuallyEdited && adopted && Boolean(content.editedText?.trim())
  const displayBody = showingEdited ? content.editedText! : body

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="moments-drawer sm:max-w-lg max-h-[90vh] overflow-y-auto"
        positionerClassName="fixed inset-0 z-50 flex items-stretch justify-end p-0"
      >
        <DialogHeader>
          <DialogTitle>{t('momentsDetailTitle')}</DialogTitle>
          <p className="moments-drawer__subtitle">
            {t(weekdayKey(content.date))} {formatDayLabel(content.date)} · {t('momentsItemNo', { order: content.publishOrder })}
          </p>
        </DialogHeader>

        <div className="moments-drawer__body">
          <section className="moments-drawer__section">
            <span className="moments-drawer__label">{t('momentsTopic')}</span>
            <p className="moments-drawer__topic">{content.topic}</p>
          </section>

          <div className="moments-drawer__tabs" role="tablist">
            {content.versions.map((_, index) => {
              const angle = content.versionMeta.find((row) => row.version === index)?.angleTitle
              return (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={viewing === index}
                  className={`moments-drawer__tab ${viewing === index ? 'moments-drawer__tab--active' : ''}`}
                  onClick={() => {
                    setViewing(index)
                    setEditing(false)
                  }}
                >
                  {t('momentsVersionLabel', { label: VERSION_LABELS[index] ?? index + 1 })}
                  {angle ? <span className="moments-drawer__tab-angle">{angle}</span> : null}
                </button>
              )
            })}
          </div>

          <section className="moments-drawer__section">
            <div className="moments-drawer__section-head">
              <span className="moments-drawer__version-title">
                {t('momentsVersionLabel', { label: VERSION_LABELS[viewing] ?? '' })}
                {meta?.angleTitle ? ` · ${meta.angleTitle}` : ''}
              </span>
              {adopted ? <span className="moments-drawer__badge">{t('momentsCurrentAdopted')}</span> : null}
            </div>
            {editing ? (
              <div className="moments-drawer__edit">
                <Label htmlFor="moments-drawer-text">{t('momentsCurrentText')}</Label>
                <Textarea id="moments-drawer-text" rows={8} value={draftText} onChange={(event) => setDraftText(event.target.value)} />
                <div className="moments-drawer__edit-actions">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    {t('momentsCancelEdit')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      onSaveEdited(draftText)
                      setEditing(false)
                    }}
                  >
                    {t('momentsSaveEdit')}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="moments-drawer__text">{displayBody}</p>
            )}
          </section>

          {!editing && (meta?.imageSuggestion || meta?.naturalBridge) && (
            <section className="moments-drawer__section moments-drawer__hints">
              {meta?.imageSuggestion ? (
                <p>
                  <span className="moments-drawer__hint-label">{t('momentsImageSuggestion')}：</span>
                  {meta.imageSuggestion}
                </p>
              ) : null}
              {meta?.naturalBridge ? (
                <p>
                  <span className="moments-drawer__hint-label">{t('momentsNaturalBridge')}：</span>
                  {meta.naturalBridge}
                </p>
              ) : null}
            </section>
          )}

          <div className="moments-drawer__actions">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => onCopy(displayBody)}>
              <CopyIcon className="h-3.5 w-3.5" />
              {t('momentsCopyContent')}
            </Button>
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  setDraftText(displayBody)
                  setEditing(true)
                }}
              >
                <PencilIcon className="h-3.5 w-3.5" />
                {t('momentsEditText')}
              </Button>
            )}
          </div>

          {!adopted && !editing && (
            <div className="moments-drawer__adopt">
              <p className="moments-drawer__adopt-hint">
                {t('momentsAdoptHint', {
                  current: VERSION_LABELS[clampVersionIndex(content.currentVersion)] ?? '',
                  viewing: VERSION_LABELS[viewing] ?? '',
                })}
              </p>
              <Button size="sm" onClick={() => onAdopt(viewing)}>
                {t('momentsAdoptVersion')}
              </Button>
            </div>
          )}

          <Separator />

          <section className="moments-drawer__section">
            <Label htmlFor="moments-rewrite-instruction">{t('momentsOptimizeLabel')}</Label>
            <Textarea
              id="moments-rewrite-instruction"
              rows={3}
              value={instruction}
              placeholder={t('momentsOptimizePlaceholder')}
              onChange={(event) => setInstruction(event.target.value)}
            />
            <Button
              className="mt-2 w-full gap-1.5"
              disabled={!instruction.trim() || rewriting}
              onClick={() => {
                onRewrite(instruction.trim())
                setInstruction('')
              }}
            >
              {rewriting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <RefreshCwIcon className="h-4 w-4" />}
              {t('momentsRewriteVersions')}
            </Button>
            <p className="moments-drawer__rewrite-hint">
              <SparklesIcon className="h-3 w-3" />
              {t('momentsRewriteHint')}
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
