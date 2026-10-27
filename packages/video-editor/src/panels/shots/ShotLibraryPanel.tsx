/**
 * 镜头动效库面板 (ShotLibraryPanel)
 *
 * 悬停静态出帧 + 点击缩略图循环预览；仅「+」或拖拽插入时间轴。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SHOT_CATALOG, SHOT_CATEGORIES, type ShotDefinition } from '../../demos/registry.generated.ts'
import { getShotAccessibleLabel, getShotCategoryDisplayName, getShotDisplayName } from '../../demos/localization.ts'
import { getShotFrameCache } from '../../render/shot-cache.ts'
import { LibraryAddButton } from '../shared/LibraryAddButton.tsx'
import { LibrarySectionHeader } from '../shared/LibrarySectionHeader.tsx'

export type ShotLibraryPanelProps = {
  onPick?: (shot: ShotDefinition) => void
  onDragStart?: (shot: ShotDefinition) => void
  query?: string
  onQueryChange?: (query: string) => void
  hideSearchBar?: boolean
  style?: React.CSSProperties
  className?: string
}

const CATEGORY_THEMES: Record<string, { accent: string; label: string }> = {
  opening: { accent: '#f59e0b', label: '开场' },
  camera: { accent: '#3b82f6', label: '运镜' },
  transition: { accent: '#8b5cf6', label: '转场' },
  typography: { accent: '#ec4899', label: '文字' },
  'ui-entrance': { accent: '#10b981', label: '界面' },
  interaction: { accent: '#06b6d4', label: '交互' },
  data: { accent: '#6366f1', label: '图表' },
  effects: { accent: '#eab308', label: '特效' },
  rhythm: { accent: '#ef4444', label: '节奏' },
  outro: { accent: '#64748b', label: '收尾' },
}

const THUMB_WIDTH = 160
const THUMB_HEIGHT = 90
const SCRUB_FPS = 30

/** 配色类键：与 shot-schemas / 检查器「视觉配色」页签的 custom* 约定一致 */
const COLOR_PARAM_KEYS = new Set([
  'colorTheme',
  'customBg',
  'customPrimary',
  'customSecondary',
  'customPanel',
  'customInk',
])

export type ShotEditability = { text: boolean; color: boolean }

/**
 * 角标口径：依据注册表 editableKeys（生成脚本从组件源码提取的真实 useShotProp 消费键）。
 * 两者都为 false = 纯演示固定场景，卡片如实标注，不假装可编辑。
 */
export function shotEditability(shot: Pick<ShotDefinition, 'editableKeys'>): ShotEditability {
  const keys = shot.editableKeys ?? []
  return {
    color: keys.some((key) => COLOR_PARAM_KEYS.has(key)),
    text: keys.some((key) => !COLOR_PARAM_KEYS.has(key)),
  }
}

async function renderShotFrame(shot: ShotDefinition, frame: number): Promise<string | null> {
  const cache = getShotFrameCache()
  const canvas = await cache.getPreview({
    shotId: shot.shotId,
    frame: Math.min(frame, shot.durationInFrames - 1),
    width: THUMB_WIDTH * 2,
    height: THUMB_HEIGHT * 2,
    fps: 30,
  })
  if (!canvas) return null
  try {
    return canvas.toDataURL('image/jpeg', 0.75)
  } catch {
    return null
  }
}

