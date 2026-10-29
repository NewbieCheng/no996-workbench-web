/**
 * 爆款脚本引擎 · 主编排
 *
 * 阶段固定 + 外层收敛环：
 *   预填 → 策划 → 结构(检索) → 编剧 ─┐
 *                            ├─ 硬校验(代码) → 评审(独立) → 停? ─否─→ 编辑 ─┘ (≤3 轮)
 *                            └─ 定稿(纯算法)
 *
 * 本文件只做编排：不 import React、不 import IDB。
 * 同一份代码既能页内跑，也能入队跑 —— 区别只在传入哪个 sink。
 */
import {
  countSpokenChars,
  createDisplayDelta,
  createStageRunner,
  isAbortError,
  parseStrictJson,
  renderTemplate,
  resolveBudgets,
  type AgentClients,
  type AgentRunSnapshot,
  type AgentSink,
  type HardCheckResult,
  type StageRunner,
} from '../../../agent'
import { SCRIPT_FLOW_ID, SCRIPT_STAGES } from './stages'
import { libraryProvider, structureCustomText } from './library'
import {
  ALTERNATE_PROMPT_LIVE,
  ALTERNATE_PROMPT_VIDEO,
  AUTOFILL_PROMPT,
  EDITOR_PROMPT_LIVE,
  EDITOR_PROMPT_VIDEO,
  PLANNER_PROMPT_LIVE,
  PLANNER_PROMPT_VIDEO,
  REVIEWER_PROMPT_LIVE,
  REVIEWER_PROMPT_VIDEO,
  STRUCTURER_PROMPT_LIVE,
  STRUCTURER_PROMPT_VIDEO,
  WRITER_PROMPT_LIVE,
  WRITER_PROMPT_LIVE_CHAPTER,
  WRITER_PROMPT_VIDEO,
} from './prompts'
import {
  assertExpectedSegmentIds,
  buildStructurePlan,
  formatStructureForWriter,
  liveTargetChars,
  shouldGenerateLiveByChapter,
  structureCharBudget,
  type PlannedStructureSegment,
} from './structure-plan'
import { finalizeScript, formatTimecode, segmentCharBudgets } from './finalize'
import { pickTargets, roundFromReview, shouldStop, MAX_ROUNDS, RETENTION_TARGET } from './retention'
import { purposeById, purposeIdFromGoal } from './purposes'
import type { StoredChatAttachment } from '../../../lib/chat-attachments/types'
import {
  strengthLabel,
  videoTargetChars,
  type ScriptAutofill,
  type ScriptBrief,
  type ScriptConfig,
  type ScriptGeneratePayload,
  type ScriptPromptLogEntry,
  type ScriptReview,
  type ScriptReviewItem,
  type ScriptSegment,
  type ScriptNode,
} from './types'

/**
 * 超时不再写死在这里：按演示/远端取不同档（见 src/agent/budgets.ts）。
 * 旧值（预填 3s / 单步 60s / 流程 90s）是按演示应答器拍的，
 * 真机上单次调用就到 45.8s、整流程 94s，必然超时→降级→假成功。
 */

export type RunScriptFlowInput = {
  config: ScriptConfig
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  /** 参考资料（只随策划与编剧发送，不进评审） */
  chatAttachments?: StoredChatAttachment[]
  /** 从指定步骤恢复：仅重跑该步骤及其下游。 */
  resume?: { fromStageId: string; snapshot: AgentRunSnapshot }
  /** 步骤开始/结束的细粒度回调（页面用于提示） */
  onStageChange?: (stageId: string) => void
  /**
   * 正文流式增量：只在「写作」类阶段（编剧 / 改写）透出。
   *
   * 用途单一 —— 让等待可解释，用户看得到字在长出来。
   * 提示词、工具返回、结构化中间结果一律不从这里出去。
   */
  onDelta?: (chunk: string) => void
}

type ScriptFlowCheckpoint = {
  autofill?: ScriptAutofill
  brief?: ScriptBrief
  structures?: ReturnType<typeof libraryProvider.search>
  structurePlan?: PlannedStructureSegment[]
  libraryIds?: string[]
  segments?: ScriptSegment[]
  rounds?: NonNullable<ScriptGeneratePayload['rounds']>
  lastReview?: ScriptReview
  hardCheckResult?: ReturnType<typeof finalizeScript>['hardCheck']
  checked?: ReturnType<typeof finalizeScript>['hardCheck']
  stopReason?: string
  round?: number
}

function checkpointBeforeScriptStage(
  resume: RunScriptFlowInput['resume'],
): { index: number; checkpoint: ScriptFlowCheckpoint } {
  if (!resume) return { index: 0, checkpoint: {} }
  const index = SCRIPT_STAGES.findIndex((stage) => stage.id === resume.fromStageId)
  if (index < 0 || resume.snapshot.flowId !== SCRIPT_FLOW_ID) throw new Error('无法恢复该脚本流程步骤。')
  if (index === 0) return { index, checkpoint: {} }
  const priorStage = [...SCRIPT_STAGES.slice(0, index)]
    .reverse()
    .find((stage) => resume.snapshot.checkpoints?.[stage.id] !== undefined)
  if (!priorStage) throw new Error('该任务没有可用于此步骤的恢复检查点，请从第一步重新生成。')
  return { index, checkpoint: resume.snapshot.checkpoints?.[priorStage.id] as ScriptFlowCheckpoint }
}

/* ------------------------------ 解析辅助 ------------------------------ */

type RawSegment = {
  id?: unknown
  name?: unknown
  purpose?: unknown
  share?: unknown
  spoken?: unknown
  visual?: unknown
  action?: unknown
  nodes?: unknown
  note?: unknown
}

function toNodes(raw: unknown): ScriptNode[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const allowed = new Set(['互动', '福利', '促单', '演示'])
  const out: ScriptNode[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const type = String(rec.type ?? '').trim()
    const action = String(rec.action ?? '').trim()
    if (!allowed.has(type) || !action) continue
    out.push({ type: type as ScriptNode['type'], action })
  }
  return out
}

