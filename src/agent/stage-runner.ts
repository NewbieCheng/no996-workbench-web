/**
 * StageRunner：内核的编排执行器。
 *
 * 一次调用即完成：标记 running → 记录代入变量后的实际提示词 → 带超时/重试调用
 * → 解析 → 记录输出 → 标记 done；失败时标记 failed 并保留可读错误。
 *
 * 由此「折叠区要的实际提示词 + 每步输出」成为免费副产品，各页不必自己拼；
 * 轮次（round）内建支持，进度天然可显示「第 N 轮」。
 *
 * 本文件不含任何业务语义，也不 import src/features。
 */
import {
  isAbortError,
  isRetryableError,
  throwIfAborted,
  withRetry,
  withStreamingStepTimeout,
  withTimeout,
  errorMessage,
} from './runtime'
import { renderTemplate, stripVarMarks, type TemplateVars } from './prompt'
import { parseStrictJson } from './parse'
import { resolveBudgets, retryMaxTokens, type AgentBudgets } from './budgets'
import { resolveProfile } from './models'
import type {
  AgentChatRequest,
  AgentClients,
  AgentRunSnapshot,
  AgentSearchAttempt,
  AgentSearchResult,
  AgentSink,
  AgentStageDef,
  AgentStageState,
  ModelProfileId,
} from './types'

export type StageRunnerInput = {
  flowId: string
  stages: AgentStageDef[]
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  /**
   * 背景上下文（人设 + 定位卡片）：**一次传入，本流程所有模型步骤自动带上**。
   *
   * 放在 runner 上而不是每步传参，是因为「漏传某一步」几乎必然发生：
   * 真机上表现为「评审员突然不知道我是谁」，很难查。统一注入后不可能漏。
   */
  /** 可选的持久化检查点与重试起点；保留起点之前的已完成阶段。 */
  resume?: { fromStageId: string; snapshot: AgentRunSnapshot }
  background?: string
}

export type RunModelRequest<T> = {
  /** 模板提示词；配合 vars 生成 actualPrompt（含 «» 高亮） */
  userTemplate?: string
  vars?: TemplateVars
  /** 直接给最终 user 文本（与 userTemplate 二选一） */
  user?: string
  system?: string
  profile?: ModelProfileId
  tools?: Array<{ name: string; description: string }>
  /** 不传则直接返回正文文本 */
  parse?: (raw: string) => T
  onDelta?: (chunk: string) => void
  retry?: number
  timeoutMs?: number
  /** 覆盖 max_tokens（默认为 profile 的值） */
  maxTokens?: number
  /** 要求上游返回严格 JSON（结构化步骤强烈建议开启） */
  responseFormat?: { type: 'json_object' | 'text' }
  /** 覆盖背景上下文（默认用 runner 级的） */
  background?: string
  /** 覆盖默认轮次（外层收敛环用） */
  round?: number
  /** 多模态附件：合并进本条 user 消息（见 clients.applyChatAttachments） */
  chatAttachments?: AgentChatRequest['chatAttachments']
}

export type RunModelWithToolsRequest<T> = {
  messages: AgentChatRequest['messages']
  tools?: Array<{ name: string; description: string }>
  profile?: ModelProfileId
  /** 不传则返回正文文本 */
  parse?: (raw: string) => T
  onDelta?: (chunk: string) => void
  retry?: number
  timeoutMs?: number
  /** 检索轮次上限，默认 6 */
  maxTurns?: number
  /** 要求上游返回严格 JSON */
  responseFormat?: { type: 'json_object' | 'text' }
  background?: string
  round?: number
  chatAttachments?: AgentChatRequest['chatAttachments']
}

/**
 * 截断错误：上游 `finish_reason=length`，正文被 max_tokens 砍断。
 * 与普通解析失败区分开，重试时才会去抬 max_tokens。
 */
class TruncatedOutputError extends Error {
  constructor() {
    super('模型输出被长度上限截断。')
  }
}

