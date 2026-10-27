import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Slider } from '@no996/ui/forms'
import {
  clampZoom,
  useZoom,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from './ZoomProvider'

function isZoomFieldTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('.wb-zoom-control__field'))
}

export function WorkbenchZoomControl() {
  const { t } = useTranslation('workbench')
  const { zoom, setZoom, nudgeZoom } = useZoom()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(String(zoom))

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(String(zoom))
    }
  }, [zoom])

  const commitDraft = () => {
    const parsed = Number(draft)
    if (Number.isFinite(parsed) && draft !== '') {
      setZoom(clampZoom(parsed))
      return
    }
    setDraft(String(zoom))
  }

  const keepMenuOpen = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <div
      className="wb-zoom-control"
      role="group"
      aria-label={t('zoomMenuLabel')}
      onPointerDown={(event) => {
        if (isZoomFieldTarget(event.target)) return
        event.preventDefault()
      }}
      onClick={keepMenuOpen}
    >
      <div className="wb-zoom-control__stepper">
        <button
          type="button"
          className="wb-zoom-control__btn"
          aria-label={t('zoomDecrease')}
          disabled={zoom <= ZOOM_MIN}
          onClick={() => nudgeZoom(-ZOOM_STEP)}
        >
          −
        </button>
        <div
          className="wb-zoom-control__field"
          onPointerDown={keepMenuOpen}
          onClick={(event) => {
            keepMenuOpen(event)
            inputRef.current?.focus()
            inputRef.current?.select()
          }}
        >
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            className="wb-zoom-control__input"
            aria-label={t('zoomMenuLabel')}
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
            onBlur={commitDraft}
            onPointerDown={keepMenuOpen}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') {
                event.preventDefault()
                inputRef.current?.blur()
              }
              if (event.key === 'Escape') {
                setDraft(String(zoom))
                inputRef.current?.blur()
              }
            }}
          />
          <span className="wb-zoom-control__suffix" aria-hidden>%</span>
        </div>
        <button
          type="button"
          className="wb-zoom-control__btn"
          aria-label={t('zoomIncrease')}
          disabled={zoom >= ZOOM_MAX}
          onClick={() => nudgeZoom(ZOOM_STEP)}
        >
          +
        </button>
      </div>
      <Slider
        className="wb-zoom-control__slider"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={1}
        value={zoom}
        onValueChange={setZoom}
        aria-label={t('zoomMenuLabel')}
        style={{ '--wb-zoom-progress': `${((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100}%` } as CSSProperties}
        onPointerDown={keepMenuOpen}
        onClick={keepMenuOpen}
      />
      <button type="button" className="wb-zoom-control__reset" onClick={() => setZoom(ZOOM_DEFAULT)}>
        {t('zoomReset')}
      </button>
    </div>
  )
}
