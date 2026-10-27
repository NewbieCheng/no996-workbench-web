export type Layout = { x: number; y: number; w: number; h: number; round: number; crop: 'cover' | 'contain' }

export function clampLayout(layout: Layout): Layout {
  const finite = (n: number, fallback: number) => Number.isFinite(n) ? n : fallback
  const w = Math.min(1, Math.max(.05, finite(layout.w, 1)))
  const h = Math.min(1, Math.max(.05, finite(layout.h, 1)))
  return {
    ...layout,
    w,
    h,
    x: Math.min(1 - w, Math.max(0, finite(layout.x, 0))),
    y: Math.min(1 - h, Math.max(0, finite(layout.y, 0))),
    round: Math.max(0, Math.min(.5, finite(layout.round, 0)))
  }
}

import type { LayerBox } from '../lib/template-project.ts'

export type PixelBox = { x: number; y: number; width: number; height: number }

export function percentBoxStyle(box: PixelBox, outputWidth: number, outputHeight: number) {
  return {
    left: `${(box.x / outputWidth) * 100}%`,
    top: `${(box.y / outputHeight) * 100}%`,
    width: `${(box.width / outputWidth) * 100}%`,
    height: `${(box.height / outputHeight) * 100}%`
  }
}

export function layoutToPixelBox(layout: Layout, outputWidth: number, outputHeight: number): PixelBox {
  return {
    x: layout.x * outputWidth,
    y: layout.y * outputHeight,
    width: layout.w * outputWidth,
    height: layout.h * outputHeight
  }
}

export function pixelBoxToLayout(box: PixelBox, base: Layout, outputWidth: number, outputHeight: number): Layout {
  return clampLayout({
    ...base,
    x: box.x / outputWidth,
    y: box.y / outputHeight,
    w: box.width / outputWidth,
    h: box.height / outputHeight
  })
}

export function layerBoxToPixel(box: LayerBox): PixelBox {
  return { x: box.x, y: box.y, width: box.width, height: box.height }
}

export function pixelToLayerBox(box: PixelBox): LayerBox {
  return { x: box.x, y: box.y, width: box.width, height: box.height }
}

export function snapPixelBox(
  box: PixelBox,
  outputWidth: number,
  outputHeight: number,
  safeInset: number,
  threshold: number
): PixelBox {
  const snapAxis = (position: number, size: number, extent: number) => {
    let distance = threshold + 1
    let delta = 0
    for (const target of [safeInset, extent / 2, extent - safeInset]) {
      for (const anchor of [position, position + size / 2, position + size]) {
        if (Math.abs(target - anchor) < distance) {
          distance = Math.abs(target - anchor)
          delta = target - anchor
        }
      }
    }
    return position + (distance <= threshold ? delta : 0)
  }
  return {
    ...box,
    x: snapAxis(box.x, box.width, outputWidth),
    y: snapAxis(box.y, box.height, outputHeight)
  }
}

export type MoveableGesture = {
  startBox: PixelBox
  scale: number
  kind: 'drag' | 'resize'
}