function ShotCard({
  shot,
  onPick,
  onDragStart,
}: {
  shot: ShotDefinition
  onPick?: (shot: ShotDefinition) => void
  onDragStart?: (shot: ShotDefinition) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrubRafRef = useRef<number | null>(null)
  const scrubFrameRef = useRef(0)
  const scrubLastTickRef = useRef(0)
  const scrubActiveRef = useRef(false)

  const theme = CATEGORY_THEMES[shot.category] ?? { accent: 'var(--primary)', label: '动效' }
  const durationSec = (shot.durationInFrames / 30).toFixed(1)
  const editability = shotEditability(shot)
  const editBadgeLabel = !editability.text && !editability.color
    ? '演示固定'
    : [editability.text ? '可改文案' : '', editability.color ? '可调配色' : ''].filter(Boolean).join(' · ')
  const editBadgeKind = !editability.text && !editability.color ? 'fixed' : 'editable'
  // 画幅能力：reflow = 自带竖屏重排；其余按预设整体缩放（cover 裁 / fit 留边）
  const verticalMode = shot.vertical?.mode

  const stopScrub = useCallback(() => {
    scrubActiveRef.current = false
    setIsScrubbing(false)
    if (scrubRafRef.current !== null) {
      cancelAnimationFrame(scrubRafRef.current)
      scrubRafRef.current = null
    }
  }, [])

  const startScrub = useCallback(() => {
    if (scrubActiveRef.current) {
      stopScrub()
      return
    }
    scrubActiveRef.current = true
    setIsScrubbing(true)
    scrubFrameRef.current = 0
    scrubLastTickRef.current = 0

    const tick = (now: number) => {
      if (!scrubActiveRef.current) return
      if (!scrubLastTickRef.current) scrubLastTickRef.current = now
      const elapsed = now - scrubLastTickRef.current
      if (elapsed >= 1000 / SCRUB_FPS) {
        scrubLastTickRef.current = now
        const frame = scrubFrameRef.current
        void renderShotFrame(shot, frame).then((src) => {
          if (src && scrubActiveRef.current) setPreviewSrc(src)
        })
        scrubFrameRef.current += 1
        if (scrubFrameRef.current >= shot.durationInFrames) {
          stopScrub()
          return
        }
      }
      scrubRafRef.current = requestAnimationFrame(tick)
    }
    scrubRafRef.current = requestAnimationFrame(tick)
  }, [shot, stopScrub])

  useEffect(() => {
    return () => stopScrub()
  }, [stopScrub])

  useEffect(() => {
    if (!isHovered || isScrubbing) {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      return
    }

    if (previewSrc) return

    hoverTimerRef.current = setTimeout(() => {
      let cancelled = false
      setIsLoading(true)
      const frame = Math.max(0, Math.floor(shot.durationInFrames * 0.45))
      void renderShotFrame(shot, frame)
        .then((src) => {
          if (!cancelled && src) setPreviewSrc(src)
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })

      return () => {
        cancelled = true
      }
    }, 150)

    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    }
  }, [isHovered, isScrubbing, previewSrc, shot])

  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData(
      'application/x-no996-shot',
      JSON.stringify({ shotId: shot.shotId, durationInFrames: shot.durationInFrames }),
    )
    event.dataTransfer.effectAllowed = 'copy'
    onDragStart?.(shot)
  }

  const handleThumbClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    startScrub()
  }

  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === ' ' && event.target === event.currentTarget) {
      event.preventDefault()
      startScrub()
    }
  }

  return (
    <div
      className="vf-lib-shot-card"
      data-previewing={isScrubbing}
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        stopScrub()
      }}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      aria-label={getShotAccessibleLabel(shot)}
      title={`${getShotDisplayName(shot)} (${durationSec}s) - 点击预览或拖拽至时间轴`}
    >
      <div
        className="vf-lib-shot-card__thumb"
        onClick={handleThumbClick}
        role="button"
        tabIndex={-1}
        aria-label={`预览 ${getShotDisplayName(shot)}`}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: `radial-gradient(circle at 50% 45%, ${theme.accent}18 0%, transparent 70%)`,
              gap: 4,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: `${theme.accent}22`,
                border: `1px solid ${theme.accent}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.accent,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)', letterSpacing: '0.04em' }}>
              {theme.label}
            </span>
          </div>
        )}

        {isHovered && isLoading && !previewSrc ? (
          <div className="vf-lib-shot-card__loading">
            出帧中…
          </div>
        ) : null}

        <div
          className="vf-lib-shot-card__badge"
          data-kind={editBadgeKind}
          title={
            editability.text || editability.color
              ? '该镜头的以下内容可在选中后于检查器中修改'
              : '该镜头为内置演示场景，文案与配色当前不可替换'
          }
        >
          {editBadgeLabel}
        </div>

        <div className="vf-lib-shot-card__duration">
          {durationSec}s
        </div>

        {/* 画幅诚实标注：有竖屏重排分支的标「横竖屏」，其余标「仅横屏」 */}
        <div
          className="vf-lib-shot-card__duration"
          style={{ left: 'auto', right: 8, top: 8, transform: 'none' }}
          title={
            verticalMode === 'reflow'
              ? '该镜头自带 9:16 竖屏重排布局，横屏与竖屏都可直接用'
              : verticalMode
                ? '该镜头是 1920×1080 构图，9:16 时按预设整体缩放（cover 裁切 / fit 留边），未做重排'
                : '该镜头按 1920×1080 横屏构图，竖屏（9:16）尚未适配'
          }
        >
          {verticalMode === 'reflow' ? '横竖屏' : '仅横屏'}
        </div>
      </div>

      <div className="vf-lib-shot-card__footer">
        <span className="vf-lib-shot-card__title">{getShotDisplayName(shot)}</span>
        <LibraryAddButton
          label={`添加 ${getShotDisplayName(shot)} 至时间轴`}
          onClick={(event) => {
            event.stopPropagation()
            onPick?.(shot)
          }}
        />
      </div>
    </div>
  )
}

export function ShotLibraryPanel({
  onPick,
  onDragStart,
  query: controlledQuery,
  onQueryChange,
  hideSearchBar = false,
  style,
  className,
}: ShotLibraryPanelProps) {
  const [internalQuery, setInternalQuery] = useState('')
  const query = controlledQuery !== undefined ? controlledQuery : internalQuery

  const handleQueryChange = (val: string) => {
    if (controlledQuery === undefined) setInternalQuery(val)
    onQueryChange?.(val)
  }

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return SHOT_CATALOG
    return SHOT_CATALOG.filter(
      (shot) =>
        shot.name.toLowerCase().includes(keyword) ||
        getShotDisplayName(shot).toLowerCase().includes(keyword) ||
        shot.summary.toLowerCase().includes(keyword) ||
        shot.shotId.toLowerCase().includes(keyword),
    )
  }, [query])

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; shots: ShotDefinition[] }>()
    for (const shot of filtered) {
      const entry = map.get(shot.category) ?? { label: getShotCategoryDisplayName(shot), shots: [] }
      entry.shots.push(shot)
      map.set(shot.category, entry)
    }
    const ordered: { id: string; label: string; shots: ShotDefinition[] }[] = []
    for (const category of SHOT_CATEGORIES) {
      const entry = map.get(category.id)
      if (entry) ordered.push({ id: category.id, ...entry })
    }
    for (const [id, entry] of map) {
      if (!SHOT_CATEGORIES.some((category) => category.id === id)) ordered.push({ id, ...entry })
    }
    return ordered
  }, [filtered])

  return (
    <div
      className={`vf-lib-panel${className ? ` ${className}` : ''}`}
      data-testid="shot-library-panel"
      style={style}
    >
      {!hideSearchBar && (
        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
          <input
            type="search"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder={`搜索 ${SHOT_CATALOG.length} 个镜头动效…`}
            aria-label="搜索镜头动效"
            style={{
              width: '100%',
              height: 28,
              padding: '0 8px',
              fontSize: 11,
              borderRadius: 5,
              border: '1px solid var(--border)',
              background: 'var(--muted)',
              color: 'var(--foreground)',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
      )}

      <div className="vf-lib-scroll">
        {grouped.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', padding: 12, textAlign: 'center' }}>
            没有匹配「{query}」的镜头
          </p>
        ) : null}

        {grouped.map((group) => {
          const isCollapsed = collapsed[group.id]
          const accent = CATEGORY_THEMES[group.id]?.accent
          return (
            <section key={group.id}>
              <LibrarySectionHeader
                label={group.label}
                count={group.shots.length}
                expanded={!isCollapsed}
                accentDot={accent}
                onToggle={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
              />
              {!isCollapsed && (
                <div className="vf-lib-shot-grid">
                  {group.shots.map((shot) => (
                    <ShotCard key={shot.shotId} shot={shot} onPick={onPick} onDragStart={onDragStart} />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
