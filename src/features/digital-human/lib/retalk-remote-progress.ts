import type { RetalkStatus, RetalkTask } from '../../../api/video-retalk'

/** 展示用等待时间相对上游估计值的倍率（产品口径：预计时间 ×5） */
export const RETALK_ESTIMATED_WAIT_MULTIPLIER = 5

const STATUS_FLOORS: Partial<Record<RetalkStatus, number>> = {
  QUEUED: 6.0,
  SUBMITTED: 18.0,
  RUNNING: 45.0,
  SUCCEEDED: 100.0,
}

function readUpstreamProgressPercent(remote: RetalkTask): number | undefined {
  const raw = remote.progress ?? remote.progress_percent
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  return Math.min(100, Math.max(0, Math.round(raw * 10) / 10))
}

export function retalkFallbackEstimatedSeconds(audioDurationSec: number): number {
  const durationSec = audioDurationSec > 0 ? audioDurationSec : 15
  return Math.max(75, Math.round((15 + durationSec * 1.5) * RETALK_ESTIMATED_WAIT_MULTIPLIER))
}

export function retalkEstimatedTotalSeconds(
  remote: RetalkTask | null | undefined,
  audioDurationSec?: number,
): number {
  const upstream = remote?.estimated_wait_seconds
  if (typeof upstream === 'number' && Number.isFinite(upstream) && upstream > 0) {
    return Math.max(10, Math.round(upstream * RETALK_ESTIMATED_WAIT_MULTIPLIER))
  }
  return retalkFallbackEstimatedSeconds(audioDurationSec ?? 15)
}

/**
 * 计算平滑且持续微增的进度百分比（带一位小数，如 58.4%）
 * 核心策略：
 * 1. 终态 SUCCEEDED 立即拉满 100.0%；
 * 2. 上游若给真实 progress 优先遵从；
 * 3. 否则根据阶段基准起步（QUEUED: 6%+, SUBMITTED: 18%+, RUNNING: 45%+）；
 * 4. 在 RUNNING 阶段，前半程线性递进，后半程及超时段采用渐近蠕动曲线（Asymptotic Ease-Out），
 *    保证数字持续微幅上涨（每秒都有小数位在动），最高渐近逼近 99.2%，消除卡死焦虑。
 */
export function retalkProgressPercent(
  remote: RetalkTask | null | undefined,
  elapsedSec: number,
  estimatedTotalSec: number,
): number {
  // 一旦轮询到上游完成或拿到成品视频直链，立即 100.0% 满格交付
  if (remote?.status === 'SUCCEEDED' || Boolean(remote?.video_url)) {
    return 100.0
  }

  const fromUpstream = remote ? readUpstreamProgressPercent(remote) : undefined
  if (fromUpstream !== undefined) return fromUpstream

  const status = remote?.status

  const safeTotal = Math.max(10, estimatedTotalSec)
  const safeElapsed = Math.max(0, elapsedSec)

  if (status === 'QUEUED') {
    // 排队阶段：起步 6.0%，随排队耗时每秒微增 0.05%，封顶 16.5%
    const crawled = 6.0 + safeElapsed * 0.05
    return Math.min(16.5, Math.round(crawled * 10) / 10)
  }

  if (status === 'SUBMITTED') {
    // 提交启动阶段：起步 18.0%，向 42.0% 渐进
    const ratio = Math.min(1, safeElapsed / (safeTotal * 0.25 || 15))
    const val = 18.0 + ratio * 24.0
    return Math.min(42.0, Math.round(val * 10) / 10)
  }

  if (status === 'RUNNING') {
    const floor = STATUS_FLOORS.RUNNING! // 45.0
    // 在预计时长前半程（0 ~ 80%），快速线性/平滑推进到 86.0%
    if (safeElapsed <= safeTotal * 0.8) {
      const normalRatio = safeElapsed / (safeTotal * 0.8)
      const val = floor + normalRatio * (86.0 - floor)
      return Math.min(86.0, Math.max(floor, Math.round(val * 10) / 10))
    }

    // 后半程（80% ~ 100% 预计时长）及超时阶段：采用渐近线对数衰减算法，
    // 无论等多久，数字永远保持微小增幅（0.02% ~ 0.08% / 秒），最高触及 99.2%，绝不卡死
    const overdueSec = safeElapsed - safeTotal * 0.8
    const asymptotic = 86.0 + (1 - Math.exp(-overdueSec / (safeTotal * 0.4))) * 12.0
    // 加上极细微的无尽时间蠕动，确保显示持续在涨
    const endlessCreep = Math.min(1.2, overdueSec * 0.015)
    const combined = Math.min(99.2, Math.max(86.1, asymptotic + endlessCreep))
    return Math.round(combined * 10) / 10
  }

  // 无状态兜底
  const ratio = Math.min(1, safeElapsed / safeTotal)
  const fallbackVal = 10.0 + ratio * 85.0
  return Math.min(96.0, Math.max(10.0, Math.round(fallbackVal * 10) / 10))
}

/** 格式化数字进度为 1 位小数的显示字符串 */
export function formatRetalkProgress(percent: number): string {
  if (percent >= 100) return '100'
  return percent.toFixed(1)
}

export function retalkStageCopy(status?: RetalkStatus | string): { title: string; desc: string } {
  switch (status) {
    case 'SUCCEEDED':
    case 'succeeded':
      return {
        title: '口型合成已就绪',
        desc: '画面渲染与编码完成，正在装载成片预览',
      }
    case 'QUEUED':
      return {
        title: '排队等待云端算力',
        desc: '任务已进入队列，将按排队顺序调度 GPU 资源',
      }
    case 'SUBMITTED':
      return {
        title: '任务已提交，正在启动',
        desc: '云端正在拉起推理实例并校验音画素材',
      }
    case 'RUNNING':
      return {
        title: '高保真画面逐帧重绘中',
        desc: '口型边缘光影融合与超分编码生成',
      }
    default:
      return {
        title: '云端合成处理中',
        desc: '正在同步远端任务状态，请稍候',
      }
  }
}

export function retalkQueueHint(remote: RetalkTask | null | undefined): string | null {
  if (remote?.status !== 'QUEUED' || remote.queue_position == null) return null
  return `当前排队位置：第 ${remote.queue_position} 位`
}