export class StageRunner {
  private readonly defs: Map<string, AgentStageDef>
  private readonly stages: AgentStageState[]
  private readonly checkpoints = new Map<string, unknown>()
  private readonly clients: AgentClients
  private readonly sink?: AgentSink
  private readonly signal?: AbortSignal
  private readonly flowId: string
  private readonly background?: string
  /** 超时/重试/token 预算：按演示或远端取不同档（见 budgets.ts）。flow 也据此排布自己的节奏。 */
  readonly budgets: AgentBudgets
  private round = 1
  private status: AgentRunSnapshot['status'] = 'idle'
  private error: string | undefined
  private fallback = false
  private streamEmitPending = false
  private streamEmitScheduled = false

  constructor(input: StageRunnerInput) {
    this.flowId = input.flowId
    this.clients = input.clients
    this.sink = input.sink
    this.signal = input.signal
    this.background = input.background
    this.budgets = resolveBudgets(input.clients.isMock)
    this.defs = new Map(input.stages.map((s) => [s.id, s]))
    const resumeIndex = input.resume
      ? input.stages.findIndex((stage) => stage.id === input.resume?.fromStageId)
      : -1
    if (input.resume && (input.resume.snapshot.flowId !== input.flowId || resumeIndex < 0)) {
      throw new Error('无法恢复该工作流检查点。')
    }

    const priorStates = new Map(input.resume?.snapshot.stages.map((state) => [state.id, state]) ?? [])
    this.stages = input.stages.map((stage, index) => {
      if (!input.resume || index >= resumeIndex) return { id: stage.id, status: 'idle' as const }
      const prior = priorStates.get(stage.id)
      if (
        !prior ||
        (prior.status !== 'done' && prior.status !== 'skipped' &&
          !(prior.status === 'failed' && input.resume?.snapshot.checkpoints?.[stage.id] !== undefined))
      ) {
        throw new Error(`上游步骤「${stage.roleName}」未完成，不能从后续步骤恢复。`)
      }
      return { ...prior }
    })

    if (input.resume) {
      this.round = input.resume.snapshot.round
      this.status = 'running'
      this.fallback = Boolean(input.resume.snapshot.fallback)
      input.stages.slice(0, resumeIndex).forEach((stage) => {
        const checkpoint = input.resume?.snapshot.checkpoints?.[stage.id]
        if (checkpoint !== undefined) this.checkpoints.set(stage.id, checkpoint)
      })
    }
  }

  /* ------------------------------ 内部工具 ------------------------------ */

  private def(stageId: string): AgentStageDef {
    const found = this.defs.get(stageId)
    if (!found) throw new Error(`未声明的阶段：${stageId}`)
    return found
  }

  private state(stageId: string): AgentStageState {
    const found = this.stages.find((s) => s.id === stageId)
    if (!found) throw new Error(`未声明的阶段：${stageId}`)
    return found
  }

  private async emit(): Promise<void> {
    if (!this.sink) return
    await this.sink.publish(this.snapshot())
  }

  /** 流式增量写进步骤态后节流发布，供流程大图侧栏实时刷新 */
  private scheduleStreamEmit(immediate = false): void {
    if (!this.sink) return
    if (immediate && !this.streamEmitScheduled) {
      void this.emit()
    }
    if (this.streamEmitPending) return
    this.streamEmitPending = true
    this.streamEmitScheduled = true
    setTimeout(() => {
      this.streamEmitPending = false
      void this.emit()
    }, 80)
  }

  private createStreamHandler(
    stageId: string,
    forward?: (chunk: string) => void,
    onActivity?: () => void,
  ): (chunk: string) => void {
    let first = true
    return (chunk) => {
      const state = this.state(stageId)
      state.streamingContent = `${state.streamingContent ?? ''}${chunk}`
      forward?.(chunk)
      onActivity?.()
      this.scheduleStreamEmit(first)
      first = false
    }
  }

  private createReasoningStreamHandler(
    stageId: string,
    forward?: (chunk: string) => void,
    onActivity?: () => void,
  ): (chunk: string) => void {
    let first = true
    return (chunk) => {
      const state = this.state(stageId)
      state.streamingReasoningContent = `${state.streamingReasoningContent ?? ''}${chunk}`
      forward?.(chunk)
      onActivity?.()
      this.scheduleStreamEmit(first)
      first = false
    }
  }

  private async setStatus(stageId: string, patch: Partial<AgentStageState>): Promise<void> {
    Object.assign(this.state(stageId), patch)
    await this.emit()
  }

