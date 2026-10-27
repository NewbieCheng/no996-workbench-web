import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, Upload } from 'lucide-react'
import { Button } from '@no996/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@no996/ui/dialog'
import { Input } from '@no996/ui/input'
import { Label } from '@no996/ui/label'
import { Separator } from '@no996/ui/separator'
import { Switch } from '@no996/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@no996/ui/tabs'
import type { DigitalHumanProject } from './lib/project-store'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: DigitalHumanProject | null
  busy: boolean
  onUpdate: (recipe: (previous: DigitalHumanProject) => DigitalHumanProject) => void
  onPickReferenceFile: () => void
}

type VideoMode = 'none' | 'url'
type FaceMode = 'file' | 'url'

export function AdvancedSourceSettingsDialog({
  open,
  onOpenChange,
  project,
  busy,
  onUpdate,
  onPickReferenceFile
}: Props) {
  const { t } = useTranslation('digitalHuman')
  const [videoMode, setVideoMode] = useState<VideoMode>('none')
  const [faceMode, setFaceMode] = useState<FaceMode>('file')

  useEffect(() => {
    if (!open || !project) return
    setVideoMode(project.sourceUrl?.trim() ? 'url' : 'none')
    setFaceMode(project.referenceUrl?.trim() ? 'url' : 'file')
  }, [open, project?.id, project?.referenceUrl, project?.sourceUrl])

  const setVideoModeAndSync = (mode: VideoMode) => {
    setVideoMode(mode)
    if (mode === 'none') {
      onUpdate(previous => ({ ...previous, sourceUrl: '' }))
    }
  }

  const setFaceModeAndSync = (mode: FaceMode) => {
    setFaceMode(mode)
    if (mode === 'file') {
      onUpdate(previous => ({ ...previous, referenceUrl: '' }))
    } else {
      onUpdate(previous => {
        const next = { ...previous, referenceUrl: previous.referenceUrl ?? '' }
        delete next.reference
        return next
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dh-advanced-dialog gap-0 p-0 sm:max-w-[480px]">
        <DialogHeader className="dh-advanced-dialog__header">
          <DialogTitle className="sr-only">{t('advancedDialogTitle')}</DialogTitle>
          <DialogDescription className="dh-advanced-dialog__lead">
            <Settings2 size={16} className="text-primary shrink-0" aria-hidden />
            <span>
              <span className="font-medium text-foreground">{t('advancedDialogTitle')}</span>
              <span className="text-muted-foreground"> · {t('advancedDialogDesc')}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        {project ? (
          <div className="dh-advanced-dialog__body">
            <div className="dh-advanced-dialog__section dh-advanced-dialog__section--tight">
              <div className="dh-advanced-source-row">
                <Label className="dh-advanced-source-row__label">{t('advancedVideoSourceLabel')}</Label>
                <Tabs
                  value={videoMode}
                  onValueChange={value => setVideoModeAndSync(value as VideoMode)}
                  className="dh-advanced-source-row__tabs"
                >
                  <TabsList variant="toolbar" className="w-full max-w-full">
                    <TabsTrigger value="none" disabled={busy}>{t('advancedModeSkip')}</TabsTrigger>
                    <TabsTrigger value="url" disabled={busy}>{t('advancedModePublicUrl')}</TabsTrigger>
                  </TabsList>
                </Tabs>
                {videoMode === 'url' ? (
                  <div className="dh-advanced-source-row__panel">
                    <Input
                      value={project.sourceUrl ?? ''}
                      disabled={busy}
                      onChange={event => onUpdate(previous => ({ ...previous, sourceUrl: event.target.value }))}
                      placeholder="https://"
                      autoComplete="off"
                      aria-label={t('publicVideoUrl')}
                    />
                    <p className="dh-advanced-source-row__hint">{t('publicUrlHintShort')}</p>
                  </div>
                ) : null}
              </div>

              <div className="dh-advanced-source-row">
                <Label className="dh-advanced-source-row__label">{t('faceReference')}</Label>
                <Tabs
                  value={faceMode}
                  onValueChange={value => setFaceModeAndSync(value as FaceMode)}
                  className="dh-advanced-source-row__tabs"
                >
                  <TabsList variant="toolbar" className="w-full max-w-full">
                    <TabsTrigger value="file" disabled={busy}>{t('advancedModeLocalFile')}</TabsTrigger>
                    <TabsTrigger value="url" disabled={busy}>{t('advancedModePublicUrl')}</TabsTrigger>
                  </TabsList>
                </Tabs>
                {faceMode === 'file' ? (
                  <div className="dh-advanced-source-row__panel dh-advanced-dialog__upload-row">
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onPickReferenceFile}>
                      <Upload size={14} className="mr-1.5" aria-hidden />
                      {t('uploadReferenceImage')}
                    </Button>
                    <span
                      className="dh-advanced-dialog__file-name"
                      title={project.reference?.name ?? undefined}
                    >
                      {project.reference?.name ?? t('referenceNotSet')}
                    </span>
                  </div>
                ) : (
                  <div className="dh-advanced-source-row__panel">
                    <Input
                      value={project.referenceUrl ?? ''}
                      disabled={busy}
                      onChange={event => onUpdate(previous => ({ ...previous, referenceUrl: event.target.value }))}
                      placeholder="https://"
                      autoComplete="off"
                      aria-label={t('publicReferenceUrl')}
                    />
                    <p className="dh-advanced-source-row__hint">{t('referenceHintShort')}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator className="dh-advanced-dialog__sep" />

            <div className="dh-advanced-dialog__section dh-advanced-dialog__section--tight">
              <div className="dh-advanced-dialog__switch-row">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="dh-video-extension" className="text-sm font-medium leading-snug">
                    {t('extendVideo')}
                  </Label>
                  <p className="dh-advanced-source-row__hint mt-1">{t('extensionAlgoNote')}</p>
                </div>
                <Switch
                  id="dh-video-extension"
                  checked={project.videoExtension !== false}
                  disabled={busy}
                  onCheckedChange={checked =>
                    onUpdate(previous => ({ ...previous, videoExtension: checked }))
                  }
                />
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="dh-advanced-dialog__footer">
          <Button type="button" variant="default" disabled={!project || busy} onClick={() => onOpenChange(false)}>
            {t('advancedDialogDone')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
