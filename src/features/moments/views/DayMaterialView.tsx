import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MomentsDayMaterial, MomentsScheduleItem } from '../domain/moments'
import { Button } from '@no996/ui/button'
import { Textarea } from '@no996/ui/textarea'
import { Label } from '@no996/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@no996/ui/dialog'
import { ArrowLeftIcon, SparklesIcon } from 'lucide-react'
import { formatDayLabel, weekdayKey } from '../service/week-range'

interface DayMaterialViewProps {
  date: string
  items: MomentsScheduleItem[]
  onBack: () => void
  onSubmit: (materials: MomentsDayMaterial[]) => void
}

export function DayMaterialView({ date, items, onBack, onSubmit }: DayMaterialViewProps) {
  const { t } = useTranslation('workbench')
  const [materials, setMaterials] = useState<Record<string, string>>({})
  const [confirmSkip, setConfirmSkip] = useState(false)
  const ordered = [...items].sort((a, b) => a.publishOrder - b.publishOrder)
  const hasAnyMaterial = ordered.some((item) => (materials[item.id] ?? '').trim().length > 0)

  const buildMaterials = (): MomentsDayMaterial[] =>
    ordered.map((item) => ({
      scheduleItemId: item.id,
      ...(materials[item.id]?.trim() ? { manualMaterial: materials[item.id]!.trim() } : {}),
    }))

  const submit = () => onSubmit(buildMaterials())

  return (
    <div className="moments-material">
      <div className="moments-subhead">
        <div>
          <h2>{t('momentsMaterialTitle')}</h2>
          <p>{t('momentsMaterialSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="moments-material__count">{t('momentsTodayPlanCount', { count: ordered.length })}</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {t('momentsBackToOverview')}
          </Button>
        </div>
      </div>

      <div className="moments-material__banner">
        <span className="moments-material__weekday">{t(weekdayKey(date))}</span>
        <span className="moments-material__date">{formatDayLabel(date)}</span>
        <p className="moments-material__auto">{t('momentsMaterialAutoUsed')}</p>
      </div>

      <div className="moments-material__list moments-form-stack">
        {ordered.map((item) => (
          <section key={item.id} className="moments-material__item">
            <header className="moments-material__item-head">
              <span className="moments-material__order">
                {t('momentsItemLabel')} {String(item.publishOrder).padStart(2, '0')}
              </span>
              <span className="moments-material__direction">
                {item.contentDirection} · {t('momentsPublishOrder')} {String(item.publishOrder).padStart(2, '0')}
              </span>
            </header>
            <p className="moments-material__topic">{item.topic}</p>
            {item.captureSuggestion?.trim() ? (
              <p className="moments-material__capture">
                {t('momentsCaptureSuggestion')}：{item.captureSuggestion}
              </p>
            ) : null}
            <div className="moments-material__field">
              <Label htmlFor={`material-${item.id}`}>{t('momentsManualMaterial')}</Label>
              <Textarea
                id={`material-${item.id}`}
                rows={3}
                value={materials[item.id] ?? ''}
                placeholder={t('momentsMaterialPlaceholder')}
                onChange={(event) => setMaterials((current) => ({ ...current, [item.id]: event.target.value }))}
              />
            </div>
          </section>
        ))}
      </div>

      <div className="moments-material__actions">
        <Button variant="outline" onClick={() => setConfirmSkip(true)}>
          {t('momentsSkipMaterial')}
        </Button>
        <Button className="gap-1.5" onClick={() => (hasAnyMaterial ? submit() : setConfirmSkip(true))}>
          <SparklesIcon className="h-4 w-4" />
          {t('momentsGenerateDayContent')}
        </Button>
      </div>

      <Dialog open={confirmSkip} onOpenChange={setConfirmSkip}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('momentsSkipConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('momentsSkipConfirmDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSkip(false)}>
              {t('momentsBackToFill')}
            </Button>
            <Button
              onClick={() => {
                setConfirmSkip(false)
                submit()
              }}
            >
              {t('momentsContinueGenerate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
