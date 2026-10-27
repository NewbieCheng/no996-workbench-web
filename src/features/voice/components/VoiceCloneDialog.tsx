import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@no996/ui/dialog'
import type { VoiceCloneMeta } from '../../../api/voice-clone'
import { CloneWizard } from './CloneWizard'
import { VoiceCloneDialogPricing } from './VoiceCloneDialogPricing'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: VoiceCloneMeta | null
  busy: boolean
  error?: string
  onSubmit: (payload: { displayName: string; file: File }) => void
}

export function VoiceCloneDialog({ open, onOpenChange, meta, busy, error, onSubmit }: Props) {
  const { t } = useTranslation('voice')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="voice-clone-dialog"
        positionerClassName="voice-clone-dialog-positioner"
        showCloseButton
      >
        <DialogDescription className="sr-only">
          {t('clone.dialogDesc')}
        </DialogDescription>
        <div className="voice-clone-dialog__head">
          <DialogTitle className="voice-clone-dialog__title">{t('clone.dialogTitle')}</DialogTitle>
          <VoiceCloneDialogPricing meta={meta} />
        </div>
        <div className="voice-clone-dialog__body">
          <CloneWizard
            meta={meta}
            busy={busy}
            error={error}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
