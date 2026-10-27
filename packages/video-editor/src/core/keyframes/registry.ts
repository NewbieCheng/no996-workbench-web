/**
 * 关键帧属性通道注册表与插值解析器
 * 支持数字线性/贝塞尔插值、HEX 颜色渐变插值与离散跳变
 */

import type { KeyframePoint, KeyframeEasing } from '../project.ts'
import type { TimeUs } from '../time.ts'

export type PropertyValueType = 'number' | 'color' | 'discrete'

export type PropertyDescriptor = {
  path: string
  name: string
  type: PropertyValueType
  defaultValue: number | string
  min?: number
  max?: number
}

export const KEYFRAME_PROPERTY_REGISTRY: Record<string, PropertyDescriptor> = {
  'transform.x': { path: 'transform.x', name: '水平位置 X', type: 'number', defaultValue: 0 },
  'transform.y': { path: 'transform.y', name: '垂直位置 Y', type: 'number', defaultValue: 0 },
  'transform.width': { path: 'transform.width', name: '宽度', type: 'number', defaultValue: 1920, min: 1 },
  'transform.height': { path: 'transform.height', name: '高度', type: 'number', defaultValue: 1080, min: 1 },
  'transform.rotationDeg': { path: 'transform.rotationDeg', name: '旋转角度', type: 'number', defaultValue: 0 },
  'transform.opacity': { path: 'transform.opacity', name: '不透明度', type: 'number', defaultValue: 1, min: 0, max: 1 },
  volume: { path: 'volume', name: '音频音量', type: 'number', defaultValue: 1, min: 0, max: 2 },
  'style.color': { path: 'style.color', name: '文字颜色', type: 'color', defaultValue: '#ffffff' },
}

/**
 * 缓动曲线求值
 */
export function evaluateEasingCurve(progress: number, easing: KeyframeEasing): number {
  const p = Math.max(0, Math.min(1, progress))
  switch (easing) {
    case 'linear':
      return p
    case 'easeIn':
      return p * p
    case 'easeOut':
      return p * (2 - p)
    case 'easeInOut':
      return p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p
    case 'hold':
      return 0
    default:
      return p
  }
}

/**
 * HEX 颜色插值 (#RRGGBB)
 */
export function interpolateColorHex(colorA: string, colorB: string, progress: number): string {
  const parseHex = (hex: string) => {
    const clean = hex.replace('#', '')
    if (clean.length === 3) {
      return [
        parseInt(clean[0] + clean[0], 16),
        parseInt(clean[1] + clean[1], 16),
        parseInt(clean[2] + clean[2], 16),
      ]
    }
    return [
      parseInt(clean.slice(0, 2), 16) || 0,
      parseInt(clean.slice(2, 4), 16) || 0,
      parseInt(clean.slice(4, 6), 16) || 0,
    ]
  }

  const [r1, g1, b1] = parseHex(colorA)
  const [r2, g2, b2] = parseHex(colorB)
  const p = Math.max(0, Math.min(1, progress))

  const r = Math.round(r1 + (r2 - r1) * p)
  const g = Math.round(g1 + (g2 - g1) * p)
  const b = Math.round(b1 + (b2 - b1) * p)

  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * 通用关键帧序列插值
 */
export function interpolateKeyframes<T = number | string>(
  keyframes: Array<KeyframePoint<T>>,
  localTimeUs: TimeUs,
  type: PropertyValueType = 'number',
  fallbackValue: T
): T {
  if (!keyframes || keyframes.length === 0) return fallbackValue

  // 排序
  const sorted = [...keyframes].sort((a, b) => a.timeUs - b.timeUs)

  if (sorted.length === 1 || localTimeUs <= sorted[0].timeUs) {
    return sorted[0].value
  }

  const last = sorted[sorted.length - 1]
  if (localTimeUs >= last.timeUs) {
    return last.value
  }

  // 寻找区间
  for (let i = 0; i < sorted.length - 1; i++) {
    const kfA = sorted[i]
    const kfB = sorted[i + 1]

    if (localTimeUs >= kfA.timeUs && localTimeUs <= kfB.timeUs) {
      const spanUs = kfB.timeUs - kfA.timeUs
      if (spanUs === 0) return kfB.value

      const rawP = (localTimeUs - kfA.timeUs) / spanUs
      const curvedP = evaluateEasingCurve(rawP, kfA.easing)

      if (type === 'number') {
        const numA = Number(kfA.value)
        const numB = Number(kfB.value)
        return (numA + (numB - numA) * curvedP) as unknown as T
      } else if (type === 'color') {
        return interpolateColorHex(String(kfA.value), String(kfB.value), curvedP) as unknown as T
      } else {
        // 离散型直接在末尾前返回 A，到达时刻返回 B
        return (rawP >= 1 ? kfB.value : kfA.value) as unknown as T
      }
    }
  }

  return fallbackValue
}
