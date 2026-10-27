import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { WB_PORTAL_HOST_ID } from '@no996/ui/portal-host'

/** Legacy preset list — used only when migrating stored values. */
export const WORKBENCH_ZOOM_LEVELS = [80, 90, 100, 110, 125] as const

export {
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
  clampZoom,
  normalizeZoomPercent,
} from './zoom-math'
import { ZOOM_DEFAULT, parseStoredZoom, normalizeZoomPercent } from './zoom-math'

export const ZOOM_STEP = 8
export const ZOOM_CHANGED_EVENT = 'no996:web-zoom-changed'
// A new key resets old potentially unintended zoom settings once.
const STORAGE_KEY = 'no996-web-zoom-v2'

export function readAppZoomFactor(): number {
  if (typeof document === 'undefined') return 1
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-zoom').trim()
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 1
}

function readStoredZoom(): number {
  try {
    return parseStoredZoom(localStorage.getItem(STORAGE_KEY))
  } catch {
    /* ignore */
  }
  return ZOOM_DEFAULT
}

type ZoomContextValue = {
  zoom: number
  zoomFactor: number
  setZoom: (value: number) => void
  nudgeZoom: (delta: number) => void
}

const ZoomContext = createContext<ZoomContextValue>({
  zoom: ZOOM_DEFAULT,
  zoomFactor: ZOOM_DEFAULT / 100,
  setZoom: () => {},
  nudgeZoom: () => {},
})

export function ZoomProvider({ children }: { children: ReactNode }) {
  const [zoom, updateZoom] = useState<number>(() => readStoredZoom())
  const surfaceRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const setZoom = useCallback((value: number) => {
    updateZoom(normalizeZoomPercent(value))
  }, [])

  const nudgeZoom = useCallback(
    (delta: number) => {
      setZoom(zoomRef.current + delta)
    },
    [setZoom],
  )

  useLayoutEffect(() => {
    const percent = normalizeZoomPercent(zoom)
    if (percent !== zoom) {
      updateZoom(percent)
      return
    }
    const factor = percent / 100
    document.documentElement.style.setProperty('--app-zoom', String(factor))
    document.documentElement.style.zoom = String(factor)
    const surface = surfaceRef.current
    if (surface) {
      surface.style.removeProperty('zoom')
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(percent))
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new CustomEvent(ZOOM_CHANGED_EVENT, { detail: { percent } }))
  }, [zoom])

  const safeZoom = normalizeZoomPercent(zoom)
  const value: ZoomContextValue = {
    zoom: safeZoom,
    zoomFactor: safeZoom / 100,
    setZoom,
    nudgeZoom,
  }

  return (
    <ZoomContext.Provider value={value}>
      <div id="wb-zoom-surface" ref={surfaceRef} className="wb-zoom-surface">
        {children}
        <div id={WB_PORTAL_HOST_ID} className="wb-portal-host" aria-hidden="true" />
      </div>
    </ZoomContext.Provider>
  )
}

export function useZoom() {
  return useContext(ZoomContext)
}
