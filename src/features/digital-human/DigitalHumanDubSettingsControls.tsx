import type { ReactNode } from 'react'
import {
  Check,
  ChevronDown,
  Globe,
  Headphones,
  LoaderCircle,
  Mic,
  RotateCcw,
  Sparkles,
  Upload,
  Volume2,
} from 'lucide-react'
import { cn } from '@no996/ui/utils'
import { Button } from '@no996/ui/button'
import {
  GlassMenuDropdown,
  GlassMenuDropdownContent,
  GlassMenuDropdownItem,
  GlassMenuDropdownSeparator,
  GlassMenuDropdownTrigger,
} from '@no996/ui/glass-menu-dropdown'
import { DigitalHumanPersonaChipShell, digitalHumanPersonaChipButtonClass } from './DigitalHumanPersonaChip'

export type DigitalHumanDubSourceMode = 'ai' | 'import'

type DubControlsBase = {
  t: (key: string) => string
  busy: boolean
  pending: boolean
}

export type DigitalHumanDubModeMenuProps = DubControlsBase & {
  dubSourceMode: DigitalHumanDubSourceMode
  onDubSourceModeChange: (mode: DigitalHumanDubSourceMode) => void
}

/** 标题右侧：配音方式（自己配音 / 导入配音） */
export function DigitalHumanDubModeMenu({
  t,
  busy,
  pending,
  dubSourceMode,
  onDubSourceModeChange,
}: DigitalHumanDubModeMenuProps) {
  const disabled = busy || pending
  const modeLabel = dubSourceMode === 'ai' ? t('dubModeAi') : t('dubModeImport')

  return (
    <DigitalHumanPersonaChipShell className="dh-dub-settings__mode-chip-shell">
      <GlassMenuDropdown>
        <GlassMenuDropdownTrigger
          disabled={disabled}
          render={
            <button type="button" className={digitalHumanPersonaChipButtonClass} data-bound="true" disabled={disabled}>
              <Mic size={14} aria-hidden />
              <span className="persona-injection__text">{modeLabel}</span>
              <ChevronDown className="wb-disclosure-chevron shrink-0" size={14} aria-hidden />
            </button>
          }
        />
      <GlassMenuDropdownContent align="start" className="w-52">
        <p className="persona-injection__menu-label persona-binding__menu-label">{t('dubMenuModeHint')}</p>
        <GlassMenuDropdownItem
          className="persona-injection__item dh-dub-settings__menu-item"
          data-current={dubSourceMode === 'ai' ? 'true' : undefined}
          onClick={() => onDubSourceModeChange('ai')}
        >
          <span className="persona-injection__item-name flex-1 min-w-0">{t('dubModeAi')}</span>
          {dubSourceMode === 'ai' ? <Check size={14} className="shrink-0 opacity-70" aria-hidden /> : null}
        </GlassMenuDropdownItem>
        <GlassMenuDropdownItem
          className="persona-injection__item dh-dub-settings__menu-item"
          data-current={dubSourceMode === 'import' ? 'true' : undefined}
          onClick={() => onDubSourceModeChange('import')}
        >
          <span className="persona-injection__item-name flex-1 min-w-0">{t('dubModeImport')}</span>
          {dubSourceMode === 'import' ? <Check size={14} className="shrink-0 opacity-70" aria-hidden /> : null}
        </GlassMenuDropdownItem>
      </GlassMenuDropdownContent>
      </GlassMenuDropdown>
    </DigitalHumanPersonaChipShell>
  )
}

export type DigitalHumanVoiceFooterMenuProps = DubControlsBase & {
  isDubbingActive: boolean
  hasAudio: boolean
  voices: Array<{ id: string; label: string }>
  voiceId: string
  onVoiceIdChange: (id: string) => void
  currentVoiceLabel: string
  onGenerateDub: () => void
}

