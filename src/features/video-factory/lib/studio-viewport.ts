import { useEffect, useState, type RefObject } from 'react'

/** 与 video-factory.css `--vf-layout-min-width` 保持一致 */
export const VF_LAYOUT_MIN_WIDTH_PX = 1280

const CLIP_SCROLL_THRESHOLD_PX = 8

export function isStudioViewportTooNarrow(widthPx: number): boolean {
  return widthPx < VF_LAYOUT_MIN_WIDTH_PX
}

export function evaluateStudioViewportGate(pageArea: HTMLElement): boolean {
  // The page area may grow to the editor's 1280px min-width while its parent
  // viewport stays narrow. Measure the visible box, not the scrollable content.
  const visibleWidth = pageArea.getBoundingClientRect().width
  const narrow = isStudioViewportTooNarrow(visibleWidth)
  const clipped = pageArea.scrollWidth > visibleWidth + CLIP_SCROLL_THRESHOLD_PX
  return narrow || clipped
}

export function useStudioViewportGate(bodyRef: RefObject<HTMLElement | null>): boolean {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const pageArea = bodyRef.current?.closest(
      '.wb-page-area.video-factory-workbench-page',
    ) as HTMLElement | null
    if (!pageArea) return

    const update = () => {
      setBlocked(evaluateStudioViewportGate(pageArea))
    }
    update()

    const observer = new ResizeObserver(update)
    observer.observe(pageArea)
    pageArea.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)

    return () => {
      observer.disconnect()
      pageArea.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [bodyRef])

  return blocked
}
