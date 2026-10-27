import { useMemo, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AgentStageDef, AgentStageState } from '../../agent'
import { AGENT_STATUS_LABEL } from './AgentProgress'

/**
 * 折叠区：展示「这一稿是怎么一步步做出来的」。
 *
 * 产品约束（2026-10-12 用户决定，覆盖此前的「展示提示词」方案）：
 * - **绝不显示提示词**。提示词是内部实现，用户看了既无意义也有泄露风险；
 *   过程面板只负责「让等待可解释」，说明每一步分别在做什么。
 * - **不外显工具轨迹**：kind === 'tool' 的步骤只说明「已执行检索」。
 * - 每步只给「这一步产出了什么」的摘要，不 dump 原始 JSON。
 * - 过程默认折叠，用户主动展开才可见。
 *
 * 数据仍由 StageRunner 记录（actualPrompt 留在快照里供排障），只是不渲染。
 */
export type AgentStageDetailProps = {
  stages: AgentStageState[]
  defs: AgentStageDef[]
  /** 展开时的标题 */
  title?: string
}

/** 把一步的输出压成一句可读摘要，而不是抛 JSON 给用户 */
function outputDigest(output: unknown): string {
  if (output === null || output === undefined) return ''
  if (typeof output === 'string') return output.length > 160 ? `${output.slice(0, 160)}…` : output
  if (Array.isArray(output)) return `产出 ${output.length} 项`
  if (typeof output === 'object') return '已产出结构化结果'
  return String(output)
}

export function AgentStageDetail({ stages, defs, title }: AgentStageDetailProps) {
  const { t, i18n } = useTranslation('workbench')
  const [openId, setOpenId] = useState<string | null>(null)
  const byId = new Map(stages.map((s) => [s.id, s]))
  const ordered = [...defs].sort((a, b) => a.order - b.order)

  const heading = title ?? t('agentStageDetailTitle')

  const overallNoteText = useMemo(() => {
    const model = ordered.filter((d) => d.kind === 'model').length
    const algo = ordered.filter((d) => d.kind === 'algo').length
    const breakdown: string[] = []
    if (model) breakdown.push(t('agentStageDetailModelPart', { count: model }))
    if (algo) breakdown.push(t('agentStageDetailAlgoPart', { count: algo }))
    const sep = i18n.language.startsWith('en') ? ', ' : '，'
    return t('agentStageDetailSummary', {
      stages: ordered.length,
      breakdown: breakdown.join(sep),
    })
  }, [ordered, t, i18n.language])

  const kindNote: Record<AgentStageDef['kind'], string> = {
    model: t('agentStageKindModel'),
    algo: t('agentStageKindAlgo'),
    tool: t('agentStageKindTool'),
  }

  return (
    <details className="agent-detail">
      <summary className="agent-detail__summary">
        <Sparkles size={14} aria-hidden="true" />
        {heading}
      </summary>
      <div className="agent-detail__body">
        <p className="agent-detail__note">{overallNoteText}</p>
        <ul className="agent-detail__list">
          {ordered.map((def) => {
            const state = byId.get(def.id)
            if (!state || state.status === 'idle') return null
            const isOpen = openId === def.id
            const digest = def.kind === 'tool' ? '' : outputDigest(state.output)
            return (
              <li
                key={def.id}
                className="agent-detail__item"
                data-kind={def.kind}
                data-status={state.status}
              >
                <button
                  type="button"
                  className="agent-detail__head"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : def.id)}
                >
                  <ChevronDown
                    size={14}
                    className="agent-detail__chevron"
                    data-open={isOpen || undefined}
                    aria-hidden="true"
                  />
                  <span className="agent-detail__order">{def.order}</span>
                  <span className="agent-detail__role">{def.roleName}</span>
                  <span className={`stage-step__tag stage-step__tag--${def.kind}`}>{def.roleTag}</span>
                  {state.round ? <span className="agent-detail__round">第 {state.round} 轮</span> : null}
                  <span className="agent-detail__status">{AGENT_STATUS_LABEL[state.status]}</span>
                </button>
                {isOpen ? (
                  <div className="agent-detail__content">
                    <p className="agent-detail__principle">{def.principle}</p>
                    <p className="agent-detail__note">{kindNote[def.kind]}</p>
                    {state.status === 'skipped' ? (
                      <p className="agent-detail__note">
                        这一步本轮未执行：前序评审已达到收敛条件，无需再改。
                      </p>
                    ) : null}
                    {digest ? (
                      <div className="agent-detail__block">
                        <div className="agent-detail__block-head">
                          <span>这一步的产出</span>
                        </div>
                        <p className="agent-detail__digest">{digest}</p>
                      </div>
                    ) : null}
                    {state.error ? <p className="field-error">{state.error}</p> : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </details>
  )
}

export default AgentStageDetail
