/**
 * 转场求值器与双画面平滑插值合成算法
 * 支持：cut (硬切), crossfade (淡入淡出), dissolve (叠化), wipe (方向擦除)
 */

import type { TransitionElement } from '../project.ts'
import type { TimeUs } from '../time.ts'

export type TransitionSampleResult = {
  progress: number // 0.0 - 1.0
  opacityA: number
  opacityB: number
  wipeClipRectB?: { x: number; y: number; width: number; height: number } // 擦除推进裁切区
}

/**
 * 计算转场在特定时刻的进度与图层透明度/裁切
 */
export function evaluateTransitionProgress(
  transition: TransitionElement,
  elapsedUs: TimeUs,
  canvasWidth = 1920,
  canvasHeight = 1080
): TransitionSampleResult {
  const duration = Math.max(1, transition.durationUs)
  const progress = Math.max(0, Math.min(1, elapsedUs / duration))

  switch (transition.kind) {
    case 'cut': {
      const isFirstHalf = progress < 0.5
      return {
        progress,
        opacityA: isFirstHalf ? 1 : 0,
        opacityB: isFirstHalf ? 0 : 1,
      }
    }

    case 'crossfade':
    case 'dissolve': {
      return {
        progress,
        opacityA: 1 - progress,
        opacityB: progress,
      }
    }

    case 'wipe': {
      // 从左向右水平擦除推进
      const currentWipeWidth = Math.round(canvasWidth * progress)
      return {
        progress,
        opacityA: 1,
        opacityB: 1,
        wipeClipRectB: {
          x: 0,
          y: 0,
          width: currentWipeWidth,
          height: canvasHeight,
        },
      }
    }

    default:
      return {
        progress,
        opacityA: 1 - progress,
        opacityB: progress,
      }
  }
}
