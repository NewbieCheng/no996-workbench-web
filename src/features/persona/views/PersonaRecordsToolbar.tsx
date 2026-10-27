import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@no996/ui/button'

export type PersonaRecordsLayout = 'cards' | 'list'

type Props = {
  onCreate: () => void
}

export function PersonaRecordsToolbar({ onCreate }: Props) {
  const { t } = useTranslation('persona')

  return (
    <div className="persona-records__header-actions">
      <Button
        type="button"
        variant="toolbar"
        size="default"
        onClick={onCreate}
        aria-label={t('recordsCreate')}
      >
        <Plus className="size-4" aria-hidden="true" />
        <span>{t('recordsCreate')}</span>
      </Button>
    </div>
  )
}
