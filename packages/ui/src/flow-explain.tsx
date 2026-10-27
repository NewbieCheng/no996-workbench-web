import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog'
import { HoverTip } from './tooltip'
import {
  FLOW_EXPLAIN_COPY,
  flowKindCounts,
  flowKindSummaryText,
  flowKindTag,
  flowLeadText,
  orderedFlowSteps,
  type FlowExplainStep,
} from './flow-explain-model'

/**
 * 「了解生产流程」（跨板块复用）
 *
 * 解决的问题：用户看不到「我提交之后到底发生了什么」，页面上只剩一句技术腔的
 * 「最多 N 次模型调用」。这里把它翻译成用户视角的一句话 ——
 * **「N 位 AI 专家与你协同，M 个环节接力完成」**，再加上按真实执行顺序排好的环节清单。
 *
 * 形态（2026-10-12 用户决定，覆盖此前的「右侧常驻窄栏」方案）：
 * 页面上只留**一颗图标按钮**（放在页头标题右侧 `titleExtra` / `.page-title-extra`），点击才弹出面板。
 * 理由：常驻窄栏会一直占着右侧版面，就算收起也要留一列宽度；弹层则是
 * 想了解的人点开看，不想了解的人一点都不受影响。
 *
 * 三条硬约定：
 * - **数字全部由 `steps[].kind` 推导**，调用点不许手写数字（见 `flow-explain-model.ts`）。
 * - **不写技术细节**：不说调用次数、不说轮次上限、不说提示词。用户不关心这些。
 * - **`algo` / `tool` 不得算作 AI 专家**，标签由 `kind` 驱动，纯算法一律标「本机」/「纯算法」。
 *
 * 弹层直接用公共 `Dialog`，焦点圈闭、Esc 关闭、遮罩点击关闭都由它提供，
 * 不自造浮层。令牌走 `--fx-*` → `--sl-*` → 全局主题令牌三级回退，脱离 `script-lab` 也能配色。
 */
export type FlowExplainProps = {
  steps: FlowExplainStep[]
  /** 按钮与弹层标题；默认「了解生产流程」 */
  title?: string
  /** 标题下的一句说明；传空串则不渲染 */
  hint?: string
  lang?: 'zh' | 'en'
  className?: string
}

export function FlowExplain({ steps, title, hint, lang = 'zh', className }: FlowExplainProps) {
  const [open, setOpen] = useState(false)
  const ordered = orderedFlowSteps(steps)
  const copy = FLOW_EXPLAIN_COPY[lang]
  const heading = title ?? copy.title
  const note = hint ?? copy.hint
  const lead = flowLeadText(ordered, lang)
  const summary = flowKindSummaryText(ordered, lang)
  const experts = flowKindCounts(ordered).expert

  // 没有阶段就不渲染：一颗点开是空面板的按钮比没有按钮更让人困惑
  if (!ordered.length) return null

  return (
    <>
      <HoverTip label={heading} side="bottom">
      <button
        type="button"
        className={['flow-explain-trigger', 'flow-explain-trigger--icon', className]
          .filter(Boolean)
          .join(' ')}
        data-slot="flow-explain-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={heading}
        onClick={() => setOpen(true)}
      >
        <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
        {experts ? (
          <span className="flow-explain-trigger__badge flow-explain-trigger__badge--icon" aria-hidden="true">
            {experts}
          </span>
        ) : null}
      </button>
      </HoverTip>

      {/* 弹层常挂载、由 `open` 控制（与 TaskCenterDrawer 一致）：
          关的时候 Base UI 自己保持关闭/退场动画的语义，不用我们手动卸载。 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flow-explain-dialog" showCloseButton>
          <header className="flow-explain__header">
            <DialogTitle className="flow-explain__title">{heading}</DialogTitle>
            <div className="flow-explain__prologue">
              <DialogDescription className="flow-explain__lead">{lead}</DialogDescription>
              {note ? <p className="flow-explain__hint">{note}</p> : null}
              {summary ? <p className="flow-explain__summary">{summary}</p> : null}
            </div>
          </header>

          <h3 className="flow-explain__list-heading">{copy.stagesHeading}</h3>
          <ol className="flow-explain__list">
            {ordered.map((step) => (
              <li key={step.id} className="flow-explain__item" data-kind={step.kind}>
                <span className="flow-explain__head-line">
                  <span className="flow-explain__order">{step.order}</span>
                  <span className="flow-explain__label">{step.label}</span>
                  {/* 标签一律由 kind 驱动：纯算法显示「本机」/「纯算法」，绝不写成 AI。
                      调用方传了更具体的措辞（如「独立 AI」）就用调用方的。 */}
                  <span className="flow-explain__tag">{step.tag || flowKindTag(step.kind, lang)}</span>
                </span>
                {/* 「这一步替我做了什么」—— 用户问的就是这句「怎么运行的」，所以给它完整一行 */}
                {step.note ? <span className="flow-explain__note">{step.note}</span> : null}
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default FlowExplain

export type { FlowExplainStep, FlowKindCounts } from './flow-explain-model'
export {
  FLOW_EXPLAIN_COPY,
  flowKindCounts,
  flowKindSummaryText,
  flowKindTag,
  flowLeadText,
} from './flow-explain-model'
