/**
 * Remotion 兼容运行时 —— 运动模糊
 *
 * 参考项目 4 个 demo 用 `@remotion/motion-blur` 的 CameraMotionBlur：
 *   DroneDiveLanding · CraneRiseReveal · Fracture · MagicianCardFlourish
 *
 * 原版做法是渲染 N 个子帧做平均。我们提供两档：
 *  - approx（默认）：CSS blur 近似，单帧只要一次渲染，快；
 *  - accurate：真多帧平均，代价 ×samples，由调用方按需开启。
 *
 * 卡片角标据此标注「近似 / 高保真」。
 */

import { Children, cloneElement, isValidElement, type ReactNode } from 'react'

export type CameraMotionBlurProps = {
  /** 快门角度，决定模糊强度；参考项目用 220 */
  shutterAngle?: number
  /** 采样数；参考项目用 12 */
  samples?: number
  /** 强制选择实现档位；默认 approx */
  mode?: 'approx' | 'accurate'
  children?: ReactNode
}

/**
 * 近似档：把快门角度换算成模糊半径。
 * 经验值 360° → 1.2px（在 1920 宽下约为一个像素的观感），
 * 参考项目里 220° 约 0.73px —— 实测接近原版观感。
 */
export function CameraMotionBlur({
  shutterAngle = 180,
  samples = 6,
  mode = 'approx',
  children,
}: CameraMotionBlurProps) {
  if (mode === 'accurate') {
    // 真多帧平均需要管线配合逐帧重渲染，这里退化为近似并在卡片上标注
    // （accurate 档由 pipeline 层实现，见 dom-frame-renderer 的 motionBlurSamples）
    return <>{children}</>
  }

  const blurPx = Math.max(0, (shutterAngle / 360) * 1.2)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        filter: blurPx > 0.01 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
        willChange: 'filter',
      }}
      data-motion-blur={samples}
    >
      {children}
    </div>
  )
}

/** 供管线判断是否需要多采样重渲。 */
export function motionBlurSamples(node: ReactNode): number {
  let found = 1
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return
    const props = child.props as Partial<CameraMotionBlurProps> & { children?: ReactNode }
    if (child.type === CameraMotionBlur && props.mode === 'accurate' && props.samples) {
      found = Math.max(found, props.samples)
    }
    if (props.children) found = Math.max(found, motionBlurSamples(props.children))
  })
  return found
}

/** demo 里若写成 `<CameraMotionBlur><Scene/></CameraMotionBlur>` 的包装形态，保持兼容。 */
export function withMotionBlur(node: ReactNode, props: Omit<CameraMotionBlurProps, 'children'>) {
  if (!isValidElement(node)) return node
  return cloneElement(node, props as never)
}
