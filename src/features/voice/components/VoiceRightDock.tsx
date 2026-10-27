import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@no996/ui/card'
import { VoiceDubSettingsPanel } from './VoiceDubSettingsPanel'
import { VoiceDubModeTabs } from './VoiceDubModeTabs'
import type { TonePreset, VoiceControlParams } from './VoiceSideControl'

type DubProps = {
  mode: 'direct' | 'advanced'
  activeTone: TonePreset
  onToneChange: (tone: TonePreset) => void
  params: VoiceControlParams
  onParamsChange: (patch: Partial<VoiceControlParams>) => void
  skipConfirm?: boolean
  onSkipConfirmChange?: (skip: boolean) => void
  onCtaClick: () => void
  ctaDisabled?: boolean
  ctaBusy?: boolean
  ctaLabel?: string
}

type Props = {
  dubMode: 'direct' | 'advanced'
  onDubModeChange: (mode: 'direct' | 'advanced') => void
  dubModeSwitchDisabled?: boolean
  dub: DubProps
  /** 高阶流程进行中时隐藏方式切换，只展示配音参数 */
  workflowActive?: boolean
  extra?: ReactNode
  voicePicker?: ReactNode
}

export function VoiceRightDock({
  dubMode,
  onDubModeChange,
  dubModeSwitchDisabled = false,
  dub,
  workflowActive = false,
  extra,
  voicePicker,
}: Props) {
  const { t } = useTranslation('voice')
  return (
    <Card className="voice-panel-card voice-right-dock" aria-label={t('dock.ariaLabel')}>
      {!workflowActive ? (
        <VoiceDubModeTabs
          value={dubMode}
          onChange={onDubModeChange}
          disabled={dubModeSwitchDisabled}
        />
      ) : null}

      <div className="voice-dock-body">
        {voicePicker}
        <VoiceDubSettingsPanel
          mode={dub.mode}
          activeTone={dub.activeTone}
          onToneChange={dub.onToneChange}
          params={dub.params}
          onParamsChange={dub.onParamsChange}
          skipConfirm={dub.skipConfirm}
          onSkipConfirmChange={dub.onSkipConfirmChange}
          onCtaClick={dub.onCtaClick}
          ctaDisabled={dub.ctaDisabled}
          ctaBusy={dub.ctaBusy}
          ctaLabel={dub.ctaLabel}
        />
        {extra}
      </div>
    </Card>
  )
}
