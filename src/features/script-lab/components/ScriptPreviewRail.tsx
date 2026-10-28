import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { PanelLeftClose } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { GlassPanel } from '@no996/ui'
import {
  videoTargetChars,
  type ScriptConfig,
  type ScriptMode,
} from '../agent/types'
import { LIVE_DURATIONS, VIDEO_DURATIONS } from '../agent/types'
import { countFilledOptionalFields } from '../lib/config-fields'
import { resolvePreviewSegments } from '../lib/preview-segments'
import i18n from '@/i18n'

function formatRailSegmentSeconds(
  seconds: number,
  isVideo: boolean,
  t: TFunction<'scriptLab'>,
): { display: string; aria: string } {
  const aria = t('unit.secondsValue', { count: seconds })
  if (!isVideo && seconds >= 60) {
    const minutes = Math.round(seconds / 60)
    return { display: t('unit.minutesValue', { count: minutes }), aria }
  }
  return { display: `${seconds}″`, aria }
}

export type ScriptPreviewRailProps = {
  mode: ScriptMode
  config: ScriptConfig
  personaActive?: boolean
  wizardStep?: number
  onCollapse?: () => void
}

export function ScriptPreviewRail({
  mode,
  config,
  personaActive,
  wizardStep = 0,
  onCollapse,
}: ScriptPreviewRailProps) {
  const { t } = useTranslation('scriptLab')
  const isVideo = mode === 'video'
  const durations = isVideo ? VIDEO_DURATIONS : LIVE_DURATIONS
  const durationLabel = durations.find((d) => d.seconds === config.durationSec)?.label ?? `${config.durationSec}秒`
  const durationParts = durationLabel.match(/^(\d+)(.*)$/u)
  const segments = useMemo(() => resolvePreviewSegments(config), [config])
  const optional = useMemo(() => countFilledOptionalFields(config), [config])
  const words = isVideo ? videoTargetChars(config.durationSec) : undefined
  const product = config.product.trim()
  const platformLabels: Record<string, string> = {
    抖音: t('platform.douyin'),
    视频号: t('platform.wechatChannel'),
    小红书: t('platform.xiaohongshu'),
    快手: t('platform.kuaishou'),
    淘宝: t('platform.taobao'),
  }
  const goalLabels: Record<string, string> = {
    获客: t('goal.acquisition'),
    人设: t('goal.persona'),
    观点干货: t('goal.opinion'),
    转化: t('goal.conversion2'),
    流量: t('goal.traffic'),
    成交: t('goal.conversion'),
  }
  const purposeLabel = isVideo && config.purpose ? t(`purpose.${config.purpose}`) : undefined
  const strengthKey = config.strength < 34 ? 'form.soft' : config.strength < 67 ? 'form.balanced' : 'form.strong'

  const fillLine =
    wizardStep === 2
      ? optional.filled
        ? t('previewRail.inferredSome', { filled: optional.filled, total: optional.total })
        : t('previewRail.inferredAll')
      : null

  const isExample = !product

  return (
    <GlassPanel as="aside" glow={false} className="sl-wiz-rail" aria-label={t('previewRail.aria')}>
      <div className="sl-wiz-rail__surface">
      <div className="sl-wiz-rail__head">
        <p className="sl-wiz-rail__brand">{t(isExample ? 'previewRail.examplePreview' : 'previewRail.liveUpdate')}</p>
        {onCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="sl-wiz-rail__collapse"
            aria-label={t('previewRail.collapse')}
            onClick={onCollapse}
          >
            <PanelLeftClose aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <>
          <div className="sl-wiz-rail__clock num" aria-live="polite">
            <span className="sl-wiz-rail__clock-num">
              {isVideo ? config.durationSec : durationParts?.[1] ?? durationLabel}
            </span>
            <sup className="sl-wiz-rail__clock-unit">
              {isVideo
                ? t('unit.seconds')
                : durationParts?.[2] === i18n.t("scriptLab:unit.hours")
                  ? t('unit.hours')
                  : durationParts?.[2] === i18n.t("scriptLab:unit.minutes")
                    ? t('unit.minutes')
                    : durationParts?.[2] ?? ''}
            </sup>
          </div>
          {isVideo && words ? <p className="sl-wiz-rail__words">{t('previewRail.words', { count: words })}</p> : null}
      </>

      <div className="sl-wiz-rail__film" aria-label={t('previewRail.timeline')}>
          {segments.map((seg) => {
            const time = formatRailSegmentSeconds(seg.seconds, isVideo, t)
            return (
              <div
                key={seg.name}
                className={`sl-wiz-rail__seg${seg.highlight ? ' sl-wiz-rail__seg--hl' : ''}`}
                style={{ flex: seg.flexWeight }}
              >
                <span>{seg.name}</span>
                <b aria-label={time.aria}>{time.display}</b>
              </div>
            )
          })}
      </div>

      <dl className="sl-wiz-rail__facts">
          <dt>{t('previewRail.product')}</dt>
          <dd>{product || t('previewRail.exampleProduct')}</dd>
          <dt>{t('previewRail.platform')}</dt>
          <dd>{platformLabels[config.platform] ?? config.platform}</dd>
          <dt>{t('previewRail.goal')}</dt>
          <dd>{purposeLabel ?? goalLabels[config.goal] ?? config.goal}</dd>
          <dt>{t('previewRail.conversion')}</dt>
          <dd>{t(strengthKey)} {config.strength}</dd>
          {wizardStep >= 2 && config.intro?.trim() ? (
            <>
              <dt>{t('previewRail.intro')}</dt>
              <dd className="sl-wiz-rail__fact-clamp">{config.intro.trim()}</dd>
            </>
          ) : null}
          <dt>{t('previewRail.persona')}</dt>
          <dd>{t(personaActive ? 'previewRail.injected' : 'previewRail.notInjected')}</dd>
      </dl>

      {fillLine ? <p className="sl-wiz-rail__fill">{fillLine}</p> : null}
      </div>
    </GlassPanel>
  )
}

export default ScriptPreviewRail
