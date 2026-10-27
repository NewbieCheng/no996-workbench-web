/**
 * 空间变换、对齐分布与包围盒纯数学函数
 */

import type { TransformBox } from '../../core/project.ts'

export type AlignmentMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
export type DistributionAxis = 'horizontal' | 'vertical'

export type ElementSpatialItem = {
  id: string
  transform: TransformBox
}

/**
 * 多选元素对齐算法
 * 如果只有 1 个元素，相对于画布尺寸对齐；若有多个元素，相对于选区整体包围盒对齐
 */
export function alignElements(
  items: ElementSpatialItem[],
  alignment: AlignmentMode,
  canvasWidth = 1920,
  canvasHeight = 1080
): Array<{ id: string; transform: Partial<TransformBox> }> {
  if (items.length === 0) return []

  let bounds = {
    minX: 0,
    maxX: canvasWidth,
    minY: 0,
    maxY: canvasHeight,
  }

  if (items.length > 1) {
    // 基于多选对象外包围盒计算
    bounds = {
      minX: Math.min(...items.map((i) => i.transform.x)),
      maxX: Math.max(...items.map((i) => i.transform.x + i.transform.width)),
      minY: Math.min(...items.map((i) => i.transform.y)),
      maxY: Math.max(...items.map((i) => i.transform.y + i.transform.height)),
    }
  }

  return items.map((item) => {
    const t = item.transform
    let newX = t.x
    let newY = t.y

    switch (alignment) {
      case 'left':
        newX = bounds.minX
        break
      case 'center':
        newX = bounds.minX + (bounds.maxX - bounds.minX - t.width) / 2
        break
      case 'right':
        newX = bounds.maxX - t.width
        break
      case 'top':
        newY = bounds.minY
        break
      case 'middle':
        newY = bounds.minY + (bounds.maxY - bounds.minY - t.height) / 2
        break
      case 'bottom':
        newY = bounds.maxY - t.height
        break
    }

    return {
      id: item.id,
      transform: {
        x: Math.round(newX),
        y: Math.round(newY),
      },
    }
  })
}

/**
 * 均匀分布元素间距算法
 */
export function distributeElements(
  items: ElementSpatialItem[],
  axis: DistributionAxis
): Array<{ id: string; transform: Partial<TransformBox> }> {
  if (items.length < 3) return [] // 至少需要 3 个元素才能形成等距分布

  if (axis === 'horizontal') {
    // 按 X 升序排列
    const sorted = [...items].sort((a, b) => a.transform.x - b.transform.x)
    const minX = sorted[0].transform.x
    const last = sorted[sorted.length - 1]
    const maxX = last.transform.x + last.transform.width

    const totalWidthOfElements = sorted.reduce((sum, item) => sum + item.transform.width, 0)
    const totalGaps = sorted.length - 1
    const availableSpace = maxX - minX - totalWidthOfElements
    const gap = availableSpace / totalGaps

    let currentX = minX
    const updates: Array<{ id: string; transform: Partial<TransformBox> }> = []

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i]
      updates.push({
        id: item.id,
        transform: { x: Math.round(currentX) },
      })
      currentX += item.transform.width + gap
    }
    return updates
  } else {
    // 按 Y 升序排列
    const sorted = [...items].sort((a, b) => a.transform.y - b.transform.y)
    const minY = sorted[0].transform.y
    const last = sorted[sorted.length - 1]
    const maxY = last.transform.y + last.transform.height

    const totalHeightOfElements = sorted.reduce((sum, item) => sum + item.transform.height, 0)
    const totalGaps = sorted.length - 1
    const availableSpace = maxY - minY - totalHeightOfElements
    const gap = availableSpace / totalGaps

    let currentY = minY
    const updates: Array<{ id: string; transform: Partial<TransformBox> }> = []

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i]
      updates.push({
        id: item.id,
        transform: { y: Math.round(currentY) },
      })
      currentY += item.transform.height + gap
    }
    return updates
  }
}

/**
 * 比例锁定尺寸计算
 */
export function computeProportionalSize(
  origWidth: number,
  origHeight: number,
  targetWidth?: number,
  targetHeight?: number,
  lockAspectRatio = true
): { width: number; height: number } {
  const aspect = origWidth / Math.max(1, origHeight)

  if (!lockAspectRatio) {
    return {
      width: Math.max(1, Math.round(targetWidth ?? origWidth)),
      height: Math.max(1, Math.round(targetHeight ?? origHeight)),
    }
  }

  if (targetWidth !== undefined && targetHeight === undefined) {
    const w = Math.max(1, Math.round(targetWidth))
    return { width: w, height: Math.max(1, Math.round(w / aspect)) }
  }

  if (targetHeight !== undefined && targetWidth === undefined) {
    const h = Math.max(1, Math.round(targetHeight))
    return { width: Math.max(1, Math.round(h * aspect)), height: h }
  }

  if (targetWidth !== undefined && targetHeight !== undefined) {
    // 优先按目标宽度等比例缩放
    const w = Math.max(1, Math.round(targetWidth))
    return { width: w, height: Math.max(1, Math.round(w / aspect)) }
  }

  return { width: origWidth, height: origHeight }
}