  private async guard<T>(stageId: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (e) {
      if (isAbortError(e)) {
        this.status = 'cancelled'
        await this.setStatus(stageId, { status: 'skipped', finishedAt: Date.now() })
        throw e
      }
      const message = errorMessage(e)
      this.error = message
      this.status = 'failed'
      await this.setStatus(stageId, { status: 'failed', error: message, finishedAt: Date.now() })
      throw e
    }
  }

  /* ------------------------------- 公开 API ------------------------------- */

  setRound(round: number): void {
    this.round = round
  }

  markRunning(): void {
    this.status = 'running'
  }

  /** 保存业务层可序列化的恢复上下文，随阶段快照写入本机任务载荷。 */
  async setCheckpoint(stageId: string, checkpoint: unknown): Promise<void> {
    this.def(stageId)
    const serialized = JSON.stringify(checkpoint)
    if (serialized === undefined) throw new Error(`步骤「${stageId}」的检查点必须可序列化。`)
    this.checkpoints.set(stageId, JSON.parse(serialized) as unknown)
    await this.emit()
  }

  /** 模型步骤：完整的 记录提示词 → 调用 → 解析 → 记输出 流程 */
  async runModel<T = string>(stageId: string, req: RunModelRequest<T>): Promise<T> {
    const def = this.def(stageId)
    const userPrompt = req.user ?? renderTemplate(req.userTemplate ?? '', req.vars ?? {}, { mark: true })
    const profile = resolveProfile(req.profile ?? def.profile)
    const baseMaxTokens = req.maxTokens ?? profile.maxTokens
    const background = req.background ?? this.background

    return this.guard(stageId, async () => {
      this.status = 'running'
      await this.setStatus(stageId, {
        status: 'running',
        round: req.round ?? this.round,
        headline: def.headline,
        actualPrompt: `${req.system ? `${stripVarMarks(req.system)}\n\n` : ''}${stripVarMarks(userPrompt)}`,
        output: undefined,
        error: undefined,
        streamingContent: this.sink || req.onDelta ? '' : undefined,
        streamingReasoningContent: this.sink ? '' : undefined,
        reasoningHistory: undefined,
        startedAt: Date.now(),
      })

      const streamToSink = Boolean(this.sink || req.onDelta)
      this.streamEmitScheduled = false
      const stepMaxMs = req.timeoutMs ?? this.budgets.stepMs
      const streamIdleMs = Math.min(120_000, stepMaxMs)

      const runAttempt = (innerSignal: AbortSignal, onStreamActivity?: () => void) =>
        withRetry(
          async (attempt) => {
            // 每次尝试都清空流式缓冲：否则重试会把同一段正文叠加两遍给用户看
            if (streamToSink) {
              const st = this.state(stageId)
              st.streamingContent = ''
              st.streamingReasoningContent = ''
            }

            const result = await this.clients.chat.complete({
              messages: [
                ...(req.system ? [{ role: 'system' as const, content: req.system }] : []),
                { role: 'user' as const, content: stripVarMarks(userPrompt) },
              ],
              background,
              chatAttachments: req.chatAttachments,
              tools: req.tools,
              profile: req.profile ?? def.profile,
              maxTokens: retryMaxTokens(baseMaxTokens, attempt, this.budgets.maxTokensCap),
              responseFormat: req.responseFormat,
              signal: innerSignal ?? this.signal,
              stageHint: stageId,
              onDelta: streamToSink
                ? this.createStreamHandler(stageId, req.onDelta, onStreamActivity)
                : undefined,
              onReasoningDelta: streamToSink
                ? this.createReasoningStreamHandler(stageId, undefined, onStreamActivity)
                : undefined,
            })

            const raw = result.content ?? ''
            // 截断判定优先于「空响应」：被砍断的 JSON 也非空，但绝不能用。
            // 抛专门的错误类型，重试时才会去抬 max_tokens。
            if (result.finishReason === 'length') throw new TruncatedOutputError()
            if (!raw.trim()) throw new Error('模型未返回内容，请重试。')

            // 解析放在重试闭包**内部**：解析失败（截断/多吐格式）才是真机上最常见的失败，
            // 之前解析在重试之外，一次解析失败就直接终局降级。
            return req.parse ? req.parse(raw) : parseStrictJson<T>(raw, '模型返回')
          },
          req.retry ?? this.budgets.retry,
          innerSignal,
          (e) => (e instanceof TruncatedOutputError ? true : isRetryableError(e)),
        )

      const parsed = streamToSink
        ? await withStreamingStepTimeout(
            (innerSignal, onActivity) => runAttempt(innerSignal, onActivity),
            { idleMs: streamIdleMs, maxMs: stepMaxMs },
            this.signal,
          )
        : await withTimeout((innerSignal) => runAttempt(innerSignal), stepMaxMs, this.signal)

      throwIfAborted(this.signal)
      await this.setStatus(stageId, {
        status: 'done',
        output: parsed,
        round: req.round ?? this.round,
        finishedAt: Date.now(),
      })
      return parsed
    })
  }

