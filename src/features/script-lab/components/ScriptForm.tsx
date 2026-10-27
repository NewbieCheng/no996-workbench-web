import { useMemo, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import {
  LIVE_DURATIONS,
  LIVE_PLATFORMS,
  SCRIPT_GOALS,
  VIDEO_DURATIONS,
  VIDEO_PLATFORMS,
  videoTargetChars,
  type ScriptConfig,
  type ScriptGoal,
  type ScriptMode,
} from '../agent/types'
import { ScriptSpecStep } from './ScriptSpecStep'
import { ScriptStructureEditor } from './ScriptStructureEditor'
import { ScriptOptionalFields } from './ScriptOptionalFields'
import { useTranslation } from 'react-i18next'
import { useNotifyOperationMessage } from '../../../lib/toast'

/**
 * 输入区：**极简首屏 + 渐进披露**。
 *
 * 设计取舍（按参考稿，2026-10-12 重做）：
 * - 第一步只有「一个框 + 一个按钮」：产品名。用户不需要先选任何东西。
 * - 时长 / 目标 / 平台一眼可见（胶囊按钮，不用下拉），因为这三个直接决定成稿形态。
 * - 结构、更多设置收进下方，默认折叠；「更多设置」按钮显示「已改 N 项」。
 * - 示例是行内文字链接，不再占一个「导入示例」按钮位。
 * - 人设注入移到页面右上角的开关（见 PersonaInjection），这里不再重复一个人设按钮。
 */
export type ScriptFormProps = {
  mode: ScriptMode
  config: ScriptConfig
  onChange: (patch: Partial<ScriptConfig>) => void
  onSubmit: () => void
  busy?: boolean
  demo?: boolean
  error?: string
  /** 结果已生成后，用户又改了设置 */
  stale?: boolean
  /**
   * Agent 预填的人群 / 卖点 / 痛点，用于摘要行实时回显。
   * `fromFallback` 表示这三项来自代码兜底而非模型推断，此时不得声称「AI 已补全」。
   */
  autofill?: { audience?: string; sellingPoints?: string; pain?: string; fromFallback?: boolean } | null
  /** 行内示例：点一下直接填入 */
  examples?: string[]
  onUseExample?: (text: string) => void
  onReset?: () => void
  /**
   * 向导模式：只渲染其中一步（0 产品 / 1 规格结构 / 2 更多设置）。
   * 不传则渲染完整表单（旧行为，保持兼容）。
   */
  step?: number
  /** 向导模式下藏掉框内提交按钮（走向导页脚的主按钮，避免一页两个生成入口） */
  hideSubmit?: boolean
  /** 向导模式下藏掉行内示例/error/note（由 InputWizard 统一承担） */
  hideFooter?: boolean
}

export function ScriptForm({
  mode,
  config,
  onChange,
  onSubmit,
  busy,
  demo,
  error,
  stale,
  autofill,
  examples = [],
  onUseExample,
  onReset,
  step,
  hideSubmit,
  hideFooter,
}: ScriptFormProps) {
  const { t } = useTranslation('scriptLab')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  useNotifyOperationMessage(error, 'error', `script-form-${mode}`)

  const isVideo = mode === 'video'
  const durations = isVideo ? VIDEO_DURATIONS : LIVE_DURATIONS
  const platforms = isVideo ? VIDEO_PLATFORMS : LIVE_PLATFORMS
  const goalLabels: Record<ScriptGoal, string> = {
    获客: t('goal.acquisition'),
    流量: t('goal.traffic'),
    成交: t('goal.conversion'),
  }
  const goalHints: Record<ScriptGoal, string> = {
    获客: t('goal.hints.acquisition'),
    流量: t('goal.hints.traffic'),
    成交: t('goal.hints.conversion'),
  }
  const platformLabels: Record<string, string> = {
    抖音: t('platform.douyin'),
    视频号: t('platform.wechatChannel'),
    小红书: t('platform.xiaohongshu'),
    快手: t('platform.kuaishou'),
    淘宝: t('platform.taobao'),
  }
  const strengthText = t(
    config.strength < 34 ? 'form.soft' : config.strength < 67 ? 'form.balanced' : 'form.strong',
  )
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return t('unit.secondsValue', { count: seconds })
    if (seconds % 3600 === 0) return `${seconds / 3600} ${t('unit.hours')}`
    return t('unit.minutesValue', { count: seconds / 60 })
  }
  const targetChars = videoTargetChars(config.durationSec)
  const canSubmit = config.product.trim().length > 0
  const durationLabel = formatDuration(config.durationSec)

  /** 已改的选填项数量：驱动「更多设置（已改 N 项）」 */
  const changedCount = useMemo(() => {
    let n = 0
    if (config.intro?.trim()) n += 1
    if (config.audience?.trim()) n += 1
    if (config.sellingPoints?.trim()) n += 1
    if (config.pain?.trim()) n += 1
    if (config.strength !== 50) n += 1
    if (config.mustWords?.length) n += 1
    if (config.bannedWords?.length) n += 1
    if (config.refGood?.trim()) n += 1
    if (config.refCompetitor?.trim()) n += 1
    if (!isVideo && config.offer?.trim()) n += 1
    if (!isVideo && (config.interactionNodes ?? 3) !== 3) n += 1
    return n
  }, [config, isVideo])

  function submit() {
    setTouched(true)
    if (!canSubmit) return
    onSubmit()
  }

  function toList(text: string): string[] {
    return text
      .split(/[\n,，、;；]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  // 摘要行：用户填的优先，否则回显 AI 预填
  /**
   * 只有「用户自己填的」和「模型真的推断出来的」才能进摘要行。
   *
   * 预填失败时 flow 会塞一组代码兜底常量（fromFallback），它们不是 AI 产物：
   * 如果照样显示「AI 已补全」，就是在拿写死的文案冒充模型输出（假成功）。
   */
  const showAutofill = !autofill?.fromFallback
  const effAutofill = showAutofill ? autofill : null
  const effParts = [
    { label: t('form.audience'), value: config.audience?.trim() || effAutofill?.audience || '' },
    { label: t('form.sellingPoints'), value: config.sellingPoints?.trim() || effAutofill?.sellingPoints || '' },
    { label: t('form.pain'), value: config.pain?.trim() || effAutofill?.pain || '' },
  ].filter((p) => p.value)
  /** 摘要行里是否真的有「AI 补全」的成分（用户自己填的不算） */
  const aiFilled = Boolean(
    effAutofill &&
      ((!config.audience?.trim() && effAutofill.audience) ||
        (!config.sellingPoints?.trim() && effAutofill.sellingPoints) ||
        (!config.pain?.trim() && effAutofill.pain)),
  )

  // 向导模式：按步渲染（0 产品 / 1 规格结构 / 2 更多设置）；非向导保持完整表单。
  const showProduct = step === undefined || step === 0
  const showSpecs = step === undefined || step === 1
  const showAdvanced = step === undefined || step === 2

  return (
    <form
      className={step === undefined ? 'sl-form' : 'sl-form sl-form--wizard'}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
    >
      {/* 唯一必填：产品名 */}
      {showProduct ? (
        <>
      <div className="sl-box">
        <span className="sl-box__tag">{isVideo ? t("scriptLab:title.video") : t("uiCopy:直播中", { keySeparator: false })}</span>
        <input
          className="sl-box__input"
          value={config.product}
          maxLength={60}
          autoComplete="off"
          aria-label={isVideo ? t("uiCopy:要推的产品或主题", { keySeparator: false }) : t("uiCopy:要卖的产品或主题", { keySeparator: false })}
          placeholder={t("scriptLab:form.productPlaceholder")}
          onChange={(e) => onChange({ product: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
        {!hideSubmit ? (
        <button type="submit" className="sl-box__go" disabled={busy}>
          {busy ? t("persona:form.aiAssistBusy") : isVideo ? t("scriptLab:form.generateVideo") : t("scriptLab:form.generateLive")}
        </button>
        ) : null}
      </div>
      {touched && !canSubmit ? (
        <p className="sl-note sl-note--warn" role="alert">
          
          {t("uiCopy:先写下你要推的产品，其余交给 Agent 推断。", { keySeparator: false })}
        </p>
      ) : null}
        </>
      ) : null}

      {/* 规格与结构：向导步用分组网格；完整表单沿用紧凑行（兼容） */}
      {showSpecs ? (
        <>
      {step === 1 ? (
        <ScriptSpecStep mode={mode} config={config} onChange={onChange} />
      ) : step === undefined ? (
        <>
      <div className="sl-basic">
        <div className="sl-basic__row" role="group" aria-label={isVideo ? t("scriptLab:duration.video") : t("scriptLab:duration.live")}>
          <span>{t("scriptLab:form.duration")}</span>
          {durations.map((d) => (
            <button
              key={d.seconds}
              type="button"
              className="sl-chip"
              aria-pressed={config.durationSec === d.seconds}
              onClick={() => onChange({ durationSec: d.seconds })}
            >
              {formatDuration(d.seconds)}
            </button>
          ))}
        </div>
        <div className="sl-basic__row" role="group" aria-label={t("uiCopy:流量目标", { keySeparator: false })}>
          <span>{t("scriptLab:form.goal")}</span>
          {SCRIPT_GOALS.map((g) => (
            <button
              key={g}
              type="button"
              className="sl-chip"
              aria-pressed={config.goal === g}
              title={goalHints[g]}
              onClick={() => onChange({ goal: g as ScriptGoal })}
            >
              {goalLabels[g]}
            </button>
          ))}
        </div>
        <div className="sl-basic__row" role="group" aria-label={t("scriptLab:platformHeading")}>
          <span>{t("scriptLab:form.platform")}</span>
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              className="sl-chip"
              aria-pressed={config.platform === p}
              onClick={() => onChange({ platform: p })}
            >
              {platformLabels[p] ?? p}
            </button>
          ))}
        </div>
      </div>

      <ScriptStructureEditor mode={mode} config={config} goal={config.goal} onChange={onChange} />

      <p className="sl-sum">
        
        {t('form.summary', { duration: durationLabel, goal: goalLabels[config.goal], strength: strengthText })}
        {aiFilled ? <>  {t("uiCopy:AI 已补全：", { keySeparator: false })}{effParts.map((p, i) => (
          <span key={p.label}>
            {i > 0 ? '，' : ''}
            {p.label} <b>{p.value}</b>
          </span>
        ))}</> : null}
        {showAutofill ? null : <>{t("uiCopy:（预填未成功，人群/卖点/痛点可自己填一下）", { keySeparator: false })}</>}
        {isVideo ? (
          <>
            {effParts.length ? '。' : ''}{t("uiCopy:目标字数约", { keySeparator: false })} <b>{targetChars}</b>  {t("uiCopy:字", { keySeparator: false })}
          </>
        ) : null}
        {effParts.length || isVideo ? '。' : null}
        {stale ? <b className="sl-sum__warn">  {t("uiCopy:设置已更改，点「重新生成」生效。", { keySeparator: false })}</b> : null}
      </p>
        </>
      ) : null}
        </>
      ) : null}

      {/* 行内示例 + 重置：同一行，不再单独占一个按钮位 */}
      {showProduct ? (
      <div className="sl-exs">
        <span>{t("scriptLab:form.tryExample")}</span>
        {examples.map((ex) => (
          <button key={ex} type="button" className="sl-link" onClick={() => onUseExample?.(ex)}>
            {ex}
          </button>
        ))}
        <span className="sl-exs__spacer" />
        {onReset ? (
          <button type="button" className="sl-link" onClick={onReset}>
            
            {t("common:reset")}
          </button>
        ) : null}
      </div>
      ) : null}

      {/* 更多设置：默认折叠，显示已改项数。
          向导模式（step === 2）本身就是「补细节」这一步，这时直接展开，
          不再让用户先点一次折叠按钮才能看到字段。 */}
      {showAdvanced ? (
        step === 2 ? (
          <ScriptOptionalFields
            mode={mode}
            config={config}
            onChange={onChange}
          />
        ) : (
      <div className="sl-adv">
        <div className="sl-struct__line">
          <button
            type="button"
            className="sl-chip"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <ChevronDown size={13} aria-hidden="true" style={{ verticalAlign: -2 }} />{' '}
            {advancedOpen
              ? t('form.moreCollapse')
              : changedCount
                ? `${t('form.moreExpand')} (${t('form.changedSettings', { count: changedCount })})`
                : `${t('form.moreExpand')} (${t('form.optional')})`}
          </button>
          <span className="sl-form__group-hint">{t("uiCopy:留空的字段由 Agent 推断，写了的不会被覆盖。", { keySeparator: false })}</span>
        </div>

        {advancedOpen ? (
          <div className="sl-adv__grid">
            <div className="sl-adv__group">
              <h4>{t("scriptLab:form.content")}</h4>
              <label className="sl-field">
                <span>{t("scriptLab:form.intro")}</span>
                <input
                  className="sl-input"
                  maxLength={160}
                  value={config.intro ?? ''}
                  placeholder={t("scriptLab:form.introPlaceholder")}
                  onChange={(e) => onChange({ intro: e.target.value })}
                />
              </label>
              <label className="sl-field">
                <span>{t("scriptLab:form.audience")}</span>
                <input
                  className="sl-input"
                  maxLength={60}
                  value={config.audience ?? ''}
                  placeholder={t("uiCopy:留空则由 Agent 预测", { keySeparator: false })}
                  onChange={(e) => onChange({ audience: e.target.value })}
                />
              </label>
              <label className="sl-field">
                <span>{t("scriptLab:form.sellingPoints")}</span>
                <textarea
                  className="sl-textarea"
                  maxLength={300}
                  value={config.sellingPoints ?? ''}
                  placeholder={t("uiCopy:留空则由 Agent 预测；多条换行分隔", { keySeparator: false })}
                  onChange={(e) => onChange({ sellingPoints: e.target.value })}
                />
              </label>
              <label className="sl-field">
                <span>{t("scriptLab:form.pain")}</span>
                <textarea
                  className="sl-textarea"
                  maxLength={300}
                  value={config.pain ?? ''}
                  placeholder={t("uiCopy:留空则由 Agent 预测", { keySeparator: false })}
                  onChange={(e) => onChange({ pain: e.target.value })}
                />
              </label>
            </div>

            <div className="sl-adv__group">
              <h4>{t("scriptLab:form.style")}</h4>
              <label className="sl-field">
                <span>
                  
                  {t("scriptLab:form.conversionStrength")} <em>{strengthText}</em>
                </span>
                <input
                  className="sl-range"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={config.strength}
                  aria-label={t("scriptLab:form.conversionStrength")}
                  onChange={(e) => onChange({ strength: Number(e.target.value) })}
                />
                <span className="sl-range__scale">
                  <span>{t("uiCopy:软种草", { keySeparator: false })}</span>
                  <span>{config.strength}</span>
                  <span>{t("scriptLab:form.strong")}</span>
                </span>
              </label>
              {!isVideo ? (
                <>
                  <label className="sl-field">
                    <span>{t("uiCopy:福利或优惠（只填真实的）", { keySeparator: false })}</span>
                    <textarea
                      className="sl-textarea"
                      maxLength={200}
                      value={config.offer ?? ''}
                      placeholder={t("uiCopy:留空则脚本不会编造库存与限时", { keySeparator: false })}
                      onChange={(e) => onChange({ offer: e.target.value })}
                    />
                  </label>
                  <label className="sl-field">
                    <span>{t("scriptLab:form.interactionCountAria")}</span>
                    <input
                      className="sl-range"
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={config.interactionNodes ?? 3}
                      aria-label={t("scriptLab:form.interactionCountAria")}
                      onChange={(e) => onChange({ interactionNodes: Number(e.target.value) })}
                    />
                    <span className="sl-range__scale">
                      <span>{t("uiCopy:1 个", { keySeparator: false })}</span>
                      <span>{config.interactionNodes ?? 3}  {t("uiCopy:个", { keySeparator: false })}</span>
                      <span>{t("uiCopy:5 个", { keySeparator: false })}</span>
                    </span>
                  </label>
                </>
              ) : null}
            </div>

            <div className="sl-adv__group">
              <h4>{t("scriptLab:form.words")}</h4>
              <label className="sl-field">
                <span>{t("scriptLab:form.mustWords")}</span>
                <textarea
                  className="sl-textarea"
                  maxLength={200}
                  value={(config.mustWords ?? []).join('、')}
                  placeholder={t("scriptLab:form.mustWordsPlaceholder")}
                  onChange={(e) => onChange({ mustWords: toList(e.target.value) })}
                />
              </label>
              <label className="sl-field">
                <span>{t("scriptLab:form.bannedWords")}</span>
                <textarea
                  className="sl-textarea"
                  maxLength={200}
                  value={(config.bannedWords ?? []).join('、')}
                  placeholder={t("scriptLab:form.bannedWordsPlaceholder")}
                  onChange={(e) => onChange({ bannedWords: toList(e.target.value) })}
                />
              </label>
            </div>

            <div className="sl-adv__group sl-adv--wide">
              <h4>{t("uiCopy:参考", { keySeparator: false })}</h4>
              <label className="sl-field">
                <span>{t("uiCopy:你自己表现好的脚本（学节奏与语气，不照抄）", { keySeparator: false })}</span>
                <textarea
                  className="sl-textarea"
                  maxLength={1200}
                  value={config.refGood ?? ''}
                  placeholder={t("scriptLab:form.ownReferencePlaceholder")}
                  onChange={(e) => onChange({ refGood: e.target.value })}
                />
              </label>
              <label className="sl-field">
                <span>{t("uiCopy:对标账号脚本（只用于对比差异）", { keySeparator: false })}</span>
                <textarea
                  className="sl-textarea"
                  maxLength={1200}
                  value={config.refCompetitor ?? ''}
                  placeholder={t("scriptLab:form.optional")}
                  onChange={(e) => onChange({ refCompetitor: e.target.value })}
                />
              </label>
            </div>
          </div>
        ) : null}
      </div>
        )
      ) : null}

      {!hideFooter ? (
        <>
      <p className="sl-note">
        <Sparkles size={13} aria-hidden="true" />
        {demo
          ? t("scriptLab:form.demoNotice")
          : t("uiCopy:正式生成会按平台规则扣除积分；脚本全部在本机编排，密钥不进浏览器。", { keySeparator: false })}
      </p>
        </>
      ) : null}
    </form>
  )
}

export default ScriptForm
