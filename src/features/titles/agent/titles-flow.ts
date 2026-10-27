/**
 * 爆款标题 · 主编排
 *
 *   理解(模型) → 句式库(内置) → 取词(真实检索) → 写手(模型) ─┐
 *                                        ├─ 硬校验(代码) → 评审(独立·temp0) → 停? ─否─→ 编辑 ─┘ (≤3 轮)
 *                                        └─ 选优(纯算法)
 *
 * 与旧 titles-agent-loop.ts 的关键差异：
 * - 删掉了「演示模式下用预设基准分反推每条标题的点击率/可信度」——那些数字是编的。
 *   现在 ctr / credibility 只能来自模型评审，评审失败则该标题没有分数，而不是给个好看的数字。
 * - 「取词员」不再是假检索，而是真的 web_search 工具步骤。
 * - 「评审」是独立调用（temp 0，只看草稿 + 硬校验），不是同一段流程里的 setTimeout。
 * - 过程数据由 StageRunner 记录，不再手工维护 steps 数组。
 */
import {
  createDisplayDelta,
  createStageRunner,
  isAbortError,
  parseStrictJson,
  resolveBudgets,
  runHardCheck,
  type AgentClients,
  type AgentRunSnapshot,
  type AgentSink,
  type HardCheckResult,
  type StageRunner,
} from '../../../agent'
import { TITLES_FLOW_ID, TITLES_STAGES } from './stages'
import { renderFormulasForPrompt, titleLibrary } from './library'
import {
  EDITOR_PROMPT,
  EDITOR_SYSTEM,
  REVIEWER_PROMPT,
  REVIEWER_SYSTEM,
  UNDERSTANDER_PROMPT,
  UNDERSTANDER_SYSTEM,
  WRITER_PROMPT,
  WRITER_SYSTEM,
} from './prompts'
import {
  computeCompositeScore,
  maxCharsOf,
  normalizeCredibility,
  normalizeCtr,
  rankAndRecommendCandidates,
  resolveEffectiveTone,
  summarizeCandidates,
} from './scoring-model'
import {
  TITLE_STOP,
  type StructuredRequirement,
  type TargetPlatform,
  type TitleCandidate,
  type TitleGeneratePayload,
  type TitleReview,
  type TitleReviewItem,
  type TitleRound,
  type TitleRoundHistory,
  type UserInputSpec,
  type VocabularyFormulaItem,
} from './types'
import type { StoredChatAttachment } from '../../../lib/chat-attachments/prepare'

/**
 * 超时不再写死在这里：按演示/远端取不同档（见 src/agent/budgets.ts）。
 * 旧值（理解 30s / 其它 60s / 流程 120s）对真机偏紧：实测单次调用可达 45.8s。
 */
/** 每条标题最多改几轮（与 TITLE_STOP.maxRounds 一致） */
const MAX_ROUNDS = TITLE_STOP.maxRounds
/** 每条标题的初始稿数（句式库条数上限） */
const TITLE_COUNT = 6

export type RunTitlesFlowInput = {
  input: UserInputSpec
  chatAttachments?: StoredChatAttachment[]
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  /** 从指定步骤恢复：仅重跑该步骤及其下游。 */
  resume?: { fromStageId: string; snapshot: AgentRunSnapshot }
  /** 阶段切换回调（页面用于提示） */
  onStageChange?: (stageId: string) => void
  /**
   * 正文流式增量：只在「写手」阶段透出。
   *
   * 只为减少等待焦虑 —— 用户看得到标题在一条条长出来。
   * 提示词与检索原始返回不从这里出去。
   */
  onDelta?: (chunk: string) => void
}

/* ------------------------------ 解析辅助 ------------------------------ */

type RawDraft = { formulaId?: unknown; title?: unknown }
type RawReview = { id?: unknown; ctr?: unknown; credibility?: unknown; issue?: unknown; improvement?: unknown; mustFix?: unknown }

/**
 * 解析写手输出。
 *
 * 注意：不在这里按平台字数上限截断。截断会把「当前主题实用指南：先把这」
 * 这种半截标题当成成品交付，比明确报错更糟。超限交给硬校验判为需改项，
 * 由编辑步骤定向收敛；若最终仍未修好，需改清单会如实列出。
 */
