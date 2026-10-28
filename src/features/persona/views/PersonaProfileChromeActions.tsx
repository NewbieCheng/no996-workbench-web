import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu'
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from 'lucide-react'

export type PersonaProfileChromeActionsProps = {
  copied: boolean
  editing: boolean
  busy?: boolean
  canChangeCombo?: boolean
  canEditQuestionnaire?: boolean
  canSetDefault?: boolean
  onCopy: () => void
  onExport: () => void
  onToggleEdit: () => void
  onChangeCombo?: () => void
  onEditQuestionnaire?: () => void
  onSetDefault?: () => void
}

/** 主档案阶段挂到页头 chrome：主操作外露，次要进「更多」 */
export function PersonaProfileChromeActions({
  copied,
  editing,
  busy = false,
  canChangeCombo = false,
  canEditQuestionnaire = false,
  canSetDefault = false,
  onCopy,
  onExport,
  onToggleEdit,
  onChangeCombo,
  onEditQuestionnaire,
  onSetDefault,
}: PersonaProfileChromeActionsProps) {
  const { t } = useTranslation('persona')
  const hasMore = canChangeCombo || canEditQuestionnaire || canSetDefault

  return (
    <div className="persona-profile-chrome-actions" role="toolbar" aria-label={t('profile.chromeActions')}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="persona-profile-chrome-actions__btn"
        onClick={onCopy}
      >
        {copied ? (
          <CheckIcon className="size-3.5 text-emerald-600" aria-hidden="true" />
        ) : (
          <CopyIcon className="size-3.5" aria-hidden="true" />
        )}
        <span>{copied ? t('profile.copiedShort') : t('profile.copyShort')}</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="persona-profile-chrome-actions__btn"
        onClick={onExport}
      >
        <DownloadIcon className="size-3.5" aria-hidden="true" />
        <span>{t('profile.exportShort')}</span>
      </Button>

      <Button
        type="button"
        variant={editing ? 'secondary' : 'outline'}
        size="sm"
        className="persona-profile-chrome-actions__btn"
        disabled={busy}
        onClick={onToggleEdit}
      >
        {editing ? (
          <EyeIcon className="size-3.5" aria-hidden="true" />
        ) : (
          <PencilIcon className="size-3.5" aria-hidden="true" />
        )}
        <span>{editing ? t('preview.viewMode') : t('preview.editProfile')}</span>
      </Button>

      {hasMore ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="persona-profile-chrome-actions__more"
                aria-label={t('profile.moreActions')}
              >
                <EllipsisIcon className="size-3.5" aria-hidden="true" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[11rem]">
            {canChangeCombo && onChangeCombo ? (
              <DropdownMenuItem onClick={onChangeCombo}>
                <SlidersHorizontalIcon className="size-3.5" aria-hidden="true" />
                {t('profile.changeCombo')}
              </DropdownMenuItem>
            ) : null}
            {canSetDefault && onSetDefault ? (
              <DropdownMenuItem onClick={onSetDefault}>
                <SparklesIcon className="size-3.5" aria-hidden="true" />
                {t('recordsSetDefault')}
              </DropdownMenuItem>
            ) : null}
            {canEditQuestionnaire && onEditQuestionnaire ? (
              <>
                {(canChangeCombo || canSetDefault) ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem disabled={busy || editing} onClick={onEditQuestionnaire}>
                  <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
                  {t('select.editQuestionnaire')}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