  /** 单次联网搜索并记录查询目的、关键词与状态；搜索失败作为结果返回，调用方可继续降级。 */
  async runSearch(stageId: string, query: string, purpose?: string): Promise<AgentSearchResult> {
    const state = this.state(stageId)
    const startedAt = Date.now()
    const attempt: AgentSearchAttempt = {
      query: query.trim(),
      purpose: purpose?.trim() || undefined,
      status: 'running',
      startedAt,
    }
    const attempts = [...(state.searchAttempts ?? []), attempt]
    const attemptIndex = attempts.length - 1
    await this.setStatus(stageId, { searchAttempts: attempts })

    let result: AgentSearchResult
    try {
      if (!attempt.query) {
        result = {
          query: '',
          snippets: [],
          status: 'rejected',
          error: '没有有效检索词，请根据用户资料补充具体关键词。',
        }
      } else if (!this.clients.search) {
        result = {
          query: attempt.query,
          snippets: [],
          status: 'failed',
          error: '当前没有可用的联网搜索服务。',
        }
      } else {
        result = await this.clients.search.search(attempt.query, this.signal)
        if (
          !result.status &&
          !result.content?.trim() &&
          result.snippets.length === 0
        ) {
          result = {
            ...result,
            status: 'succeeded',
            content:
              '本次联网检索未返回可用网页摘要；后续将主要依据您已填写的资料与模型常识继续，不会把未检索到的内容说成已核实事实。',
          }
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        attempts[attemptIndex] = { ...attempt, status: 'cancelled', finishedAt: Date.now() }
        await this.setStatus(stageId, { searchAttempts: [...attempts] })
        throw error
      }
      result = {
        query: attempt.query,
        snippets: [],
        status: 'failed',
        error: errorMessage(error, '联网搜索失败'),
      }
    }

    const status: AgentSearchAttempt['status'] = result.status ?? 'succeeded'
    attempts[attemptIndex] = {
      ...attempt,
      status,
      error: result.error,
      resultCount: result.snippets.length,
      finishedAt: Date.now(),
    }
    await this.setStatus(stageId, { searchAttempts: [...attempts] })
    return result
  }

  /**
   * 带工具的多轮模型步骤：模型可反复请求检索，直到给出最终答案。
   *
   * 编排细节由内核负责（消息回灌、工具结果拼装、轮次上限），
   * 业务侧只需提供初始消息、工具声明与检索实现。
   */
  async runModelWithTools<T>(stageId: string, req: RunModelWithToolsRequest<T>): Promise<T> {
    const def = this.def(stageId)
    const toolSpecs = req.tools ?? []
    return this.guard(stageId, async () => {
      this.status = 'running'
      const messages: AgentChatRequest['messages'] = [...req.messages]
      const maxTurns = req.maxTurns ?? 6
      let turns = 0
      let reasoningHistory: Array<{ turn: number; text: string }> = []

      const promptPreview = messages
        .map((m) => {
          if (m.role === 'tool') return m.content
          const content = m.content
          if (typeof content === 'string') return stripVarMarks(content)
          return content
            .map((part) => (part.type === 'text' ? stripVarMarks(part.text) : '[image]'))
            .join('\n')
        })
        .join('\n\n---\n\n')
      await this.setStatus(stageId, {
        status: 'running',
        round: req.round ?? this.round,
        headline: def.headline,
        actualPrompt: promptPreview,
        output: undefined,
        error: undefined,
        streamingContent: this.sink || req.onDelta ? '' : undefined,
        streamingReasoningContent: this.sink ? '' : undefined,
        reasoningHistory: [],
        startedAt: Date.now(),
      })

      const streamToSink = Boolean(this.sink || req.onDelta)
      this.streamEmitScheduled = false
      let raw = ''
      let toolsEnabled = toolSpecs.length > 0
      let rejectedSearchCount = 0
      for (;;) {
        turns += 1
        throwIfAborted(this.signal)
        if (turns > maxTurns) throw new Error('检索轮次超限，请简化资料后重试。')

        const parsedTurn = await withTimeout(
          (innerSignal) =>
            withRetry(
              async (attempt) => {
                if (streamToSink) {
                  const st = this.state(stageId)
                  st.streamingContent = ''
                  st.streamingReasoningContent = ''
                }
                const result = await this.clients.chat.complete({
                  messages,
                  background: req.background ?? this.background,
                  chatAttachments: req.chatAttachments,
                  tools: toolsEnabled ? toolSpecs : undefined,
                  profile: req.profile ?? def.profile,
                  maxTokens: retryMaxTokens(
                    resolveProfile(req.profile ?? def.profile).maxTokens,
                    attempt,
                    this.budgets.maxTokensCap,
                  ),
                  responseFormat: req.responseFormat,
                  signal: innerSignal ?? this.signal,
                  stageHint: stageId,
                  onDelta: streamToSink
                    ? this.createStreamHandler(stageId, req.onDelta)
                    : undefined,
                  onReasoningDelta: streamToSink
                    ? this.createReasoningStreamHandler(stageId)
                    : undefined,
                })
                const text = result.content ?? ''
                if (result.finishReason === 'length' && !result.toolCalls?.length) {
                  throw new TruncatedOutputError()
                }
                if (!result.toolCalls?.length && !text.trim()) {
                  throw new Error('模型未返回内容，请重试。')
                }
                return { result, text }
              },
              req.retry ?? this.budgets.retry,
              innerSignal,
              (e) => (e instanceof TruncatedOutputError ? true : isRetryableError(e)),
            ),
          req.timeoutMs ?? this.budgets.stepMs,
          this.signal,
        )

        const result = parsedTurn.result
        if (result.toolCalls?.length) {
          const stageState = this.state(stageId)
          const reasoningText = stageState.streamingReasoningContent?.trim()
          if (reasoningText) {
            reasoningHistory = [...reasoningHistory, { turn: turns, text: reasoningText }]
            stageState.reasoningHistory = reasoningHistory
            stageState.streamingReasoningContent = ''
            await this.emit()
          }
          messages.push({ role: 'assistant', content: result.content || '' })
          for (const call of result.toolCalls) {
            throwIfAborted(this.signal)
            if (!toolsEnabled) {
              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: '联网搜索已关闭，请不要继续请求搜索，直接根据用户资料与已有知识继续。',
              })
              continue
            }
            const query = String(call.arguments?.query ?? '').trim()
            const purpose = String(call.arguments?.purpose ?? '').trim()
            const search = await this.runSearch(stageId, query, purpose)
            if (search.status === 'failed') toolsEnabled = false
            if (search.status === 'rejected') {
              rejectedSearchCount += 1
              if (rejectedSearchCount >= 2) toolsEnabled = false
            }
            const context = [
              purpose ? `检索目的：${purpose}` : '',
              query ? `检索关键词：${query}` : '',
            ].filter(Boolean).join('\n')
            const body = search.status === 'failed'
              ? [
                  context,
                  `联网搜索失败：${search.error ?? '服务暂不可用'}。已停止后续联网搜索，请仅依据用户资料与已有知识继续；缺少依据时如实说明。`,
                ].filter(Boolean).join('\n\n')
              : [
                  context,
                  search.content?.trim(),
                  ...search.snippets.map((s, i) =>
                    [`${i + 1}. ${s.title}`, s.snippet, s.url].filter(Boolean).join('\n'),
                  ),
                  search.status === 'rejected'
                    ? `检索未执行：${search.error ?? '检索词无效'}。请改用用户资料中的具体行业、业务、客群或问题关键词。`
                    : '',
                ]
                  .filter(Boolean)
                  .join('\n\n')
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: body || '（无检索结果；请根据现有资料继续）',
            })
          }
          continue
        }

        raw = parsedTurn.text
        break
      }

