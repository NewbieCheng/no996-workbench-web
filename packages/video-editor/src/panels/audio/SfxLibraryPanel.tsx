/**
 * 音效库面板
 *
 * 149 个音效 + 5 首 BGM，按 16 类折叠。
 * 性能约束：不能预加载全部音频（约 32MB），试听复用单个 Audio 实例。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import {
  BGM_CATALOG,
  SFX_CATALOG,
  SFX_CATEGORIES,
  audioAssetUrl,
  type BgmDefinition,
  type SfxDefinition,
} from '../../media/audio-manifest.generated.ts'
import { LibraryAddButton } from '../shared/LibraryAddButton.tsx'
import { LibrarySectionHeader } from '../shared/LibrarySectionHeader.tsx'

export type AudioPickPayload =
  | { kind: 'sfx'; item: SfxDefinition }
  | { kind: 'bgm'; item: BgmDefinition }

export type SfxLibraryPanelProps = {
  onPick?: (payload: AudioPickPayload) => void
  query?: string
  onQueryChange?: (query: string) => void
  hideSearchBar?: boolean
  style?: React.CSSProperties
  className?: string
}

type AudioRowItem = { kind: 'bgm'; item: BgmDefinition } | { kind: 'sfx'; item: SfxDefinition }

function AudioLibraryRow({
  row,
  playingId,
  onPreview,
  onPick,
}: {
  row: AudioRowItem
  playingId: string | null
  onPreview: (id: string, path: string) => void
  onPick?: (payload: AudioPickPayload) => void
}) {
  const { item } = row
  const isPlaying = playingId === item.id
  const pickPayload: AudioPickPayload =
    row.kind === 'bgm' ? { kind: 'bgm', item: row.item } : { kind: 'sfx', item: row.item }

  const dragMime = JSON.stringify({
    kind: row.kind,
    label: item.label,
    path: item.path,
  })

  return (
    <div className={`vf-lib-row${isPlaying ? ' vf-lib-row--playing' : ''}`}>
      <button
        type="button"
        className="vf-lib-row__preview"
        onClick={() => onPreview(item.id, item.path)}
        aria-label={`试听 ${item.label}`}
      >
        {isPlaying ? <Pause className="size-3" aria-hidden /> : <Play className="size-3" aria-hidden />}
      </button>
      <button
        type="button"
        className="vf-lib-row__main"
        draggable
        onClick={() => onPreview(item.id, item.path)}
        onDragStart={(event) => {
          event.dataTransfer.setData('application/x-no996-audio', dragMime)
          event.dataTransfer.effectAllowed = 'copy'
        }}
        title={row.kind === 'bgm' ? `${item.label} · ${(item.bytes / 1024 / 1024).toFixed(1)}MB` : item.id}
      >
        {item.label}
      </button>
      <LibraryAddButton
        label={`添加 ${item.label} 至时间轴`}
        onClick={(event) => {
          event.stopPropagation()
          onPick?.(pickPayload)
        }}
      />
    </div>
  )
}

export function SfxLibraryPanel({
  onPick,
  query: controlledQuery,
  onQueryChange,
  hideSearchBar = false,
  style,
  className,
}: SfxLibraryPanelProps) {
  const [internalQuery, setInternalQuery] = useState('')
  const query = controlledQuery !== undefined ? controlledQuery : internalQuery

  const handleQueryChange = (val: string) => {
    if (controlledQuery === undefined) setInternalQuery(val)
    onQueryChange?.(val)
  }

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'none'
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.src = ''
        audioRef.current = null
      }
    }
  }, [])

  const preview = useCallback(
    (id: string, relativePath: string) => {
      setError('')
      const audio = getAudio()
      if (playingId === id) {
        audio.pause()
        setPlayingId(null)
        return
      }
      audio.src = audioAssetUrl(relativePath)
      audio.onerror = () => {
        setPlayingId(null)
        setError('音频加载失败，请确认资源目录已部署')
      }
      audio.onended = () => setPlayingId(null)
      void audio
        .play()
        .then(() => setPlayingId(id))
        .catch(() => {
          setPlayingId(null)
          setError('浏览器阻止了自动播放，请再点一次')
        })
    },
    [getAudio, playingId],
  )

  const grouped = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const matches = (text: string) => !keyword || text.toLowerCase().includes(keyword)
    const sfx = SFX_CATALOG.filter((item) => matches(item.label) || matches(item.category))
    const bgm = BGM_CATALOG.filter((item) => matches(item.label))
    return { sfx, bgm }
  }, [query])

  return (
    <div
      className={`vf-lib-panel${className ? ` ${className}` : ''}`}
      data-testid="sfx-library-panel"
      style={style}
    >
      {!hideSearchBar && (
        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
          <input
            type="search"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder={`搜索 ${SFX_CATALOG.length} 个音效 / ${BGM_CATALOG.length} 首音乐…`}
            aria-label="搜索音效"
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
          {error ? (
            <p style={{ margin: '4px 0 0', fontSize: 10, color: '#f87171', lineHeight: 1.4 }}>{error}</p>
          ) : null}
        </div>
      )}

      <div className="vf-lib-scroll">
        {error && hideSearchBar ? (
          <p style={{ margin: '4px 0 8px', fontSize: 10, color: '#f87171', lineHeight: 1.4 }}>{error}</p>
        ) : null}

        {grouped.bgm.length > 0 && (
          <section>
            <LibrarySectionHeader label="背景音乐" count={grouped.bgm.length} expanded={true} staticHeader />
            {grouped.bgm.map((item) => (
              <AudioLibraryRow
                key={item.id}
                row={{ kind: 'bgm', item }}
                playingId={playingId}
                onPreview={preview}
                onPick={onPick}
              />
            ))}
          </section>
        )}

        {SFX_CATEGORIES.map((category) => {
          const items = grouped.sfx.filter((item) => item.category === category.id)
          if (!items.length) return null
          const isCollapsed = collapsed[category.id]
          return (
            <section key={category.id}>
              <LibrarySectionHeader
                label={category.label}
                count={items.length}
                expanded={!isCollapsed}
                onToggle={() => setCollapsed((prev) => ({ ...prev, [category.id]: !prev[category.id] }))}
              />
              {!isCollapsed &&
                items.map((item) => (
                  <AudioLibraryRow
                    key={item.id}
                    row={{ kind: 'sfx', item }}
                    playingId={playingId}
                    onPreview={preview}
                    onPick={onPick}
                  />
                ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