/** 用宿主锁定的结构字段构建分段；模型只能提供正文、画面/动作与节点。 */
function segmentFromRaw(
  item: RawSegment,
  base: PlannedStructureSegment,
  libraryIds: string[],
  mode: ScriptConfig['mode'],
): ScriptSegment {
  const spoken = String(item.spoken ?? '').trim()
  if (!spoken) throw new Error('模型返回的分段缺少口播正文，请重试。')
  const seg: ScriptSegment = {
    id: base.id,
    name: base.name,
    purpose: base.purpose,
    share: base.share,
    startSec: 0,
    endSec: 0,
    spoken,
    libraryIds,
    versions: [{ round: 1, spoken }],
  }
  if (mode === 'video') {
    seg.visual = String(item.visual ?? '').trim() || undefined
  } else {
    seg.action = String(item.action ?? '').trim() || undefined
    seg.nodes = toNodes(item.nodes)
  }
  return seg
}

/** 全稿 writer：先校验 id/顺序与宿主结构一致，再由宿主覆盖名称、占比与预算字段。 */
function normalizeWrittenSegments(
  raw: unknown,
  plan: PlannedStructureSegment[],
  libraryIds: string[],
  mode: ScriptConfig['mode'],
): ScriptSegment[] {
  const list = Array.isArray(raw) ? (raw as RawSegment[]) : []
  if (!list.length) throw new Error('模型没有返回任何分段，请重试。')
  assertExpectedSegmentIds(list, plan.map((segment) => segment.id))
  return list.map((item, index) => segmentFromRaw(item, plan[index], libraryIds, mode))
}

/** 长直播单章 writer：只取目标 id 对应的一项，避免模型多返回时污染其他章。 */
function normalizeLiveChapterSegment(
  raw: unknown,
  target: PlannedStructureSegment,
  libraryIds: string[],
): ScriptSegment {
  const list = Array.isArray(raw) ? (raw as RawSegment[]) : []
  const item = list.find((entry) => String(entry.id ?? '').trim() === target.id)
  if (!item) throw new Error('模型返回中缺少目标章 ' + target.id + '，请重试。')
  return segmentFromRaw(item, target, libraryIds, 'live')
}

/** 读取某段的当前口播（用户编辑优先，其次换版，最后原稿） */
export function spokenOf(seg: ScriptSegment, edited?: Record<string, string>, altText?: Record<string, string>): string {
  return edited?.[seg.id] ?? altText?.[seg.id] ?? seg.spoken
}

function promptLogFrom(runner: StageRunner, stages: typeof SCRIPT_STAGES): ScriptPromptLogEntry[] {
  const snapshot = runner.snapshot()
  return snapshot.stages
    .map((state) => {
      const def = stages.find((s) => s.id === state.id)
      if (!def || state.status === 'idle') return null
      const entry: ScriptPromptLogEntry = {
        stageId: def.id,
        roleName: def.roleName,
        roleTag: def.roleTag,
        kind: def.kind,
        principle: def.principle,
        actualPrompt: state.actualPrompt ?? '',
        output: state.output,
      }
      return entry
    })
    .filter((e): e is ScriptPromptLogEntry => Boolean(e))
}

