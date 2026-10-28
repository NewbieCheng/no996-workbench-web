import {
  GOAL_HINTS,
  LIVE_DURATIONS,
  LIVE_GOALS,
  LIVE_PLATFORMS,
  VIDEO_DURATIONS,
  VIDEO_GOALS,
  VIDEO_PLATFORMS,
  videoTargetChars,
  type ScriptConfig,
  type ScriptGoal,
  type ScriptMode,
} from '../agent/types'
import { SCRIPT_PURPOSES, goalOfPurpose } from '../agent/purposes'
import { platformHints } from '../copy/platform-hints'
import { ScriptOptionTile } from './ScriptOptionTile'
import { ScriptStructureEditor } from './ScriptStructureEditor'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'

export type ScriptSpecStepProps = {
  mode: ScriptMode
  config: ScriptConfig
  onChange: (patch: Partial<ScriptConfig>) => void
}

export function ScriptSpecStep({ mode, config, onChange }: ScriptSpecStepProps) {
  const { t } = useTranslation('scriptLab')
  const isVideo = mode === 'video'
  const durations = isVideo ? VIDEO_DURATIONS : LIVE_DURATIONS
  const platforms = isVideo ? VIDEO_PLATFORMS : LIVE_PLATFORMS
  const hints = platformHints(mode)
  const targetChars = videoTargetChars(config.durationSec)
  const platHint = hints[config.platform]
  const platformLabels: Record<string, string> = {
    抖音: t('platform.douyin'),
    视频号: t('platform.wechatChannel'),
    小红书: t('platform.xiaohongshu'),
    快手: t('platform.kuaishou'),
    淘宝: t('platform.taobao'),
  }
  const goalLabels: Partial<Record<ScriptGoal, string>> = {
    获客: t('goal.acquisition'),
    人设: t('goal.persona'),
    观点干货: t('goal.opinion'),
    转化: t('goal.conversion2'),
    流量: t('goal.traffic'),
    成交: t('goal.conversion'),
  }
  const liveGoals = LIVE_GOALS
  void VIDEO_GOALS

  return (
    <div className="sl-wiz-spec">
      <div className="sl-wiz-blk">
        <div className="sl-wiz-blk__head">
          <h3>{t(isVideo ? 'duration.video' : 'duration.live')}</h3>
          {isVideo ? <span>{t('duration.videoSpeechEstimate', { count: targetChars })}</span> : null}
        </div>
        <div className="sl-wiz-tiles sl-wiz-tiles--5">
          {durations.map((d) => {
            const [, durationNumber, rawDurationUnit] = d.label.match(/^(\d+)(.+)$/) ?? ['', d.label, '']
            const durationUnit = rawDurationUnit === i18n.t("scriptLab:unit.seconds")
              ? t('unit.seconds')
              : rawDurationUnit === i18n.t("scriptLab:unit.minutes")
                ? t('unit.minutes')
                : rawDurationUnit === i18n.t("scriptLab:unit.hours")
                  ? t('unit.hours')
                  : rawDurationUnit
            return (
              <ScriptOptionTile
                key={d.seconds}
                selected={config.durationSec === d.seconds}
                onSelect={() => onChange({ durationSec: d.seconds })}
                className="sl-wiz-tile--dur"
                title={
                  <>
                    <b>{durationNumber}</b>
                    <i>{durationUnit}</i>
                  </>
                }
                subtitle={t('duration.estimate', { count: videoTargetChars(d.seconds) })}
              />
            )
          })}
        </div>
      </div>

      <div className="sl-wiz-blk">
        <div className="sl-wiz-blk__head">
          <h3>{t('platformHeading')}</h3>
          <span>{platHint?.detail ?? ''}</span>
        </div>
        <div className={`sl-wiz-tiles${isVideo ? ' sl-wiz-tiles--4' : ' sl-wiz-tiles--4'}`}>
          {platforms.map((p) => (
            <ScriptOptionTile
              key={p}
              selected={config.platform === p}
              onSelect={() => onChange({ platform: p })}
              title={platformLabels[p] ?? p}
              subtitle={hints[p]?.tagline}
            />
          ))}
        </div>
      </div>

      {isVideo ? (
        <div className="sl-wiz-blk">
          <div className="sl-wiz-blk__head">
            <h3>{t('purposeHeading')}</h3>
            <span>{t('purposeHint')}</span>
          </div>
          <div className="sl-wiz-tiles sl-wiz-tiles--4">
            {SCRIPT_PURPOSES.map((purpose) => (
              <ScriptOptionTile
                key={purpose.id}
                selected={config.purpose === purpose.id}
                onSelect={() =>
                  onChange({
                    purpose: purpose.id,
                    // 目的变化必须清空旧结构，否则会出现「人设型 + 获客结构」的错配
                    goal: goalOfPurpose(purpose.id),
                    structure: { kind: 'auto' },
                  })
                }
                title={purpose.label}
                subtitle={purpose.summary}
              />
            ))}
          </div>
          {!config.purpose ? (
            <p className="sl-wiz-live-warning" role="note">
              {t('purposeRequired')}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="sl-wiz-blk">
          <div className="sl-wiz-blk__head">
            <h3>{t('goalHeading')}</h3>
          </div>
          <div className="sl-wiz-tiles sl-wiz-tiles--3">
            {liveGoals.map((g) => (
              <ScriptOptionTile
                key={g}
                selected={config.goal === g}
                onSelect={() => onChange({ goal: g as ScriptGoal })}
                title={goalLabels[g] ?? g}
                subtitle={GOAL_HINTS[g]}
              />
            ))}
          </div>
        </div>
      )}

      <ScriptStructureEditor mode={mode} config={config} goal={config.goal} onChange={onChange} />
    </div>
  )
}

export default ScriptSpecStep
