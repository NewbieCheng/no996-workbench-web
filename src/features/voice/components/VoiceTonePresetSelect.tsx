import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@no996/ui/select'
import { useTranslation } from 'react-i18next'
import {
  isTonePreset,
  TONE_PRESET_CUSTOM,
  TONE_PRESETS,
  type TonePreset,
} from '../voice-tone-presets'
import { tonePresetLabel } from '../voice-i18n'

const PRESET_ITEMS = TONE_PRESETS.filter((p) => p.label !== TONE_PRESET_CUSTOM)

type Props = {
  value: TonePreset
  onChange: (tone: TonePreset) => void
  /** 直配模式：下拉内提供「自定义」项与输入框 */
  allowCustom?: boolean
  customInstruction?: string
  onCustomInstructionChange?: (text: string) => void
  disabled?: boolean
}

function resolveTriggerLabel(
  value: TonePreset,
  customInstruction?: string,
  customLabel?: string,
): string {
  if (value === TONE_PRESET_CUSTOM) {
    const trimmed = customInstruction?.trim() ?? ''
    if (!trimmed) return customLabel ?? value
    if (trimmed.length <= 12) return trimmed
    return `${trimmed.slice(0, 11)}…`
  }
  return customLabel ?? value
}

export function VoiceTonePresetSelect({
  value,
  onChange,
  allowCustom = false,
  customInstruction = '',
  onCustomInstructionChange,
  disabled,
}: Props) {
  const { t } = useTranslation('voice')
  const customLabel = tonePresetLabel(t, TONE_PRESET_CUSTOM)
  const selectItems = allowCustom
    ? TONE_PRESETS.map((p) => ({ value: p.label, label: tonePresetLabel(t, p.label) }))
    : PRESET_ITEMS.map((p) => ({ value: p.label, label: tonePresetLabel(t, p.label) }))

  return (
    <Select
      items={selectItems}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (isTonePreset(next)) onChange(next)
      }}
    >
      <SelectTrigger size="sm" className="voice-tone-select" aria-label={t('settings.toneSelectAria')}>
        <SelectValue placeholder={t('settings.toneSelectPlaceholder')}>
          {() => resolveTriggerLabel(value, customInstruction, tonePresetLabel(t, value))}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="voice-tone-select-content">
        {PRESET_ITEMS.map((item) => (
          <SelectItem key={item.label} value={item.label}>
            {tonePresetLabel(t, item.label)}
          </SelectItem>
        ))}
        {allowCustom ? (
          <>
            <SelectSeparator />
            <SelectItem value={TONE_PRESET_CUSTOM}>{customLabel}</SelectItem>
            <div
              className="voice-tone-select-custom"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                className="voice-custom-inst-input"
                value={customInstruction}
                onChange={(e) => onCustomInstructionChange?.(e.target.value)}
                onFocus={() => {
                  if (value !== TONE_PRESET_CUSTOM) onChange(TONE_PRESET_CUSTOM)
                }}
                placeholder={t('settings.customTonePlaceholder')}
                maxLength={100}
                aria-label={t('settings.customToneAria')}
              />
            </div>
          </>
        ) : null}
      </SelectContent>
    </Select>
  )
}
