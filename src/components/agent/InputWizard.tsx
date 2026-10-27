import type { ReactNode } from 'react'
import { useNotifyOperationMessage } from '@/lib/toast'
import { Loader2, Sparkles } from 'lucide-react'
import { WizardSteps } from '@no996/ui/feedback'
import { GlassPanel } from '@no996/ui'

/**
 * 三步输入向导壳（三页共用）。
 *
 * 解决「参数疲劳」：第 1 步只放必填，第 2 步放有默认值的关键项，
 * 第 3 步放选填补充。用户可以点步骤条随意跳，也可以每一步都跳过直接生成 ——
 * 向导是引导，不是关卡。
 *
 * 主按钮（`onGo`）常驻页脚：第 1 步填完就能走，不强制过三步。
 */

export type InputWizardStep = {
  id: string
  label: string
  description?: string
}

export type InputWizardProps = {
  steps: InputWizardStep[]
  active: number
  onStepChange: (index: number) => void
  children: ReactNode
  /** 主按钮文案，例如「生成视频脚本」 */
  goLabel: string
  busyLabel?: string
  busy?: boolean
  goDisabled?: boolean
  onGo: () => void
  /** 中间步骤的跳过链（点它 = 直接生成），不传则不显示 */
  skipLabel?: string
  backLabel?: string
  nextLabel?: string
  error?: string
  note?: string
  ariaLabel?: string
  /** 脚本 Lab 双栏向导：胶囊步骤 + 粘性页脚 */
  layout?: 'default' | 'scriptLab'
  stepsSlot?: ReactNode
  headerSlot?: ReactNode
  /** 页脚左侧附加操作（如暂存、示例），排在「上一步」之前 */
  footerLeadingSlot?: ReactNode
  /** 为 true 时主按钮仅在最后一步显示（中间步只保留「下一步」） */
  goOnLastStepOnly?: boolean
  /** 禁用「下一步」（例如第 1 步未填产品名） */
  nextDisabled?: boolean
}

export function InputWizard({
  steps,
  active,
  onStepChange,
  children,
  goLabel,
  busyLabel = '生成中…',
  busy,
  goDisabled,
  onGo,
  skipLabel,
  backLabel = '上一步',
  nextLabel = '下一步',
  error,
  note,
  ariaLabel = '分步填写',
  layout = 'default',
  stepsSlot,
  headerSlot,
  footerLeadingSlot,
  goOnLastStepOnly = false,
  nextDisabled = false,
}: InputWizardProps) {
  useNotifyOperationMessage(error, 'error', 'input-wizard')
  const last = steps.length - 1
  const pending = Boolean(busy)
  const scriptLab = layout === 'scriptLab'
  const showGo = !goOnLastStepOnly || active === last

  return (
    <GlassPanel
      as="section"
      glow={false}
      className={scriptLab ? 'wf-wizard wf-wizard--script-lab' : 'wf-wizard'}
      aria-label={ariaLabel}
    >
      {stepsSlot ?? (
        <div className="wf-wizard__steps">
          <WizardSteps
            steps={steps}
            activeIndex={active}
            onStepClick={onStepChange}
            ariaLabel={ariaLabel}
          />
        </div>
      )}

      {headerSlot}

      <div className="wf-wizard__body">{children}</div>

      {note ? (
        <div className="wf-wizard__foot wf-wizard__foot--meta">
          <p className="wf-wizard__note">{note}</p>
        </div>
      ) : null}

      <div className={scriptLab ? 'wf-wizard__foot wf-wizard__foot--sticky' : 'wf-wizard__foot'}>
        {footerLeadingSlot}
        {active > 0 ? (
          <button type="button" className="wf-wizard__nav" onClick={() => onStepChange(active - 1)}>
            {backLabel}
          </button>
        ) : null}
        <span className="wf-wizard__spacer" />
        {skipLabel && active < last ? (
          <button type="button" className="wf-wizard__skip" disabled={pending} onClick={onGo}>
            {skipLabel} →
          </button>
        ) : null}
        {active < last ? (
          <button
            type="button"
            className="wf-wizard__nav"
            disabled={nextDisabled || pending}
            onClick={() => onStepChange(active + 1)}
          >
            {nextLabel}
          </button>
        ) : null}
        {showGo ? (
          <button
            type="button"
            className="wf-wizard__go"
            disabled={goDisabled || pending}
            onClick={onGo}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {pending ? busyLabel : goLabel}
          </button>
        ) : null}
      </div>
    </GlassPanel>
  )
}

export default InputWizard