function parseDrafts(raw: string, formulas: VocabularyFormulaItem[]): RawDraft[] {
  const parsed = parseStrictJson<{ titles?: unknown }>(raw, '写手输出')
  const list = Array.isArray(parsed.titles) ? parsed.titles : []
  const out: RawDraft[] = []
  for (const item of list) {
    if (!item) continue
    if (typeof item === 'string') {
      const title = item.trim()
      if (title) out.push({ title })
      continue
    }
    const rec = item as Record<string, unknown>
    const title = String(rec.title ?? '').trim()
    if (!title) continue
    out.push({ formulaId: rec.formulaId, title })
  }
  if (!out.length) throw new Error('写手没有返回任何标题，请重试。')

  return out.slice(0, TITLE_COUNT).map((item, index) => {
    const title = String(item.title ?? '').trim()
    return {
      formulaId: item.formulaId ?? formulas[index]?.id,
      title,
    }
  })
}

function parseReviews(raw: string, count: number, hardCheck: HardCheckResult): TitleReviewItem[] {
  const parsed = parseStrictJson<{ reviews?: unknown }>(raw, '评审输出')
  const list = Array.isArray(parsed.reviews) ? (parsed.reviews as RawReview[]) : []
  if (!list.length) throw new Error('评审没有返回结果，请重试。')

  // 代码硬校验命中的标题（按显示序号）必须进必改清单，不依赖模型是否照做
  const mustFixIndexes = new Set<number>()
  for (const hit of hardCheck.hits) {
    if (!hit.segmentId) continue
    const index = Number(hit.segmentId)
    if (Number.isInteger(index) && index >= 1 && index <= count) mustFixIndexes.add(index)
  }

  const byId = new Map<number, RawReview>()
  list.forEach((item, index) => {
    const id = Number(item.id)
    byId.set(Number.isInteger(id) && id >= 1 ? id : index + 1, item)
  })

  return Array.from({ length: count }, (_, index) => {
    const item = byId.get(index + 1)
    if (!item) {
      // 评审漏掉某条：不编分数，显式标成必改并说明
      return {
        id: index + 1,
        ctr: 0,
        credibility: 0,
        issue: '评审未返回这一条的分数',
        improvement: '请重新评审或手动调整该标题',
        mustFix: true,
      }
    }
    const ctr = normalizeCtr(item.ctr)
    const credibility = normalizeCredibility(item.credibility)
    return {
      id: index + 1,
      ctr,
      credibility,
      issue: String(item.issue ?? '').trim() || '未指出具体问题',
      improvement: String(item.improvement ?? '').trim() || '保持现有表达',
      mustFix: Boolean(item.mustFix) || mustFixIndexes.has(index + 1) || ctr <= 0,
    }
  })
}

/** 解析编辑输出；返回纯数据结构而非 Map —— 步骤输出会被 JSON 序列化展示在「创作过程」里 */
function parseEditedTitles(
  raw: string,
  current: string[],
  maxChars: number,
): Array<{ id: number; title: string }> {
  const parsed = parseStrictJson<{ titles?: unknown }>(raw, '编辑输出')
  const list = Array.isArray(parsed.titles) ? parsed.titles : []
  const out: Array<{ id: number; title: string }> = []
  list.forEach((item, index) => {
    const rec = typeof item === 'object' && item ? (item as Record<string, unknown>) : null
    const id = rec ? Number(rec.id) : index + 1
    const title = String((rec ? rec.title : item) ?? '').trim()
    if (!title) return
    const key = Number.isInteger(id) && id >= 1 ? id : index + 1
    if (key < 1 || key > current.length) return
    out.push({ id: key, title: title.length > maxChars ? title.slice(0, maxChars) : title })
  })
  return out
}

type TitlesFlowCheckpoint = {
  requirement?: StructuredRequirement
  formulas?: VocabularyFormulaItem[]
  evidence?: string[]
  allowedNumberSources?: string
  titles?: string[]
  histories?: TitleRoundHistory[][]
  rounds?: TitleRound[]
  roundNo?: number
  hardCheck?: HardCheckResult
  review?: TitleReview
}

function checkpointBeforeTitlesStage(
  resume: RunTitlesFlowInput['resume'],
): { index: number; checkpoint: TitlesFlowCheckpoint } {
  if (!resume) return { index: 0, checkpoint: {} }
  const index = TITLES_STAGES.findIndex((stage) => stage.id === resume.fromStageId)
  if (index < 0 || resume.snapshot.flowId !== TITLES_FLOW_ID) throw new Error('无法恢复该标题流程步骤。')
  if (index === 0) return { index, checkpoint: {} }
  const priorStage = [...TITLES_STAGES.slice(0, index)]
    .reverse()
    .find((stage) => resume.snapshot.checkpoints?.[stage.id] !== undefined)
  if (!priorStage) throw new Error('该任务没有可用于此步骤的恢复检查点，请从第一步重新生成。')
  return { index, checkpoint: resume.snapshot.checkpoints?.[priorStage.id] as TitlesFlowCheckpoint }
}

