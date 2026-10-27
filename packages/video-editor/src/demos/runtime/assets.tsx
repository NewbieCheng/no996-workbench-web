/**
 * Remotion 兼容运行时 —— 资源与图片
 *
 * 关键职责：让光栅化管线知道"图片什么时候可以截帧"。
 * 参考项目 14 个 demo 依赖 staticFile 纹理，图片没加载完就截帧会得到空白。
 *
 * 实现方式：一个模块级 pending 计数器。Img 挂载时 +1、加载完成或失败时 -1，
 * 管线在截图前 await 全部归零。这比 Remotion 的 delayRender/continueRender 简单，
 * 但语义足够 —— 我们只关心"所有图片就绪"。
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** demos 的静态资源根：`staticFile('textures/live/x.png')` → BASE + 'demos/' + path */
const ASSET_BASE = (() => {
  const base =
    typeof import.meta !== 'undefined' && typeof import.meta.env?.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/'
  return base.endsWith('/') ? base : `${base}/`
})()

export function staticFile(path: string): string {
  const clean = path.replace(/^\/+/, '')
  return `${ASSET_BASE}demos/${clean}`
}

/* ───────────────────────── 图片就绪跟踪 ───────────────────────── */

let pendingImages = 0
const waiters = new Set<() => void>()

function beginLoad() {
  pendingImages++
}

function endLoad() {
  pendingImages = Math.max(0, pendingImages - 1)
  if (pendingImages === 0) {
    for (const resolve of waiters) resolve()
    waiters.clear()
  }
}

/** 管线调用：等待所有已挂载图片加载完成。返回 false 表示等待超时。 */
export async function waitForImages(timeoutMs = 8000): Promise<boolean> {
  if (pendingImages === 0) return true
  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      waiters.delete(onReady)
      clearTimeout(timer)
      resolve(ok)
    }
    const onReady = () => finish(true)
    waiters.add(onReady)
    const timer = setTimeout(() => finish(pendingImages === 0), timeoutMs)
    // 二次检查：等待期间可能已经全部就绪
    if (pendingImages === 0) finish(true)
  })
}

/** 仅供测试/调试：当前未完成的图片数。 */
export function pendingImageCount(): number {
  return pendingImages
}

/* ───────────────────────── Img ───────────────────────── */

export type ImgProps = {
  src: string
  style?: CSSProperties
  className?: string
  alt?: string
} & Omit<CSSProperties, 'style' | 'className'>

/**
 * 图像元素。与 `<img>` 的差别：
 *  - 挂载即登记 pending，加载完成/失败后注销，让管线能等到位；
 *  - 加载完成前保持 DOM 存在但视觉透明，避免布局跳动影响后续截帧。
 */
export function Img({ src, style, className, alt = '', ...rest }: ImgProps) {
  const [loaded, setLoaded] = useState(false)
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    beginLoad()
    let active = true
    const finish = () => {
      if (!active) return
      active = false
      endLoad()
    }

    // 已在缓存里的图片不会触发 onLoad，用 Image 探测一次
    const probe = new Image()
    probe.onload = () => {
      if (active) setLoaded(true)
      finish()
    }
    probe.onerror = () => finish()
    probe.src = src

    return () => {
      finish()
      probe.onload = null
      probe.onerror = null
    }
    // src 变化时重新跟踪
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        ...(rest as CSSProperties),
        ...style,
        opacity: loaded ? (style?.opacity ?? 1) : 0,
      }}
      draggable={false}
    />
  )
}

/* ───────────────────────── 音频（预留） ───────────────────────── */

/**
 * 参考项目 demo 未直接使用 `<Audio>`，音效全部由工作台时间轴另行排布。
 * 这里保留占位，避免后续 demo 引入时报 import 失败。
 */
export function Audio(_props: { src: string; volume?: number; startFrom?: number }): ReactNode {
  return null
}
