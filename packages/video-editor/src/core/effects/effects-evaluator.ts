/**
 * 视觉效果滤镜参数求值器
 * 统一构建 Canvas 2D ctx.filter 字符串，并提供纯数学像素调整断言支持
 */

import type { EffectParam, EffectKind } from '../project.ts'

export const DEFAULT_EFFECTS_CONFIG: Record<EffectKind, { name: string; defaultIntensity: number; unit: string }> = {
  brightness: { name: '亮度', defaultIntensity: 1.0, unit: '' },
  contrast: { name: '对比度', defaultIntensity: 1.0, unit: '' },
  saturation: { name: '饱和度', defaultIntensity: 1.0, unit: '' },
  grayscale: { name: '灰度', defaultIntensity: 0.0, unit: '' },
  blur: { name: '模糊', defaultIntensity: 0.0, unit: 'px' },
}

/**
 * 将 EffectParam 列表转换为标准的 Canvas 2D / CSS filter 字符串
 */
export function buildCanvasFilterString(effects?: EffectParam[]): string {
  if (!effects || effects.length === 0) return 'none'

  const activeEffects = effects.filter((e) => e.enabled)
  if (activeEffects.length === 0) return 'none'

  const tokens: string[] = []

  for (const eff of activeEffects) {
    switch (eff.kind) {
      case 'brightness':
        tokens.push(`brightness(${eff.intensity})`)
        break
      case 'contrast':
        tokens.push(`contrast(${eff.intensity})`)
        break
      case 'saturation':
        tokens.push(`saturate(${eff.intensity})`)
        break
      case 'grayscale':
        tokens.push(`grayscale(${Math.max(0, Math.min(1, eff.intensity))})`)
        break
      case 'blur':
        tokens.push(`blur(${Math.max(0, eff.intensity)}px)`)
        break
    }
  }

  return tokens.length > 0 ? tokens.join(' ') : 'none'
}

/**
 * 纯数学像素明暗调整模拟（用于单元测试断言，不依赖 GPU）
 */
export function applyBrightnessContrast(
  r: number,
  g: number,
  b: number,
  brightness = 1.0,
  contrast = 1.0
): [number, number, number] {
  // 亮度
  let nr = r * brightness
  let ng = g * brightness
  let nb = b * brightness

  // 对比度
  nr = (nr - 128) * contrast + 128
  ng = (ng - 128) * contrast + 128
  nb = (nb - 128) * contrast + 128

  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return [clamp(nr), clamp(ng), clamp(nb)]
}