/** 供合规校验使用的「数字可追溯来源」 */
function allowedNumberSources(config: ScriptConfig, brief: ScriptBrief, autofill?: ScriptAutofill): string {
  return [
    config.product,
    config.intro,
    config.sellingPoints,
    config.pain,
    config.audience,
    config.offer,
    config.refGood,
    config.refCompetitor,
    config.mustWords?.join(' '),
    brief.audience,
    brief.pain,
    brief.sellingPoints,
    autofill?.audience,
    autofill?.sellingPoints,
    autofill?.pain,
    // 四类目的的素材同样是事实来源
    ...Object.values(config.materials ?? {}),
    // 时长本身是用户选择的，允许出现
    String(config.durationSec),
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * 把「按目的收集的素材」渲染成提示词里的事实清单。
 *
 * 只列用户真的填了的字段；必填但缺失的显式写「（缺失）」，
 * 让模型知道这里不能编，而不是当成「用户没提所以可以自由发挥」。
 */
function buildPurposeFacts(config: ScriptConfig): string {
  const purpose = purposeById(config.purpose)
  const rows: string[] = []
  const push = (label: string, value: string | undefined) => {
    const text = value?.trim()
    if (text) rows.push(`- ${label}：${text}`)
  }
  // 产品名是本次创作的主体，必须出现在「本次素材」里，而不只是提示词顶部的一个标签。
  push('产品/主题（用户确认，不得替换）', config.product)
  push('产品/主题介绍', config.intro)
  push('目标人群', config.audience)
  push('痛点/问题', config.pain)
  push('卖点', config.sellingPoints)
  if (purpose) {
    for (const field of purpose.materials) {
      const value = config.materials?.[field.key]?.trim()
      if (value) rows.push(`- ${field.label}：${value}`)
      else if (field.required) rows.push(`- ${field.label}：（缺失，不能编造）`)
    }
  }
  return rows.length ? rows.join('\n') : '（无，请只写用户已提供的产品名与主题，不要补造事实）'
}

/**
 * 策划员只能补「用户没填」的字段，且不能把示例占位词当成结果。
 *
 * 之前 `brief.product = planned?.product ?? config.product`：模型返回
 * 「产品」「某产品」或换一个说法，就会覆盖用户输入，编剧便照着改写后的
 * 主体写。这里先把占位值清掉，宿主再决定是否采用。
 */
const INFERENCE_PLACEHOLDERS = new Set([
  '产品',
  '产品名称',
  '商品',
  '主题',
  '某产品',
  '某商品',
  '人群',
  '目标人群',
  '目标用户',
  '某人群',
  '相关人群',
  '特定人群',
  '痛点',
  '卖点',
  '无',
  '未提供',
  '未知',
  'null',
  'undefined',
  'n/a',
  'na',
])

function cleanInference(value: unknown, fieldLabel: string): string {
  if (value && typeof value === 'object') return ''
  const text = String(value ?? '').trim()
  if (!text) return ''
  const normalized = text.replace(/[「」“”"'‘’\s]/g, '')
  if (!normalized) return ''
  if (INFERENCE_PLACEHOLDERS.has(normalized.toLowerCase()) || normalized === fieldLabel) return ''
  if (/^(?:示例|样例|格式示例|具体(?:产品|人群|痛点|卖点))$/.test(normalized)) return ''
  return text
}

/* --------------------------- 硬校验可执行化 --------------------------- */

/**
 * 把硬校验结果整理成评审能直接执行的输入。
 *
 * 之前只丢一句「2 处问题：第一（…）；总字数 289（…）」：没有段 id、没有目标区间，
 * 评审只能靠猜，`mustFixIds` 里的段也可能漏标。现在把「必须标 mustFix 的段」
 * 明确写出来 —— 提示词里那句「已在 mustFixIds 中给出」才不再是空话。
 */
function formatHardCheckForReview(checked: HardCheckResult): string {
  if (!checked.hits.length) return '全部通过。'
  const lines = checked.hits.map((hit) => {
    const where = hit.segmentId ? `[${hit.segmentId}]` : '[全文]'
    return `- ${where} ${hit.label}：${hit.detail}`
  })
  const must = checked.mustFixIds.length
    ? `必须标为 mustFix 的段：${checked.mustFixIds.join('、')}`
    : '没有可直接定位的段（属于全局问题：请判断它最该落在哪一段，并把该段标为 mustFix）'
  return `${checked.hits.length} 处问题\n${must}\n${lines.join('\n')}`
}

/** 某一稿的口播总字数（与硬校验同口径） */
function totalSpoken(segments: ScriptSegment[], spokenOf: (seg: ScriptSegment) => string): number {
  return segments.reduce((sum, seg) => sum + countSpokenChars(spokenOf(seg)), 0)
}

/**
 * 字数总账：目标区间、当前字数、差额、逐段预算与现状。
 *
 * 编辑步骤之前只看得到「完整原稿」和评审意见，既不知道目标字数，也不知道差多少 ——
 * 全局字数命中因此在结构上不可修。这里把它变成一组可执行的数字。
 */
function buildLengthLedger(
  targetChars: number,
  segments: ScriptSegment[],
  spokenOf: (seg: ScriptSegment) => string,
): string {
  const low = Math.round(targetChars * 0.85)
  const high = Math.round(targetChars * 1.15)
  const total = totalSpoken(segments, spokenOf)
  const gap = total > high ? `需要压缩 ${total - high} 字` : total < low ? `需要补足 ${low - total} 字` : '已在区间内'
  const rows = segments.map((seg) => {
    const budget = Math.max(1, Math.round(seg.share * targetChars))
    return `- [${seg.id}] ${seg.name}：预算 ${budget} 字，当前 ${countSpokenChars(spokenOf(seg))} 字`
  })
  return [
    `目标口播字数 ${targetChars} 字（合格区间 ${low}–${high}，按去标点的口播字数计）`,
    `当前合计 ${total} 字，${gap}`,
    '逐段预算与现状：',
    ...rows,
  ].join('\n')
}

/**
 * 全局字数命中时，按「偏离本段预算最多」挑最多 3 段作为定向修复目标。
 *
 * 长度命中本身没有 segmentId，评审也未必会点名；不给编辑明确的段，
 * 三轮都只能盲改。这里用纯算法补齐落点。
 */
function lengthFixTargets(
  checked: HardCheckResult,
  targetChars: number,
  segments: ScriptSegment[],
  spokenOf: (seg: ScriptSegment) => string,
): ScriptReviewItem[] {
  const lengthHit = checked.hits.find((hit) => hit.length)
  if (!lengthHit?.length) return []
  const { direction } = lengthHit.length
  const scored = segments
    .map((seg) => {
      const budget = Math.max(1, Math.round(seg.share * targetChars))
      const current = countSpokenChars(spokenOf(seg))
      return { seg, budget, current, gap: direction === 'over' ? current - budget : budget - current }
    })
    .filter((row) => row.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)

  return scored.map((row) => ({
    segmentId: row.seg.id,
    retention: 0,
    primaryIssue: `本段 ${row.current} 字，预算 ${row.budget} 字`,
    improvementDirection:
      direction === 'over'
        ? `压到 ${row.budget} 字左右：删重复解释和空话，保留具体场景与事实`
        : `补到 ${row.budget} 字左右：补具体场景、动作或证据，不要用空话凑字数`,
    mustFix: true,
  }))
}

/* ------------------------------- 主流程 ------------------------------- */

export async function runScriptFlow(input: RunScriptFlowInput): Promise<ScriptGeneratePayload> {
  const { config, clients, sink, signal, onDelta, chatAttachments } = input
  const isVideo = config.mode === 'video'

  // 四类创作目的：视频按 purpose（旧任务回退到 goal）；直播不注入目的方法。
  const purpose = isVideo ? purposeById(config.purpose ?? purposeIdFromGoal(config.goal)) : undefined
  const purposeLabel = purpose?.label ?? config.goal
  const purposeMethod = purpose?.method ?? ''
  const purposeReviewFocus = purpose?.reviewFocus ?? ''
  // 视频和直播都需要「本次素材」：直播之前完全没有这个块，只拿到产品名和兜底的人群/卖点。
  const purposeFacts = buildPurposeFacts(config)

  // 人设注入：只把正文交给模板，标签由提示词模板自己写（避免两处都加前缀拼出双标题）。
  // 关掉开关时 config.personaContent 为 undefined，模板会渲染成「表达参考人设：无」。
  const personaBlock = config.personaContent ?? ''
  // 背景人设（身份 + 定位卡片）单独一路：走 system 消息，不进「表达参考人设」变量。
  // 必须显式写明「本次主体是产品，人设不是产品」，否则模型会把人设的主营业务写成正文。
  const rawPersonaBackground = config.personaBackground?.trim() ?? ''
  const personaBackground = rawPersonaBackground
    ? [
        '【背景人设｜只影响说话人身份与语气】',
        `本次创作主体是「${config.product.trim()}」。以下人设资料不是本次产品；`,
        '不得把人设的主营业务、客户、案例写成本次产品的事实，也不得用它们替换用户填写的产品名。',
        rawPersonaBackground,
      ].join('\n')
    : ''

  // 预算先取（只跟客户端模式有关），流程截止时间要用它。
  const budgets = resolveBudgets(clients.isMock)
  const { index: resumeIndex, checkpoint: restored } = checkpointBeforeScriptStage(input.resume)

  // 流程级超时：内部 controller 同时受调用方 signal 与流程截止时间控制，
  // 保证超时能真正中断底层请求，而不是只在上层抛错。
  const flowController = new AbortController()
  const onOuterAbort = () => flowController.abort()
  if (signal) {
    if (signal.aborted) flowController.abort()
    else signal.addEventListener('abort', onOuterAbort, { once: true })
  }
  let flowTimedOut = false
  const flowTimer = setTimeout(() => {
    flowTimedOut = true
    flowController.abort()
  }, budgets.flowMs)
  const flowSignal = flowController.signal

  const runner = createStageRunner({
    flowId: SCRIPT_FLOW_ID,
    stages: SCRIPT_STAGES,
    clients,
    sink,
    signal: flowSignal,
    resume: input.resume,
    // 背景上下文：人设 + 定位卡片。runner 级注入，本流程每个模型步骤都自动带上，
    // 不会因为某一步忘了传而「突然不知道我是谁」。system 提示词本身不变。
    background: personaBackground,
  })

  const durationLabel = isVideo
    ? `${config.durationSec}秒`
    : config.durationSec >= 3600
      ? `${Math.round(config.durationSec / 3600)}小时`
      : `${Math.round(config.durationSec / 60)}分钟`

  const target = videoTargetChars(config.durationSec)
  const writerTotalChars = isVideo ? target : liveTargetChars(config.durationSec)

  // 流式展示：编剧与改写返回的都是 JSON，直接透出去会满屏花括号。
  // 这里统一过一道过滤器，只把「口播正文」按增量推给界面（见 agent/stream-filter.ts）。
  const displayDelta = createDisplayDelta(onDelta, ['spoken'])

  runner.markRunning()

  let fallback = Boolean(input.resume?.snapshot.fallback)
  let autofill: ScriptAutofill | undefined = restored.autofill
  let brief: ScriptBrief | undefined = restored.brief
  let segments: ScriptSegment[] = restored.segments ?? []
  let rounds: ScriptRenderRound[] = restored.rounds ?? []
  let lastReview: ScriptReview | undefined = restored.lastReview
  let hardCheckResult: ReturnType<typeof finalizeScript>['hardCheck'] | undefined = restored.hardCheckResult
  let structures: ReturnType<typeof libraryProvider.search> = restored.structures ?? []
  let structurePlan: PlannedStructureSegment[] = (restored.structurePlan ?? []).map((segment, index) => ({
    ...segment,
    id: segment.id || 'seg-' + (index + 1),
  }))
  let libraryIds = restored.libraryIds ?? []
  let stopReason: string | undefined = restored.stopReason

  try {
    await (async () => {
      {
        /* ---------------------- 1. 预填（可失败） ---------------------- */
        if (resumeIndex <= 0) {
          input.onStageChange?.('autofill')
          try {
          const raw = await runner.runModel<Record<string, unknown>>('autofill', {
            userTemplate: AUTOFILL_PROMPT,
            vars: { product: config.product, intro: config.intro },
            timeoutMs: budgets.autofillMs,
            // 给 1 次重试：真机上预填失败主要是瞬时 500 与 JSON 不合法，重试能救回来。
            // 单步预算 30s ⇒ 最坏 60s，远小于流程预算。
            retry: 1,
            responseFormat: { type: 'json_object' },
          })
          autofill = {
            audience: String(raw?.audience ?? '').trim(),
            sellingPoints: String(raw?.sellingPoints ?? '').trim(),
            pain: String(raw?.pain ?? '').trim(),
            assumptions: raw?.assumptions ? String(raw.assumptions) : undefined,
          }
        } catch (e) {
          if (isAbortError(e)) throw e
          // 预填失败不阻塞：降级为通用兜底。
          // 必须标记 fromFallback：这**不是**模型补全的结果，页面不能声称「AI 已补全」。
          autofill = {
            audience: '有这类需求的人',
            sellingPoints: '好用又省事',
            pain: '总被同一个问题困扰',
            fromFallback: true,
          }
          // 也要如实标记整轮降级：否则任务列表只显示「已生成」，
          // 用户无从知道人群/卖点是代码兜底而非模型推断。
          fallback = true
          runner.markFallback(true)
          await runner.failStage('autofill', e)
        }
        if (!autofill) throw new Error('预填步骤没有可恢复结果。')
        await runner.setCheckpoint('autofill', { autofill })
      } else if (!autofill) {
        throw new Error('该任务缺少预填步骤检查点，无法从后续步骤恢复。')
      }

      // 预填失败时 autofill 里是代码兜底常量（fromFallback）。它们不是模型推断，
      // 不能再当成「已知事实」喂给策划/编剧 —— 否则正文会变成通用模板。
      const usableAutofill = autofill && !autofill.fromFallback ? autofill : undefined
      const audience = config.audience?.trim() || usableAutofill?.audience?.trim() || ''
      const sellingPoints = config.sellingPoints?.trim() || usableAutofill?.sellingPoints?.trim() || ''
      const pain = config.pain?.trim() || usableAutofill?.pain?.trim() || ''

      /* ----------------------- 2. 策划员 ----------------------- */
      if (resumeIndex <= 1) {
        input.onStageChange?.('planner')
        const extra = [
          config.intro ? `产品介绍：${config.intro}` : '',
          config.mustWords?.length ? `必须出现的词：${config.mustWords.join('、')}` : '',
          config.bannedWords?.length ? `禁用词：${config.bannedWords.join('、')}` : '',
          personaBlock,
        ]
          .filter(Boolean)
          .join('\n')

        const planned = await runner.runModel<Record<string, unknown>>('planner', {
          userTemplate: isVideo ? PLANNER_PROMPT_VIDEO : PLANNER_PROMPT_LIVE,
          vars: {
            // 空值显式写成「未提供」，避免模板渲染成「无」后模型把它当成一个真实人群
            audience: audience || '未提供',
            product: config.product,
            durationLabel,
            goal: config.goal,
            purposeLabel,
            facts: purposeFacts,
            strength: config.strength,
            pain: pain || '未提供',
            sellingPoints: sellingPoints || '未提供',
            offer: config.offer,
            extra,
          },
          timeoutMs: budgets.stepMs,
          chatAttachments,
          responseFormat: { type: 'json_object' },
        })

        // 宿主锁定用户已填字段：策划只补空，不能覆盖。
        // 产品名 100% 来自用户输入，任何情况下都不采用模型返回的 product。
        brief = {
          goal: config.goal,
          audience: config.audience?.trim() || cleanInference(planned?.audience, '人群') || audience,
          pain: config.pain?.trim() || cleanInference(planned?.pain, '痛点') || pain,
          sellingPoints:
            config.sellingPoints?.trim() ||
            cleanInference(planned?.sellingPoints, '卖点') ||
            sellingPoints,
          product: config.product.trim(),
          durationSec: config.durationSec,
          targetChars: isVideo ? target : undefined,
          strength: config.strength,
          assumption: planned?.assumption
            ? String(planned.assumption)
            : autofill?.fromFallback
              ? '预填未成功：人群/痛点/卖点没有自动补全，正文只依据你填写的信息生成。'
              : null,
        }
        if (!brief) throw new Error('策划步骤没有可恢复结果。')
        await runner.setCheckpoint('planner', { autofill, brief })
      } else if (!brief) {
        throw new Error('该任务缺少策划步骤检查点，无法从后续步骤恢复。')
      }

      if (resumeIndex <= 2) {
        input.onStageChange?.('structurer')
        structures = libraryProvider.search({
          mode: config.mode,
          goal: config.goal,
          durationSec: config.durationSec,
          presetId: config.structure.kind === 'preset' ? config.structure.presetId : undefined,
          customStructure: structureCustomText(config),
        })
        const candidateText = structures
          .map((h) =>
            '- id: ' + h.id + '｜' + h.formulaName + '（来源：' + h.source + '）\n' +
            h.segments.map((s) => '    · ' + s.name + '｜目的：' + s.purpose + '｜建议占比 ' + s.share).join('\n'),
          )
          .join('\n')

        const structured = await runner.runModel<Record<string, unknown>>('structurer', {
          userTemplate: isVideo ? STRUCTURER_PROMPT_VIDEO : STRUCTURER_PROMPT_LIVE,
          vars: {
            candidates: candidateText,
            customStructure: structureCustomText(config) ?? '未指定，按候选库选择',
            goal: config.goal,
            durationLabel,
            nodes: config.interactionNodes ?? 3,
          },
          timeoutMs: budgets.stepMs,
          responseFormat: { type: 'json_object' },
        })

        const structureResult = buildStructurePlan({
          mode: config.mode,
          hits: structures,
          raw: structured,
          durationSec: config.durationSec,
        })
        structurePlan = structureResult.plan
        libraryIds = [structureResult.libraryId]
        await runner.setCheckpoint('structurer', { autofill, brief, structures, structurePlan, libraryIds })
      } else if (!structurePlan?.length || !libraryIds.length) {
        throw new Error('该任务缺少结构步骤检查点，无法从后续步骤恢复。')
      }

      const structureText = formatStructureForWriter(structurePlan, writerTotalChars)

      /* ------------------------ 4. 编剧 ------------------------ */
      if (resumeIndex <= 3) {
        input.onStageChange?.('writer')
        const refGood = config.refGood?.trim()
          ? `参考用户给的过往脚本，学习其节奏和语气，但不得照抄：\n${config.refGood}\n`
          : ''
        const writerVars = {
          // 产品名始终是用户输入；不用 brief 里的任何模型改写结果。
          product: config.product,
          intro: config.intro?.trim() ?? '',
          audience: brief.audience,
          pain: brief.pain,
          sellingPoints: brief.sellingPoints,
          durationLabel,
          targetChars: target,
          structure: structureText,
          platform: config.platform,
          mustWords: config.mustWords?.join('、') ?? '',
          bannedWords: config.bannedWords?.join('、') ?? '',
          offer: config.offer,
          refGood,
          refCompetitor: config.refCompetitor?.trim() ?? '',
          strength: config.strength,
          strengthLabel: strengthLabel(config.strength),
          persona: personaBlock,
          // 四类目的：把该目的的方法与事实清单交给编剧
          purposeLabel,
          purposeMethod,
          facts: purposeFacts,
        }

        if (!isVideo && shouldGenerateLiveByChapter(config.durationSec)) {
          // 1/2 小时等长稿：在原 writer 阶段内逐章生成并合并，避免单次响应截断。
          const chapterSegments: ScriptSegment[] = []
          for (const chapter of structurePlan) {
            const budget = structureCharBudget(chapter, writerTotalChars)
            const writtenChapter = await runner.runModel<{ segments?: unknown }>('writer', {
              userTemplate: WRITER_PROMPT_LIVE_CHAPTER,
              vars: {
                ...writerVars,
                targetId: chapter.id,
                targetName: chapter.name,
                targetPurpose: chapter.purpose,
                targetBudget: budget,
              },
              timeoutMs: budgets.stepMs,
              maxTokens: Math.min(budgets.maxTokensCap, Math.max(2048, Math.ceil(budget * 1.6))),
              onDelta: displayDelta,
            })
            chapterSegments.push(normalizeLiveChapterSegment(writtenChapter?.segments, chapter, libraryIds))
          }
          segments = chapterSegments
        } else {
          const written = await runner.runModel<{ segments?: unknown }>('writer', {
            userTemplate: isVideo ? WRITER_PROMPT_VIDEO : WRITER_PROMPT_LIVE,
            vars: writerVars,
            timeoutMs: budgets.stepMs,
            // 直播也需要参考资料：之前只有视频编剧拿到附件，直播页的上传位等于白填。
            chatAttachments,
            // 编剧走流式，不加 response_format；截断由内核识别并抬高 max_tokens 重试。
            onDelta: displayDelta,
          })
          segments = normalizeWrittenSegments(written?.segments, structurePlan, libraryIds, config.mode)
        }
        await runner.setCheckpoint('writer', { autofill, brief, structures, structurePlan, libraryIds, segments, rounds })
      } else if (!segments.length) {
        throw new Error('该任务缺少编剧步骤检查点，无法从后续步骤恢复。')
      }

      const sources = allowedNumberSources(config, brief ?? emptyBrief(config), autofill)

      /* ------------------ 5–7. 硬校验 → 评审 → 编辑 ------------------ */
        let round = restored.round ?? (resumeIndex >= 4 ? 1 : 0)
        let checked = restored.checked
        let review = lastReview
        let firstResumeIndex = resumeIndex
        let firstLoop = true
        if (resumeIndex <= 6) for (;;) {
          if (!(firstLoop && resumeIndex >= 4)) round += 1
          firstLoop = false
          runner.setRound(round)

          if (firstResumeIndex <= 4) {
            input.onStageChange?.('hardcheck')
            checked = await runner.runAlgo('hardcheck', () =>
              finalizeScript({
                config,
                segments,
                spokenOf: (s) => spokenOf(s),
                allowedNumberSources: sources,
              }).hardCheck,
            )
            await runner.setCheckpoint('hardcheck', {
              autofill, brief, structures, structurePlan, libraryIds, segments, rounds, round,
              checked, lastReview, stopReason,
            })
          }
          if (!checked) throw new Error('该任务缺少硬校验检查点，无法从后续步骤恢复。')

          let reviewForRound = review
          if (firstResumeIndex <= 5) {
            input.onStageChange?.('reviewer')
            const structuredSegments = segments.map((s) => ({
              id: s.id,
              name: s.name,
              purpose: s.purpose,
              spoken: spokenOf(s),
              visual: s.visual,
              action: s.action,
              nodes: s.nodes,
            }))
            const reviewed = await runner.runModel<Record<string, unknown>>('reviewer', {
              userTemplate: isVideo ? REVIEWER_PROMPT_VIDEO : REVIEWER_PROMPT_LIVE,
              vars: {
                // 评审必须知道本次主体，否则「写成了别的产品」它根本看不出来。
                product: config.product,
                facts: purposeFacts,
                purposeLabel,
                purposeReviewFocus,
                segments: structuredSegments
                  .map((s, i) => {
                    const detail = isVideo
                      ? '画面：' + (s.visual ?? '无')
                      : '动作：' + (s.action ?? '无') + '\n节点：' + ((s.nodes ?? []).map((node) => node.type + '：' + node.action).join('；') || '无')
                    return (i + 1) + '. [' + s.id + '] ' + s.name + '（目的：' + s.purpose + '）\n' + s.spoken + '\n' + detail
                  })
                  .join('\n\n'),
                // 之前只传 label+detail：评审看不到「哪一段必须改」，
                // 提示词却声称已在 mustFixIds 给出。现在把段 id 一起交出去。
                hardCheck: formatHardCheckForReview(checked),
              },
              // 独立评审不继承人设：只按产品/主题和稿子本身判断，避免被「我是谁」带偏。
              background: `【独立评审】本次只评审下面这篇稿子是否围绕「${config.product}」展开，不继承人设身份。`,
              round,
              timeoutMs: budgets.reviewerMs,
              maxTokens: budgets.reviewerMaxTokens,
              responseFormat: { type: 'json_object' },
            })
            reviewForRound = parseReview(reviewed, checked.mustFixIds, segments)
            lastReview = reviewForRound
            rounds.push(roundFromReview(round, reviewForRound, segments.map((s) => s.id)))
            await runner.setCheckpoint('reviewer', {
              autofill, brief, structures, structurePlan, libraryIds, segments, rounds, round,
              checked, lastReview, stopReason,
            })
          }
          if (!reviewForRound) throw new Error('该任务缺少评审步骤检查点，无法从后续步骤恢复。')

          if (checked.pass && !reviewForRound.items.some((item) => item.mustFix)) {
            stopReason = '评审未发现必须修改的问题，保留当前有效稿。'
            await runner.skip('editor')
            await runner.setCheckpoint('editor', {
              autofill, brief, structures, structurePlan, libraryIds, segments, rounds, round,
              checked, lastReview, stopReason,
            })
            break
          }

          if (firstResumeIndex < 6) {
            const stop = shouldStop(rounds)
            // 硬校验还红着时不能按留存提前停：否则「稿子越好越快失败」——
            // 明明还有可修项，却因为平均留存达标直接进定稿并判失败。
            const hasHardErrors = !checked.pass
            const mustFinish = rounds.length >= MAX_ROUNDS
            if (stop.stop && (!hasHardErrors || mustFinish)) {
              stopReason = stop.reason
              await runner.skip('editor')
              await runner.setCheckpoint('editor', {
                autofill, brief, structures, structurePlan, libraryIds, segments, rounds, round,
                checked, lastReview, stopReason,
              })
              break
            }
          }

          input.onStageChange?.('editor')
          const reviewTargets = pickTargets(reviewForRound, segments)
          // 全局字数命中没有段 id：用纯算法补落点，否则编辑只能盲改。
          const lengthTargets = isVideo && target > 0
            ? lengthFixTargets(checked, target, segments, (s) => spokenOf(s))
            : []
          const seenTargetIds = new Set<string>()
          const targets = [...reviewTargets, ...lengthTargets].filter((item) => {
            if (seenTargetIds.has(item.segmentId)) return false
            seenTargetIds.add(item.segmentId)
            return true
          })
          const targetIds = targets.map((target) => target.segmentId)
          const targetBlock = targets
            .map((target) => {
              const seg = segments.find((s) => s.id === target.segmentId)
              if (!seg) return ''
              const detail = isVideo
                ? '当前画面：' + (seg.visual ?? '无')
                : '当前动作：' + (seg.action ?? '无') + '\n当前节点：' + ((seg.nodes ?? []).map((node) => node.type + '：' + node.action).join('；') || '无')
              return '[' + seg.id + '] ' + seg.name + '（目的：' + seg.purpose + '）\n当前口播：' + spokenOf(seg) + '\n' + detail + '\n最大问题：' + target.primaryIssue + '\n修改方向：' + target.improvementDirection
            })
            .filter(Boolean)
            .join('\n\n')
          const completeDraft = segments
            .map((seg, index) => {
              const detail = isVideo
                ? '画面：' + (seg.visual ?? '无')
                : '动作：' + (seg.action ?? '无') + '\n节点：' + ((seg.nodes ?? []).map((node) => node.type + '：' + node.action).join('；') || '无')
              return (index + 1) + '. [' + seg.id + '] ' + seg.name + '（目的：' + seg.purpose + '，占比 ' + Math.round(seg.share * 100) + '%）\n口播：' + spokenOf(seg) + '\n' + detail
            })
            .join('\n\n')
          const allowedFacts = allowedNumberSources(config, brief ?? emptyBrief(config), autofill)
          const edited = await runner.runModel<{ segments?: unknown }>('editor', {
            userTemplate: isVideo ? EDITOR_PROMPT_VIDEO : EDITOR_PROMPT_LIVE,
            vars: {
              targets: '允许修改的 targetIds：' + (targetIds.join('、') || '无') + '\n\n可用事实与真实福利：\n' + allowedFacts + '\n真实福利：' + (config.offer?.trim() || '无') + '\n\n完整原稿：\n' + completeDraft + '\n\n目标意见：\n' + targetBlock,
              lengthBudget: isVideo && target > 0
                ? buildLengthLedger(target, segments, (s) => spokenOf(s))
                : '（本次任务不设总字数区间）',
              stopRetention: RETENTION_TARGET,
              maxRounds: MAX_ROUNDS,
              strength: config.strength,
              strengthLabel: strengthLabel(config.strength),
            },
            round,
            timeoutMs: budgets.stepMs,
            onDelta: displayDelta,
          })
          segments = mergeEdited(segments, edited?.segments, round, config.mode, new Set(targetIds))
          await runner.setCheckpoint('editor', {
            autofill, brief, structures, structurePlan, libraryIds, segments, rounds, round,
            checked, lastReview, stopReason,
          })
          firstResumeIndex = 4
        }

        /* ------------------------ 8. 定稿 ------------------------ */
        input.onStageChange?.('finalize')
        const finalized = await runner.runAlgo('finalize', () => {
          const result = finalizeScript({
            config,
            segments,
            spokenOf: (s) => spokenOf(s),
            allowedNumberSources: sources,
          })
          // 定稿不再整份丢弃：硬校验未通过时如实交付，并把命中写进 stopReason，
          // 由页面/任务中心显示「有 N 处待修改」。之前这里直接抛错，
          // 执行器连 payload 都写不进去，用户拿不到任何成稿。
          const pending = result.hardCheck.hits
          const reason = pending.length
            ? `定稿仍有 ${pending.length} 处待修改：${pending.map((hit) => hit.label).join('、')}`
            : stopReason
          return { ...result, stopReason: reason }
        })
        segments = finalized.segments
        hardCheckResult = finalized.hardCheck
        if (!finalized.hardCheck.pass) {
          stopReason = finalized.stopReason
        }
      }
    })()
  } catch (e) {
    clearTimeout(flowTimer)
    signal?.removeEventListener('abort', onOuterAbort)
    if (isAbortError(e) && !flowTimedOut) {
      await runner.finish('cancelled')
      throw e
    }
    // 有任何可渲染的中间结果就用它降级，否则向上抛
    if (!segments.length) {
      await runner.finish('failed')
      throw flowTimedOut
        ? new Error('本次生成超时，已中断。请缩短时长或稍后重试。')
        : e
    }
    fallback = true
    runner.markFallback(true)
    const sources = allowedNumberSources(config, brief ?? emptyBrief(config), autofill)
    const finalized = finalizeScript({
      config,
      segments,
      spokenOf: (s) => spokenOf(s),
      allowedNumberSources: sources,
    })
    segments = finalized.segments
    hardCheckResult = finalized.hardCheck
  } finally {
    clearTimeout(flowTimer)
    signal?.removeEventListener('abort', onOuterAbort)
  }

  await runner.finish('done')

  return {
    config,
    chatAttachments,
    run: runner.snapshot(),
    autofill,
    brief,
    structures,
    segments,
    rounds,
    review: lastReview,
    hardCheck: hardCheckResult
      ? { pass: hardCheckResult.pass, hits: hardCheckResult.hits, charCount: hardCheckResult.charCount }
      : undefined,
    promptLog: promptLogFrom(runner, SCRIPT_STAGES),
    fallback,
    usedMock: clients.isMock,
  }
}

/** 编辑步骤返回的是完整分段（可能含未修改的），按 id 合并 */
function mergeEdited(
  segments: ScriptSegment[],
  raw: unknown,
  round: number,
  mode: ScriptConfig['mode'],
  allowedTargetIds: Set<string>,
): ScriptSegment[] {
  const list = Array.isArray(raw) ? (raw as RawSegment[]) : []
  if (!list.length) return segments

  // 兼容 seg-1 / 1 / 01，但只合并宿主授权且 id 能对上的目标段。
  const normalizeId = (idStr: string) => idStr.replace(/^(?:seg-?)0*/i, '')
  const byNormId = new Map<string, RawSegment>()
  for (const item of list) {
    const rawId = String(item.id ?? '').trim()
    if (!rawId) continue
    byNormId.set(rawId, item)
    byNormId.set(normalizeId(rawId), item)
  }

  return segments.map((seg, index) => {
    if (!allowedTargetIds.has(seg.id)) return seg
    const patch = byNormId.get(seg.id) ?? byNormId.get(normalizeId(seg.id)) ?? byNormId.get(String(index + 1))
    if (!patch) return seg
    const spoken = String(patch.spoken ?? '').trim()
    if (!spoken) return seg
    const next: ScriptSegment = {
      ...seg,
      spoken,
      versions: spoken === seg.spoken
        ? seg.versions
        : [...seg.versions, { round, spoken, note: patch.note ? String(patch.note) : undefined }],
    }
    if (mode === 'video') {
      if ('visual' in patch) next.visual = String(patch.visual ?? '').trim() || undefined
    } else {
      if ('action' in patch) next.action = String(patch.action ?? '').trim() || undefined
      if (Array.isArray(patch.nodes)) next.nodes = toNodes(patch.nodes) ?? []
    }
    return next
  })
}

function parseReview(
  raw: Record<string, unknown> | undefined,
  hardCheckMustFix: string[],
  segments: ScriptSegment[],
): ScriptReview {
  const rawItems = Array.isArray(raw?.items) ? (raw.items as Array<Record<string, unknown>>) : []
  const expectedIds = new Set(segments.map((segment) => segment.id))
  if (rawItems.length !== segments.length) {
    throw new Error('评审返回的条目数量与分段数量不一致，请重试。')
  }
  const seen = new Set<string>()
  for (const item of rawItems) {
    const id = String(item.segmentId ?? '').trim()
    if (!expectedIds.has(id)) throw new Error('评审返回了不存在的 segmentId，请重试。')
    if (seen.has(id)) throw new Error('评审返回了重复的 segmentId，请重试。')
    seen.add(id)
  }
  const unknownHardCheckId = hardCheckMustFix.find((id) => !expectedIds.has(id))
  if (unknownHardCheckId) throw new Error('硬校验结果包含不存在的 segmentId，请重试。')

  const mustFixSet = new Set(hardCheckMustFix)
  const items = segments.map((seg) => {
    const found = rawItems.find((item) => String(item.segmentId ?? '').trim() === seg.id)
    if (!found) throw new Error('评审缺少分段 ' + seg.id + ' 的结论，请重试。')
    const retentionRaw = Number(found.retention)
    const retention = Number.isFinite(retentionRaw)
      ? Math.max(0, Math.min(100, Math.round(retentionRaw)))
      : 100
    return {
      segmentId: seg.id,
      retention,
      primaryIssue: String(found.primaryIssue ?? '').trim(),
      improvementDirection: String(found.improvementDirection ?? '').trim(),
      // 代码校验命中的段强制必须修改，评审无权豁免。
      mustFix: Boolean(found.mustFix) || mustFixSet.has(seg.id),
    }
  })
  const hook = Number(raw?.hookStrength)
  const conversion = Number(raw?.conversion)
  return {
    items,
    hookStrength: Number.isFinite(hook) ? Math.max(0, Math.min(100, Math.round(hook))) : 60,
    conversion: Number.isFinite(conversion) ? Math.max(0, Math.min(100, Math.round(conversion))) : 55,
  }
}

function emptyBrief(config: ScriptConfig): ScriptBrief {
  return {
    goal: config.goal,
    audience: config.audience?.trim() || '',
    pain: config.pain?.trim() || '',
    sellingPoints: config.sellingPoints?.trim() || '',
    product: config.product,
    durationSec: config.durationSec,
    targetChars: config.mode === 'video' ? videoTargetChars(config.durationSec) : undefined,
    strength: config.strength,
    assumption: null,
  }
}

type ScriptRenderRound = NonNullable<ScriptGeneratePayload['rounds']>[number]

/* ------------------------------ 换一版 ------------------------------ */

export type AlternateInput = {
  config: ScriptConfig
  segment: ScriptSegment
  clients: AgentClients
  signal?: AbortSignal
}

/**
 * 单段局部重写（参考规格 8.3）。
 * 与整体重新生成不同：只重写这一段，角度必须不同。
 */
export async function generateAlternate(input: AlternateInput): Promise<{ spoken: string; visual?: string; action?: string }> {
  const { config, segment, clients, signal } = input
  const isVideo = config.mode === 'video'
  const strengthLabel = config.strength < 34 ? '软种草' : config.strength < 67 ? '平衡' : '强促单'
  const userPrompt = renderTemplate(
    isVideo ? ALTERNATE_PROMPT_VIDEO : ALTERNATE_PROMPT_LIVE,
    {
      name: segment.name,
      purpose: segment.purpose,
      spoken: segment.spoken,
      goal: config.goal,
      audience: config.audience ?? '',
      product: config.product,
      sellingPoints: config.sellingPoints ?? '',
      offer: config.offer ?? '无',
      strength: config.strength,
      strengthLabel,
    },
    { mark: false },
  )

  const result = await clients.chat.complete({
    messages: [{ role: 'user', content: userPrompt }],
    profile: 'draft',
    signal,
    stageHint: 'alternate',
  })
  const parsed = parseStrictJson<{ spoken?: unknown; visual?: unknown; action?: unknown }>(
    result.content,
    '换一版结果',
  )
  const spoken = String(parsed.spoken ?? '').trim()
  if (!spoken) throw new Error('换一版没有返回新内容，请重试。')
  if (spoken === segment.spoken) throw new Error('换一版与当前版本相同，请再试一次。')
  return {
    spoken,
    visual: parsed.visual ? String(parsed.visual).trim() : undefined,
    action: parsed.action ? String(parsed.action).trim() : undefined,
  }
}

/* --------------------------- 导出用文本 --------------------------- */

export function teleprompterText(
  config: ScriptConfig,
  segments: ScriptSegment[],
  edited?: Record<string, string>,
  altText?: Record<string, string>,
): string {
  const visLabel = config.mode === 'video' ? '画面' : '互动与动作'
  return segments
    .map((seg) => {
      const head = `【${formatTimecode(seg.startSec)} ${seg.name}】`
      const body = spokenOf(seg, edited, altText)
      const detail = (config.mode === 'video' ? seg.visual : seg.action) ?? ''
      return `${head}\n${body}\n（${visLabel}：${detail}）`
    })
    .join('\n\n')
}

/** 供导出与字数统计复用 */
export { segmentCharBudgets, formatTimecode, spokenOf as segmentSpoken }

/** 重跑类型导出，避免调用方 import 深层路径 */
export type { AgentRunSnapshot }