/* ------------------------------ 硬校验 ------------------------------ */

/** 按平台字数与绝对化用语检查标题；同时抓无依据数字（来源=用户输入+检索结果） */
function checkTitles(
  titles: string[],
  maxChars: number,
  allowedNumberSources: string,
): HardCheckResult {
  return runHardCheck({
    text: titles.join('\n'),
    // 用显示序号作为 segmentId，评审与必改清单才能定位到具体那一条
    segments: titles.map((text, i) => ({ id: String(i + 1), text })),
    allowedNumberSources,
    segmentCharBudgets: titles.map((_, i) => ({ id: String(i + 1), budget: maxChars })),
    // 标题有硬性平台上限，不做 130% 宽容
    segmentCharTolerance: 1,
  })
}

/* ------------------------------ 主流程 ------------------------------ */

export async function runTitlesFlow(input: RunTitlesFlowInput): Promise<TitleGeneratePayload> {
  const { clients, sink, signal, onDelta } = input
  const effectiveTone = resolveEffectiveTone(input.input.toneIntensity, input.input.supplement)
  const platform: TargetPlatform = input.input.platform
  const maxChars = maxCharsOf(platform)
  const spec: UserInputSpec = { ...input.input, toneIntensity: effectiveTone }
  const chatAttachments = input.chatAttachments

  // 流式展示：写手返回的是 JSON，直接透出去会满屏花括号。
  // 统一过一道过滤器，只把标题正文按增量推给界面（见 agent/stream-filter.ts）。
  const displayDelta = createDisplayDelta(onDelta, ['title'], '\n')

  // 人设注入：只把正文交给模板，标签由提示词模板自己写（避免两处都加前缀拼出双标题）。
  // 关掉开关时 spec.personaContent 为 undefined，模板会渲染成「表达参考人设：无」。
  const personaBlock = spec.personaContent ?? ''
  // 背景人设（身份 + 定位卡片）单独一路：走 system 消息，不进「表达参考人设」变量。
  const personaBackground = spec.personaBackground ?? ''

  // 预算先取（只跟客户端模式有关），流程截止时间要用它。
  const budgets = resolveBudgets(clients.isMock)
  const { index: resumeIndex, checkpoint: restored } = checkpointBeforeTitlesStage(input.resume)

  const runner: StageRunner = createStageRunner({
    flowId: TITLES_FLOW_ID,
    stages: TITLES_STAGES,
    clients,
    sink,
    signal,
    resume: input.resume,
    // 背景上下文：人设 + 定位卡片。runner 级注入，本流程每个模型步骤都自动带上。
    // system 提示词本身不变。
    background: personaBackground,
  })

  // 流程级超时：abort 会中断底层调用（与 script-flow 同策略）
  const flowAc = new AbortController()
  let flowTimedOut = false
  const onOuterAbort = () => flowAc.abort()
  signal?.addEventListener('abort', onOuterAbort)
  const flowTimer = setTimeout(() => {
    flowTimedOut = true
    flowAc.abort()
  }, budgets.flowMs)
  const fallback = { used: Boolean(input.resume?.snapshot.fallback) }

  const stage = (id: string) => input.onStageChange?.(id)

  try {
    runner.markRunning()

    /* ---------------------- 1. 理解员（模型） ---------------------- */
    let requirement = restored.requirement
    if (resumeIndex <= 0) {
      stage('understander')
      try {
      const parsed = await runner.runModel<Record<string, unknown>>('understander', {
        system: UNDERSTANDER_SYSTEM,
        userTemplate: UNDERSTANDER_PROMPT,
        vars: {
          audience: spec.audience,
          topic: spec.topic,
          platform: spec.platform,
          strength: effectiveTone,
          supplement: spec.supplement?.trim() || '',
        },
        parse: (raw) => parseStrictJson<Record<string, unknown>>(raw, '理解员输出'),
        timeoutMs: budgets.stepMs,
        retry: 1,
        round: 1,
        responseFormat: { type: 'json_object' },
        chatAttachments,
      })
      requirement = {
        theme: String(parsed['主题'] ?? parsed.theme ?? spec.topic).trim() || spec.topic,
        audience: String(parsed['读者'] ?? parsed.audience ?? spec.audience).trim() || spec.audience,
        painPoints: String(parsed['痛点'] ?? parsed.painPoints ?? '').trim(),
        goal: String(parsed['目标'] ?? parsed.goal ?? '点击'),
        platform,
        toneIntensity: effectiveTone,
      }
      const understandAssumption = String(parsed['假设'] ?? parsed.assumptions ?? '').trim()
      if (understandAssumption) requirement.assumptions = understandAssumption
    } catch (e) {
      // 理解失败不阻塞：直接用用户原始输入继续，并如实标记降级
      if (isAbortError(e)) throw e
      fallback.used = true
      await runner.failStage('understander', e)
      requirement = {
        theme: spec.topic,
        audience: spec.audience,
        painPoints: `${spec.topic}缺少可执行的方法`,
        goal: '点击',
        platform,
        toneIntensity: effectiveTone,
      }
      }
      if (!requirement) throw new Error('标题理解步骤没有可恢复结果。')
      await runner.setCheckpoint('understander', { requirement })
    } else if (!requirement) {
      throw new Error('该任务缺少理解步骤的检查点，无法从后续步骤恢复。')
    }

    /* ---------------------- 2. 句式库（内置算法） ---------------------- */
    const formulas = resumeIndex <= 1
      ? await runner.runAlgo<VocabularyFormulaItem[]>('formula', () =>
          titleLibrary().list(platform, TITLE_COUNT),
        )
      : restored.formulas
    if (!formulas) throw new Error('该任务缺少句式库检查点，无法从后续步骤恢复。')
    await runner.setCheckpoint('formula', { ...restored, requirement, formulas })

    /* ------------------- 3. 取词员（真实检索工具） ------------------- */
    stage('retriever')
    let evidence: string[] = resumeIndex > 2 ? restored.evidence ?? [] : []
    if (resumeIndex <= 2) {
      try {
        evidence = await runner.runTool<string[]>('retriever', async () => {
          const query = [requirement.theme, requirement.audience, platform, '选题 受众 常见问题']
            .filter(Boolean)
            .join(' ')
          const result = await runner.runSearch(
            'retriever',
            query,
            `围绕“${requirement.theme}”和“${requirement.audience}”查找${platform}受众常见问题，为标题提供主题相关的事实依据。`,
          )
          if (result.status === 'failed' || result.status === 'rejected') {
            throw new Error(result.error ?? '联网搜索失败')
          }
          return result.snippets
            .map((s) => [s.title, s.snippet].filter(Boolean).join('｜'))
            .filter(Boolean)
            .slice(0, 8)
        })
      } catch (e) {
        if (isAbortError(e)) throw e
        fallback.used = true
        await runner.failStage('retriever', e)
        evidence = []
      }
    }

    const allowedNumberSources = resumeIndex > 3 && restored.allowedNumberSources
      ? restored.allowedNumberSources
      : [
          spec.topic,
          spec.audience,
          spec.supplement ?? '',
          requirement.painPoints,
          ...evidence,
        ].join('\n')
    await runner.setCheckpoint('retriever', {
      ...restored,
      requirement,
      formulas,
      evidence,
      allowedNumberSources,
    })

    /* ----------------------- 4-7. 生成 + 收敛环 ---------------------- */
    let titles = restored.titles ?? []
    let histories = restored.histories ?? []
    let rounds = restored.rounds ?? []
    let roundNo = restored.roundNo ?? 1
    let hardCheck = restored.hardCheck ?? { pass: true, hits: [], mustFixIds: [], charCount: 0 } as HardCheckResult
    let review = restored.review ?? { items: [], rounds: [] } as TitleReview

    if (resumeIndex <= 3) {
      stage('writer')
      const drafts = await runner.runModel<RawDraft[]>('writer', {
      system: WRITER_SYSTEM,
      userTemplate: WRITER_PROMPT,
      vars: {
        audience: requirement.audience,
        count: TITLE_COUNT,
        platform,
        strength: effectiveTone,
        maxChars,
        formulas: renderFormulasForPrompt(formulas),
        evidence: evidence.join('\n') || '（无检索结果，请只使用用户提供的信息）',
        topic: requirement.theme,
        painPoints: requirement.painPoints || '未提供',
        goal: requirement.goal,
        supplement: spec.supplement?.trim() || '',
        persona: personaBlock,
      },
      parse: (raw) => parseDrafts(raw, formulas),
      timeoutMs: budgets.stepMs,
      round: 1,
      // 写手是本流程唯一的长步骤，只有它值得透出流式正文
      onDelta: displayDelta,
      chatAttachments,
    })

      titles = drafts.map((d) => String(d.title ?? '').trim())
      histories = titles.map((title) => [
        { round: 1, title, ctr: 0, credibility: 0, score: 0 },
      ])
      rounds = []
      roundNo = 1
      hardCheck = { pass: true, hits: [], mustFixIds: [], charCount: 0 }
      review = { items: [], rounds: [] }
      await runner.setCheckpoint('writer', {
        requirement,
        formulas,
        evidence,
        allowedNumberSources,
        titles,
        histories,
        rounds,
        roundNo,
        hardCheck,
        review,
      })
    } else if (!titles.length || !histories.length) {
      throw new Error('该任务缺少写手步骤检查点，无法从后续步骤恢复。')
    }

    let firstResumeIndex = resumeIndex
    if (resumeIndex <= 6) for (;;) {
      runner.setRound(roundNo)

      /* ----------- 硬校验（纯算法） ----------- */
      if (firstResumeIndex <= 4) {
        stage('hardcheck')
        hardCheck = await runner.runAlgo<HardCheckResult>('hardcheck', () =>
          checkTitles(titles, maxChars, allowedNumberSources),
        )
        await runner.setCheckpoint('hardcheck', {
          requirement, formulas, evidence, allowedNumberSources, titles, histories, rounds, roundNo, hardCheck, review,
        })
      }

      /* ----------- 评审（独立 AI，temp 0） ----------- */
      let items: TitleReviewItem[]
      if (firstResumeIndex <= 5) {
        stage('reviewer')
        const draftsForReview = titles.map((title, i) => `${i + 1}. ${title}`).join('\n')
        const hardCheckForReview = hardCheck.pass
          ? '全部通过。'
          : hardCheck.hits.map((h) => `第 ${h.segmentId ?? '?'} 条命中「${h.label}」：${h.detail}`).join('\n')
        try {
          items = await runner.runModel<TitleReviewItem[]>('reviewer', {
            system: REVIEWER_SYSTEM,
            userTemplate: REVIEWER_PROMPT,
            vars: { drafts: draftsForReview, hardCheck: hardCheckForReview },
            parse: (raw) => parseReviews(raw, titles.length, hardCheck),
            timeoutMs: budgets.reviewerMs,
            maxTokens: budgets.reviewerMaxTokens,
            retry: 1,
            round: roundNo,
            responseFormat: { type: 'json_object' },
          })
        } catch (e) {
          if (isAbortError(e)) throw e
          fallback.used = true
          await runner.failStage('reviewer', e)
          items = titles.map((_, i) => ({
            id: i + 1,
            ctr: 0,
            credibility: 0,
            issue: '评审步骤失败，本条暂无分数',
            improvement: '可重试生成以获得评审结果',
            mustFix: false,
          }))
          review = { items, rounds }
          await runner.setCheckpoint('reviewer', {
            requirement, formulas, evidence, allowedNumberSources, titles, histories, rounds, roundNo, hardCheck, review,
          })
          break
        }
      } else {
        items = review.items
      }

      if (firstResumeIndex < 6) {
        items.forEach((item, i) => {
          const score = computeCompositeScore(item.ctr, item.credibility)
          const history = histories[i]
          const last = history[history.length - 1]
          if (last) {
            last.ctr = item.ctr
            last.credibility = item.credibility
            last.score = score
            last.issue = item.issue
            last.improvement = item.improvement
          }
        })

        const summary = summarizeCandidates(
          items.map((item) => ({
            ctr: item.ctr,
            credibility: item.credibility,
            score: computeCompositeScore(item.ctr, item.credibility),
          })),
        )
        const roundRecord: TitleRound = {
          round: roundNo,
          averageScore: summary.averageScore,
          averageCtr: summary.averageCtr,
          averageCredibility: summary.averageCredibility,
          mustFixCount: items.filter((item) => item.mustFix).length,
          hardCheckPass: hardCheck.pass,
        }
        rounds.push(roundRecord)
        review = { items, rounds }
        await runner.setCheckpoint('reviewer', {
          requirement, formulas, evidence, allowedNumberSources, titles, histories, rounds, roundNo, hardCheck, review,
        })

        const previous = rounds[rounds.length - 2]
        const improvement = previous ? roundRecord.averageScore - previous.averageScore : Number.POSITIVE_INFINITY
        const stopByScore = roundRecord.averageScore >= TITLE_STOP.scoreThreshold
        const stopByPlateau = previous != null && improvement < TITLE_STOP.minImprovement
        const stopByRounds = roundNo >= MAX_ROUNDS
        const nothingToFix = roundRecord.mustFixCount === 0 && hardCheck.pass
        if (stopByScore || stopByPlateau || stopByRounds || nothingToFix) {
          await runner.skip('editor')
          await runner.setCheckpoint('editor', {
            requirement, formulas, evidence, allowedNumberSources, titles, histories, rounds, roundNo, hardCheck, review,
          })
          break
        }
      }

      /* ----------- 编辑（只改被点名的） ----------- */
      stage('editor')
      const targets = items.filter((item) => item.mustFix)
      const targetText = targets
        .map((item) => {
          const hitDetail = hardCheck.hits
            .filter((h) => h.segmentId === String(item.id))
            .map((h) => `${h.label}（${h.detail}）`)
            .join('、')
          const reason = [item.issue, hitDetail].filter(Boolean).join('；')
          return `第 ${item.id} 条：${titles[item.id - 1]}\n问题：${reason}\n方向：${item.improvement}`
        })
        .join('\n\n')

      const edited = await runner.runModel<Array<{ id: number; title: string }>>('editor', {
        system: EDITOR_SYSTEM,
        userTemplate: EDITOR_PROMPT,
        vars: {
          topic: requirement.theme,
          audience: requirement.audience,
          platform,
          maxChars,
          strength: effectiveTone,
          targets: targetText,
          evidence: evidence.join('\n') || '（无检索结果，请只使用用户提供的信息）',
          persona: personaBlock,
        },
        parse: (raw) => parseEditedTitles(raw, titles, maxChars),
        timeoutMs: budgets.stepMs,
        round: roundNo,
        responseFormat: { type: 'json_object' },
      })

      // 逐条合并：只有真的改了才记一条历史
      const editedById = new Map(edited.map((e) => [e.id, e.title]))
      const nextTitles = titles.map((title, i) => {
        const replacement = editedById.get(i + 1)
        if (!replacement || replacement === title) return title
        histories[i].push({ round: roundNo + 1, title: replacement, ctr: 0, credibility: 0, score: 0 })
        return replacement
      })

      const editorChanged = !nextTitles.every((title, index) => title === titles[index])
      titles = nextTitles
      if (editorChanged) roundNo += 1
      await runner.setCheckpoint('editor', {
        requirement, formulas, evidence, allowedNumberSources, titles, histories, rounds, roundNo, hardCheck, review,
      })
      if (!editorChanged) break
      firstResumeIndex = 4
    }

    if (resumeIndex >= 7 && (!titles.length || !review.items.length)) {
      throw new Error('该任务缺少选优步骤所需检查点，无法恢复。')
    }

    /* ---------------------- 8. 选优（纯算法） ---------------------- */
    stage('optimizer')
    const itemsByIndex = new Map(review.items.map((item) => [item.id, item]))
    const withScores = titles.map((title, i) => {
      const item = itemsByIndex.get(i + 1)
      const ctr = item?.ctr ?? 0
      const credibility = item?.credibility ?? 0
      return {
        id: i + 1,
        formulaName: formulas[i]?.formulaName ?? '通用句式',
        sourceTag: formulas[i]?.sourceTag ?? '—',
        title,
        charCount: title.length,
        maxCharCount: maxChars,
        ctr,
        credibility,
        score: computeCompositeScore(ctr, credibility),
        rounds: histories[i],
      }
    })

    const candidates = await runner.runAlgo<TitleCandidate[]>('optimizer', () =>
      rankAndRecommendCandidates(withScores),
    )

    await runner.markFallback(fallback.used)
    await runner.finish('done')

    return {
      input: spec,
      chatAttachments,
      requirement,
      formulas,
      evidence,
      candidates,
      hardCheck,
      review,
      run: runner.snapshot(),
      fallback: fallback.used,
      usedMock: clients.isMock,
    }
  } catch (e) {
    const aborted = isAbortError(e)
    await runner.finish(aborted ? 'cancelled' : 'failed')
    if (flowTimedOut) throw new Error('生成超时，请稍后重试或缩短输入。')
    throw e
  } finally {
    clearTimeout(flowTimer)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}

export type { TitleGeneratePayload, AgentRunSnapshot }
