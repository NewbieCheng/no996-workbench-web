import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { Loader2Icon, SendHorizontal, Sparkles } from 'lucide-react'

type SocialStudioPrepActionsProps = {
  generating: boolean
  stageLabel?: string
  generateDisabled?: boolean
  generateLabel: string
  onGenerate: () => void
  onCancel?: () => void
  showPublish?: boolean
  publishDisabled?: boolean
  publishBusy?: boolean
  publishLabel: string
  onPublish: () => void
  publishNotice?: string
}

export function SocialStudioPrepActions({
  generating,
  stageLabel,
  generateDisabled,
  generateLabel,
  onGenerate,
  onCancel,
  showPublish,
  publishDisabled,
  publishBusy,
  publishLabel,
  onPublish,
  publishNotice,
}: SocialStudioPrepActionsProps) {
  const { t } = useTranslation(['socialPublish', 'common'])

  return (
    <div className="ssc-actions flex flex-col gap-2 pt-1 border-t border-border/60">
      {generating ? (
        <div className="ssc-generate-zone__progress flex items-center justify-between gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/25" role="status">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2Icon className="size-4 animate-spin text-primary shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{t('briefGenerating')}</p>
              {stageLabel ? (
                <p className="text-[11px] text-muted-foreground truncate">{stageLabel}</p>
              ) : null}
            </div>
          </div>
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="h-6.5 px-2 text-[11px] rounded-md shrink-0 cursor-pointer"
            >
              {t('common:cancelGeneration')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {publishNotice ? <p className="text-[11px] text-muted-foreground">{publishNotice}</p> : null}

      <div className="flex flex-col gap-1.5 w-full">
        <Button
          type="button"
          disabled={generateDisabled || generating}
          onClick={onGenerate}
          className="w-full h-8.5 text-xs font-semibold rounded-xl gap-1.5 shadow-xs cursor-pointer"
        >
          <Sparkles size={13} className="shrink-0" aria-hidden />
          <span>{generateLabel}</span>
        </Button>

        {showPublish ? (
          <Button
            type="button"
            variant="secondary"
            disabled={publishDisabled || publishBusy || generating}
            onClick={onPublish}
            className="w-full h-8.5 text-xs rounded-xl cursor-pointer font-medium px-3 flex items-center gap-2"
          >
            <span className="flex-1 text-center truncate">{publishBusy ? t('publishing') : publishLabel}</span>
            <SendHorizontal size={14} className="shrink-0 opacity-80" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
