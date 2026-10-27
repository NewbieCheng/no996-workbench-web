/**
 * 镜头渲染自检页（仅开发环境）
 *
 * 目的：把 151 个镜头逐个真渲染一帧，暴露「导入即崩」「图片没加载完」「字体没就绪」
 * 这类只有真跑才会发现的问题。
 *
 * 入口：/dev/shot-check
 * 生产构建时整个文件不被引用（路由由 import.meta.env.DEV 包裹）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { SHOT_CATALOG, SHOT_CATEGORIES } from '@no996/video-editor'
import { createDomFrameRenderer } from '@no996/video-editor/demos/pipeline/dom-frame-renderer.ts'

type CheckResult = {
  shotId: string
  status: 'pending' | 'ok' | 'fail'
  ms?: number
  message?: string
  thumbnail?: string
}

export default function ShotCheckPage() {
  const [results, setResults] = useState<CheckResult[]>([])
  const [running, setRunning] = useState(false)
  const [category, setCategory] = useState<string>('all')
  const cancelledRef = useRef(false)

  const run = useCallback(
    async (filter: string) => {
      setRunning(true)
      cancelledRef.current = false
      const targets =
        filter === 'all' ? SHOT_CATALOG : SHOT_CATALOG.filter((shot) => shot.category === filter)
      setResults(targets.map((shot) => ({ shotId: shot.shotId, status: 'pending' })))

      for (const shot of targets) {
        if (cancelledRef.current) break
        const started = performance.now()
        const renderer = createDomFrameRenderer({
          load: shot.load,
          width: 960,
          height: 540,
          fps: 30,
          durationInFrames: shot.durationInFrames,
        })
        try {
          // 取中段帧，比首帧更容易暴露布局问题
          const canvas = await renderer.renderFrame(Math.floor(shot.durationInFrames * 0.5))
          const ms = Math.round(performance.now() - started)
          let thumbnail: string | undefined
          try {
            thumbnail = canvas.toDataURL('image/jpeg', 0.6)
          } catch {
            // 跨域污染时拿不到缩略图，但渲染本身成功
          }
          setResults((prev) =>
            prev.map((item) =>
              item.shotId === shot.shotId ? { ...item, status: 'ok', ms, thumbnail } : item,
            ),
          )
        } catch (error) {
          setResults((prev) =>
            prev.map((item) =>
              item.shotId === shot.shotId
                ? {
                    ...item,
                    status: 'fail',
                    ms: Math.round(performance.now() - started),
                    message: error instanceof Error ? error.message : String(error),
                  }
                : item,
            ),
          )
        } finally {
          renderer.dispose()
        }
      }
      setRunning(false)
    },
    [],
  )

  useEffect(() => {
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const okCount = results.filter((item) => item.status === 'ok').length
  const failCount = results.filter((item) => item.status === 'fail').length

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui', fontSize: 13 }}>
      <h1 style={{ fontSize: 16, margin: '0 0 8px' }}>镜头渲染自检（开发专用）</h1>
      <p style={{ color: '#888', margin: '0 0 12px' }}>
        共 {SHOT_CATALOG.length} 个镜头。逐个渲染中段帧，检查导入、字体与纹理就绪。结果 {okCount} 通过 /{' '}
        {failCount} 失败。
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">全部（{SHOT_CATALOG.length}）</option>
          {SHOT_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}（{item.count}）
            </option>
          ))}
        </select>
        <button type="button" disabled={running} onClick={() => void run(category)}>
          {running ? '运行中…' : '开始检查'}
        </button>
        <button
          type="button"
          disabled={!running}
          onClick={() => {
            cancelledRef.current = true
          }}
        >
          中止
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {results.map((item) => (
          <div
            key={item.shotId}
            style={{
              border: `1px solid ${item.status === 'fail' ? '#b91c1c' : '#333'}`,
              borderRadius: 6,
              overflow: 'hidden',
              background: '#111',
              color: '#ddd',
            }}
          >
            {item.thumbnail ? (
              <img src={item.thumbnail} alt={item.shotId} style={{ width: '100%', display: 'block' }} />
            ) : (
              <div style={{ aspectRatio: '16/9', display: 'grid', placeItems: 'center', color: '#666' }}>
                {item.status === 'pending' ? '待检' : item.status === 'fail' ? '失败' : '无预览'}
              </div>
            )}
            <div style={{ padding: 6 }}>
              <div style={{ fontSize: 11, wordBreak: 'break-all' }}>{item.shotId}</div>
              <div style={{ fontSize: 10, color: '#888' }}>
                {item.status === 'ok' ? `${item.ms}ms` : item.status}
              </div>
              {item.message ? (
                <div style={{ fontSize: 10, color: '#f87171', marginTop: 2 }}>{item.message}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