/** 镜头顶栏 / 音色菜单：选音色 + 生成/重新生成配音 */
export function DigitalHumanVoiceFooterMenu({
  t,
  busy,
  pending,
  isDubbingActive,
  hasAudio,
  voices,
  voiceId,
  onVoiceIdChange,
  currentVoiceLabel,
  onGenerateDub,
}: DigitalHumanVoiceFooterMenuProps) {
  const disabled = busy || pending
  const generateLabel = isDubbingActive
    ? t('dubGenerating')
    : hasAudio
      ? t('regenerateDub')
      : t('generateDub')
  const GenerateIcon = isDubbingActive ? LoaderCircle : hasAudio ? RotateCcw : Mic

  return (
    <DigitalHumanPersonaChipShell>
      <GlassMenuDropdown>
        <GlassMenuDropdownTrigger
          disabled={disabled}
          render={
            <button type="button" className={digitalHumanPersonaChipButtonClass} data-bound="true" disabled={disabled}>
              <Volume2 size={14} aria-hidden />
              <span className="persona-injection__text">{currentVoiceLabel}</span>
              <ChevronDown className="wb-disclosure-chevron shrink-0" size={14} aria-hidden />
            </button>
          }
        />
      <GlassMenuDropdownContent align="end" className="w-56">
        <p className="persona-injection__menu-label persona-binding__menu-label">{t('dubMenuVoiceHint')}</p>
        {voices.map(voice => {
          const selected = voice.id === voiceId
          return (
            <GlassMenuDropdownItem
              key={voice.id}
              className="persona-injection__item dh-dub-settings__menu-item"
              data-current={selected ? 'true' : undefined}
              onClick={() => onVoiceIdChange(voice.id)}
            >
              <span className="persona-injection__item-name flex-1 min-w-0 truncate">{voice.label}</span>
              {selected ? <Check size={14} className="shrink-0 opacity-70" aria-hidden /> : null}
            </GlassMenuDropdownItem>
          )
        })}
        <GlassMenuDropdownSeparator />
        <GlassMenuDropdownItem
          className="persona-injection__item dh-dub-settings__menu-item"
          disabled={isDubbingActive || pending}
          onClick={onGenerateDub}
        >
          <GenerateIcon
            size={14}
            className={cn('shrink-0', isDubbingActive && 'animate-spin text-primary')}
            aria-hidden
          />
          <span className="persona-injection__item-name">{generateLabel}</span>
        </GlassMenuDropdownItem>
      </GlassMenuDropdownContent>
      </GlassMenuDropdown>
    </DigitalHumanPersonaChipShell>
  )
}

export type DigitalHumanImportDubPanelProps = DubControlsBase & {
  hasAudio: boolean
  audioPreview?: ReactNode
  onOpenWorkshop: () => void
  onUploadClick: () => void
  /** IP talking video does not accept public URLs or demo audio; omit to hide the row. */
  onOpenAudioUrl?: () => void
  onImportDemo?: () => void
  workshopTitle?: string
  workshopDesc?: string
}

/** 导入配音内容区：工坊 / 本地上传为主入口 */
export function DigitalHumanImportDubPanel({
  t,
  busy,
  onOpenWorkshop,
  onUploadClick,
  onOpenAudioUrl,
  onImportDemo,
  hasAudio,
  audioPreview,
  workshopTitle,
  workshopDesc,
}: DigitalHumanImportDubPanelProps) {
  const disabled = !!busy

  return (
    <div className="dh-import-dub-panel" role="region" aria-label={t('importPanelSource')}>
      <div className="dh-import-dub-panel__pane">
        {hasAudio ? (
          <div className="dh-import-dub-panel__ready-block">
            <p className="dh-import-dub-panel__hint dh-import-dub-panel__hint--dock">{t('importPanelPreviewOnDock')}</p>
            {audioPreview ? <div className="dh-import-dub-panel__preview">{audioPreview}</div> : null}
          </div>
        ) : null}
        <p className="dh-import-dub-panel__hint">{t('dubMenuImportHint')}</p>
        <div className="dh-import-source-cards">
          <button
            type="button"
            className="dh-import-source-card dh-import-source-card--primary"
            disabled={disabled}
            onClick={onOpenWorkshop}
          >
            <span className="dh-import-source-card__icon" aria-hidden>
              <Headphones size={18} />
            </span>
            <span className="dh-import-source-card__body">
              <span className="dh-import-source-card__title">{workshopTitle ?? t('importTabWorkshop')}</span>
              <span className="dh-import-source-card__desc">{workshopDesc ?? t('importWorkshopDesc')}</span>
            </span>
          </button>
          <button type="button" className="dh-import-source-card" disabled={disabled} onClick={onUploadClick}>
            <span className="dh-import-source-card__icon" aria-hidden>
              <Upload size={18} />
            </span>
            <span className="dh-import-source-card__body">
              <span className="dh-import-source-card__title">{t('importTabUpload')}</span>
              <span className="dh-import-source-card__desc">{t('importUploadDesc')}</span>
            </span>
          </button>
        </div>
        {onOpenAudioUrl || onImportDemo ? <div className="dh-import-source-more">
          {onOpenAudioUrl ? <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" disabled={disabled} onClick={onOpenAudioUrl}>
            <Globe size={14} aria-hidden />
            {t('importTabUrl')}
          </Button> : null}
          {onOpenAudioUrl && onImportDemo ? <span className="dh-import-source-more__sep" aria-hidden /> : null}
          {onImportDemo ? <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" disabled={disabled} onClick={onImportDemo}>
            <Sparkles size={14} className="text-primary" aria-hidden />
            {t('importTabDemo')}
          </Button> : null}
        </div> : null}
      </div>
    </div>
  )
}
