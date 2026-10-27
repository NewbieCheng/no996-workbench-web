/**
 * Agent 运行期公共工具：取消、超时、重试。
 *
 * 原先 sleep / delay 在 mock-adapters.ts 与 titles-agent-loop.ts 各有一份，
 * throwIfAborted 只有 persona 有，超时与重试全库都没有。统一在此。
 */

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

/**
 * 取出错误自带的 HTTP 状态码。
 *
 * 传输层抛出的错误保留 axios 形状（`{ response: { status } }`），
 * 这里两种形状都认，缺失时返回 undefined。
 */
export function httpStatusOf(e: unknown): number | undefined {
  const direct = (e as { status?: unknown })?.status
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct
  const nested = (e as { response?: { status?: unknown } })?.response?.status
  if (typeof nested === 'number' && Number.isFinite(nested)) return nested
  return undefined
}

/**
 * 是否值得重试。
 *
 * 真实 API 复测（2026-10-12）的结论：
 * - 5xx / 网络层失败是**瞬时**的，重试有意义（实测空响应体 500 有 37.5% 命中率）。
 * - 4xx 是**确定性**拒绝（400 参数错、401 未认证、402 余额不足），
 *   重试只会白等一轮、白扣一次积分，必须直接失败。
 * - 截断（max_tokens 用满）重试有意义，但必须配合加码 max_tokens，否则必然重复截断。
 * - 取消（AbortError）永不重试。
 */
export function isRetryableError(e: unknown): boolean {
  if (isAbortError(e)) return false
  const status = httpStatusOf(e)
  if (status === undefined) return true // 网络层错误，多半是瞬时
  if (status === 408 || status === 429) return true
  if (status >= 500) return true
  return false
}

/**
 * 把任意异常转成可读文案（不改写已是 Error 的 message）
 */
export function errorMessage(e: unknown, fallback = '执行失败，请稍后重试。'): string {
  if (e instanceof Error && e.message.trim()) return e.message
  if (typeof e === 'string' && e.trim()) return e
  return fallback
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * 超时包装。传入 outer signal 时两者取先到者；超时抛出的错误文案面向用户，
 * 调用方 signal 触发的取消仍以 AbortError 抛出（不重试）。
 */
export async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs?: number,
  outer?: AbortSignal,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return run(outer ?? new AbortController().signal)
  }
  const ac = new AbortController()
  let timedOut = false
  const onOuterAbort = () => ac.abort()
  if (outer) {
    if (outer.aborted) ac.abort()
    else outer.addEventListener('abort', onOuterAbort, { once: true })
  }
  const timer = setTimeout(() => {
    timedOut = true
    ac.abort()
  }, timeoutMs)
  try {
    return await run(ac.signal)
  } catch (e) {
    if (timedOut && !outer?.aborted) {
      throw new Error(`步骤超时（${Math.round(timeoutMs / 1000)} 秒），已中断本次调用。`)
    }
    throw e
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', onOuterAbort)
  }
}

export type StreamingStepTimeoutOptions = {
  /** 连续无流式增量的最长等待（毫秒） */
  idleMs: number
  /** 整步墙钟上限；有 chunk 时 idle 会续期，但仍不超过此值 */
  maxMs?: number
}

/**
 * 流式模型步骤超时：有增量则续期 idle 计时，仅在长时间无 chunk 或超过 maxMs 时中断。
 */
export async function withStreamingStepTimeout<T>(
  run: (signal: AbortSignal, onActivity: () => void) => Promise<T>,
  options: StreamingStepTimeoutOptions,
  outer?: AbortSignal,
): Promise<T> {
  const idleMs = options.idleMs
  if (!idleMs || idleMs <= 0) {
    return run(outer ?? new AbortController().signal, () => {})
  }

  const ac = new AbortController()
  let timedOutIdle = false
  let timedOutMax = false
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let maxTimer: ReturnType<typeof setTimeout> | null = null

  const onOuterAbort = () => ac.abort()
  if (outer) {
    if (outer.aborted) ac.abort()
    else outer.addEventListener('abort', onOuterAbort, { once: true })
  }

  const bumpActivity = () => {
    if (ac.signal.aborted) return
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      timedOutIdle = true
      ac.abort()
    }, idleMs)
  }

  bumpActivity()

  if (options.maxMs && options.maxMs > 0) {
    maxTimer = setTimeout(() => {
      timedOutMax = true
      ac.abort()
    }, options.maxMs)
  }

  try {
    return await run(ac.signal, bumpActivity)
  } catch (e) {
    if (!outer?.aborted) {
      if (timedOutIdle) {
        throw new Error(`步骤超时（${Math.round(idleMs / 1000)} 秒无新输出），已中断本次调用。`)
      }
      if (timedOutMax && options.maxMs) {
        throw new Error(`步骤超时（${Math.round(options.maxMs / 1000)} 秒），已中断本次调用。`)
      }
    }
    throw e
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
    if (maxTimer) clearTimeout(maxTimer)
    outer?.removeEventListener('abort', onOuterAbort)
  }
}

/**
 * 重试包装。retry = 额外重试次数（默认 1，即最多尝试 2 次）。
 * 取消永不重试；默认策略由 shouldRetry 决定（见 isRetryableError）。
 * 每次重试前回调 onRetry，便于调用方重置流式缓冲、抬高 max_tokens 等。
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  retry = 1,
  signal?: AbortSignal,
  shouldRetry: (e: unknown, attempt: number) => boolean = isRetryableError,
  onRetry?: (e: unknown, attempt: number) => void | Promise<void>,
): Promise<T> {
  let last: unknown
  const maxAttempt = Math.max(0, retry)
  for (let attempt = 0; attempt <= maxAttempt; attempt += 1) {
    throwIfAborted(signal)
    try {
      return await fn(attempt)
    } catch (e) {
      if (isAbortError(e)) throw e
      last = e
      if (attempt >= maxAttempt || !shouldRetry(e, attempt)) throw e
      // 重试前通知调用方（清缓冲、加码上限），再退避
      if (onRetry) await onRetry(e, attempt)
      await sleep(400 * (attempt + 1), signal)
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

/** 逐字符/分块顺序吐出文本，用于演示模式的打字动效 */
export async function streamChunks(
  text: string,
  onDelta: ((chunk: string) => void) | undefined,
  signal?: AbortSignal,
  chunkChars = 0,
  paceMs = 40,
): Promise<void> {
  if (!onDelta) return
  const size = chunkChars > 0 ? chunkChars : Math.max(24, Math.ceil(text.length / 18))
  for (let i = 0; i < text.length; i += size) {
    throwIfAborted(signal)
    onDelta(text.slice(i, i + size))
    await sleep(paceMs, signal)
  }
}
