/**
 * Agent 运行期预算：超时、重试、token 上限。
 *
 * 为什么要单独一层（2026-10-12 真实 API 复测后新增）：
 * 之前三条 flow 各自写死超时（autofill 3000ms / 单步 60000ms / 流程 90000ms），
 * 这些数字是按演示应答器（毫秒级返回）拍的，对真实模型完全不够：
 * 实测单次调用 2.7s–45.8s，视频脚本一次要 5 次调用 62s，直播 3 次 94s。
 * 结果就是「演示很顺、真机必超时」，而且失败被静默降级成兜底文案，看起来像成功。
 *
 * 现在按模式取不同预算：
 * - 演示模式：短预算。演示应答器是确定性的、毫秒级，短预算能让测试和页面都快，
 *   并且真的超时说明有 bug，应当暴露而不是拖。
 * - 远端模式：按实测延迟放宽，给出 ≥3 倍余量，让「慢」不至于变成「失败」。
 *
 * 这里是纯数据 + 纯函数，没有 IO，因此可以直接被单测覆盖。
 */

export type AgentBudgets = {
  /** 单步默认超时 */
  stepMs: number
  /** 整个流程超时（必须大于单步，否则单步还没跑完流程就断了） */
  flowMs: number
  /** 评审步骤超时：输出最长（要一次给多条结论），比普通步骤宽 */
  reviewerMs: number
  /** 预填步骤超时：短、可失败、失败即降级，不阻塞主流程 */
  autofillMs: number
  /** 默认额外重试次数 */
  retry: number
  /** 结构化步骤的 max_tokens（评审一次要吐多条 JSON，4096 会截断） */
  reviewerMaxTokens: number
  /** 单步 max_tokens 硬上限（截断后自适应加码用，避免无限放大） */
  maxTokensCap: number
}

/**
 * 演示模式：确定性应答器，毫秒级返回。预算小到「超时就说明真出问题了」。
 */
const DEMO_BUDGETS: AgentBudgets = {
  stepMs: 8_000,
  flowMs: 30_000,
  reviewerMs: 8_000,
  autofillMs: 4_000,
  retry: 1,
  reviewerMaxTokens: 4_096,
  maxTokensCap: 16_384,
}

/**
 * 远端模式：实测单次 2.7s–45.8s、整流程到 94s。
 * 单步给 150s、流程给 480s，是实测最坏值的 3 倍以上。
 * 宁可慢，也不要「超时 → 降级 → 假成功」。
 */
const REMOTE_BUDGETS: AgentBudgets = {
  stepMs: 150_000,
  flowMs: 480_000,
  reviewerMs: 180_000,
  // 实测预填 5.5s–8.2s，给 30s 是 3.6 倍余量；配合 1 次重试兜住瞬时 500
  autofillMs: 30_000,
  retry: 1,
  reviewerMaxTokens: 8_192,
  maxTokensCap: 16_384,
}

/** 按客户端模式取预算。演示模式用短预算，远端模式用宽预算。 */
export function resolveBudgets(isMock: boolean): AgentBudgets {
  return isMock ? DEMO_BUDGETS : REMOTE_BUDGETS
}

/**
 * 截断后自适应加码：第 n 次重试把 max_tokens 翻倍，但不超过上限。
 * 用来对付「模型输出被 max_tokens 砍掉 → JSON 不完整 → 解析失败」。
 */
export function retryMaxTokens(base: number, attempt: number, cap: number): number {
  if (attempt <= 0) return base
  return Math.min(cap, base * 2 ** attempt)
}