      if (!raw.trim()) throw new Error('模型未返回内容，请重试。')
      const parsed = req.parse ? req.parse(raw) : (raw as unknown as T)
      await this.setStatus(stageId, {
        status: 'done',
        output: parsed,
        round: req.round ?? this.round,
        finishedAt: Date.now(),
      })
      return parsed
    })
  }

  /** 工具步骤（检索类） */
  async runTool<T>(stageId: string, fn: () => Promise<T>): Promise<T> {
    const def = this.def(stageId)
    return this.guard(stageId, async () => {
      await this.setStatus(stageId, {
        status: 'running',
        round: this.round,
        headline: def.headline,
        startedAt: Date.now(),
      })
      const out = await fn()
      await this.setStatus(stageId, { status: 'done', output: out, finishedAt: Date.now() })
      return out
    })
  }

  /** 纯算法步骤：同步执行，标签必须诚实（UI 按 kind 渲染） */
  async runAlgo<T>(stageId: string, fn: () => T): Promise<T> {
    const def = this.def(stageId)
    return this.guard(stageId, async () => {
      await this.setStatus(stageId, {
        status: 'running',
        round: this.round,
        headline: def.headline,
        startedAt: Date.now(),
      })
      const out = fn()
      await this.setStatus(stageId, { status: 'done', output: out, finishedAt: Date.now() })
      return out
    })
  }

  /**
   * 标记跳过（例如未走到该步，或收敛提前结束）。
   *
   * 必须**清掉上一轮同一步留下的状态**：外层是收敛环，同一 stageId 会在每一轮被重跑。
   * 只改 status 的话，快照会留下「已跳过，却耗时 49.9s、还带着上一轮的提示词」这种
   * 自相矛盾的记录（真机复测实测到过）。跳过 = 这一步没跑，所以计时与提示词都应为空。
   */
  async skip(stageId: string): Promise<void> {
    await this.setStatus(stageId, {
      status: 'skipped',
      round: this.round,
      startedAt: undefined,
      finishedAt: undefined,
      actualPrompt: undefined,
      output: undefined,
      error: undefined,
      streamingContent: undefined,
      streamingReasoningContent: undefined,
      reasoningHistory: undefined,
    })
  }

  /** 把业务侧捕获的异常写进步骤态（用于降级分支） */
  async failStage(stageId: string, e: unknown): Promise<void> {
    this.error = errorMessage(e)
    await this.setStatus(stageId, {
      status: 'failed',
      error: this.error,
      finishedAt: Date.now(),
    })
  }

  markFallback(usedFallback: boolean): void {
    this.fallback = usedFallback
  }

  /**
   * 收尾。**调用方必须调用它**，它负责保证快照本身自洽。
   *
   * 自动把仍未触达的步骤标成 `skipped`：收敛环提前 `break` 时，后面的步骤（典型是
   * 「编辑」）根本没被执行到，但也不该永远停在 `idle`。`idle` 对用户意味着「还在排队」，
   * 而流程其实已经结束了 —— 真机复测里标题页就出现过「流程已 done，编辑仍显示待执行」。
   *
   * 放在这里而不是让每个 flow 自己记得调 `skip()`：漏调是静默的（只是状态不好看），
   * 三个 flow 里已经有一个漏了。内核统一兜住就不会再漏。
   */
  async finish(status: AgentRunSnapshot['status'] = 'done'): Promise<void> {
    this.status = status
    for (const stage of this.stages) {
      if (stage.status === 'idle') {
        Object.assign(stage, {
          status: 'skipped',
          round: this.round,
          startedAt: undefined,
          finishedAt: undefined,
          actualPrompt: undefined,
          output: undefined,
          error: undefined,
          streamingContent: undefined,
          streamingReasoningContent: undefined,
          reasoningHistory: undefined,
        })
      }
    }
    await this.emit()
  }

  snapshot(): AgentRunSnapshot {
    return {
      flowId: this.flowId,
      stages: this.stages.map((s) => ({ ...s })),
      round: this.round,
      status: this.status,
      checkpoints: Object.fromEntries(this.checkpoints),
      error: this.error,
      fallback: this.fallback,
    }
  }
}

/** 便捷构造 */
export function createStageRunner(input: StageRunnerInput): StageRunner {
  return new StageRunner(input)
}
