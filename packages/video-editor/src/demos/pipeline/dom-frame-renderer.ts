/**
 * DOM 帧渲染管线
 *
 * 把「给定帧号的 React 组件」光栅化成 Canvas，供预览与导出共用。
 * 参考项目 152 个 demo 的全部视觉表现（CSS 阴影 / 渐变 / 混合模式 / SVG 滤镜）
 * 都靠这条管线保留 —— 这也是不采用 Canvas2D 重写的根本原因。
 *
 * 关键时序（顺序错了就会截到空白或错字）：
 *   1. 容器挂载并确定尺寸
 *   2. 渲染该帧
 *   3. 等 document.fonts.ready     ← 否则首帧字形错乱
 *   4. 等所有 <Img> 就绪            ← 否则纹理空白
 *   5. 等一帧 rAF                   ← 否则样式未提交
 *   6. htmlToImage.toCanvas
 */

import { createRoot, type Root } from 'react-dom/client'
import { createElement, type ComponentType } from 'react'
import { toCanvas, getFontEmbedCSS } from 'html-to-image'
import { FrameProvider } from '../runtime/frame-context.tsx'
import { waitForImages } from '../runtime/assets.tsx'
import { resetRenderGate, waitForRenderGate } from '../runtime/render-gate.ts'
import { VerticalFrame } from '../shots/_fixtures/VerticalFrame.tsx'

export type DomFrameRendererOptions = {
  /** 懒加载镜头组件 */
  load: () => Promise<ComponentType<Record<string, unknown>>>
  width: number
  height: number
  fps: number
  durationInFrames: number
  /** 传给镜头组件的 props（槽位 / 文案覆盖） */
  props?: Record<string, unknown>
  /**
   * 竖屏构图（V 阶段）。给了就按 VerticalFrame 把 1920×1080 内容装进 width×height 画布；
   * 不给 = 原样渲染（横屏）。
   */
  vertical?: { mode: 'cover' | 'fit' | 'reflow'; focusX: number; focusY: number }
}

export type DomFrameRenderer = {
  renderFrame(frame: number): Promise<HTMLCanvasElement>
  dispose(): void
}

/** 等一次浏览器绘制完成（样式提交）。 */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0)
      return
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** Match html-to-image's family selection and include the font rules' source URLs. */
function fontEmbeddingIdentity(stage: HTMLDivElement): string | undefined {
  const normalize = (family: string) => family.trim().replace(/["']/g, '')
  const families = new Set<string>()
  const collect = (node: HTMLElement) => {
    const family = node.style.fontFamily || getComputedStyle(node).fontFamily
    family.split(',').forEach(value => families.add(normalize(value)))
    for (const child of Array.from(node.children)) if (child instanceof HTMLElement) collect(child)
  }
  collect(stage)
  const rules: string[] = []
  const visited = new Set<CSSStyleSheet>()
  const readSheet = (sheet: CSSStyleSheet): void => {
    if (visited.has(sheet)) return
    visited.add(sheet)
    readRules(sheet.cssRules, sheet.href)
  }
  const readRules = (list: CSSRuleList, href: string | null): void => {
    for (const rule of Array.from(list)) {
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        const fontRule = rule as CSSFontFaceRule
        if (families.has(normalize(fontRule.style.fontFamily))) rules.push(JSON.stringify([href, fontRule.cssText]))
      } else if (rule.type === CSSRule.IMPORT_RULE) {
        const imported = (rule as CSSImportRule).styleSheet
        if (imported) readSheet(imported)
      } else if ('cssRules' in rule) {
        readRules((rule as CSSGroupingRule).cssRules, href)
      }
    }
  }
  try {
    for (const sheet of Array.from(stage.ownerDocument.styleSheets)) readSheet(sheet)
  } catch {
    // Unreadable external styles cannot form a reliable cache identity.
    return undefined
  }
  return JSON.stringify([[...families].sort(), rules])
}

async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('镜头字体加载超时，请检查本地字体资源。')), 20_000) }),
    ])
  } finally { if (timer !== undefined) clearTimeout(timer) }
}

export function createDomFrameRenderer(options: DomFrameRendererOptions): DomFrameRenderer {
  const { load, width, height, fps, durationInFrames, props, vertical } = options

  let host: HTMLDivElement | null = null
  let stage: HTMLDivElement | null = null
  let root: Root | null = null
  let componentPromise: Promise<ComponentType<Record<string, unknown>>> | null = null
  let disposed = false
  let fontCssCache: { key: string; value: Promise<string> } | undefined
  /** foreignObject does not inherit document fonts; cache only this renderer's actual font set. */
  function embeddedFonts(node: HTMLDivElement): Promise<string> {
    const key = fontEmbeddingIdentity(node)
    if (key === undefined) return getFontEmbedCSS(node, { preferredFontFormat: 'woff2' })
    if (!fontCssCache || fontCssCache.key !== key) {
      const value = getFontEmbedCSS(node, { preferredFontFormat: 'woff2' })
      fontCssCache = { key, value }
      void value.catch(() => { if (fontCssCache?.value === value) fontCssCache = undefined })
    }
    return fontCssCache.value
  }
  /** 串行队列：同一时刻只渲染一帧，避免 React 并发渲染互相打断 */
  let queue: Promise<unknown> = Promise.resolve()

  function ensureMounted() {
    if (host && stage && root) return
    host = document.createElement('div')
    host.setAttribute('data-demo-frame-host', '')
    // 必须真实可见地参与布局，否则 html-to-image 拿不到正确尺寸；
    // 移出视口而不是 display:none。
    host.style.cssText = [
      'position:fixed',
      'left:-100000px',
      'top:0',
      `width:${width}px`,
      `height:${height}px`,
      'overflow:hidden',
      'pointer-events:none',
      'contain:layout style size',
    ].join(';')

    stage = document.createElement('div')
    stage.style.cssText = `position:relative;width:${width}px;height:${height}px;overflow:hidden;background:#000;`
    host.appendChild(stage)
    document.body.appendChild(host)
    root = createRoot(stage)
  }

  async function renderOnce(frame: number): Promise<HTMLCanvasElement> {
    if (disposed) throw new Error('DomFrameRenderer 已释放')
    ensureMounted()
    if (!componentPromise) componentPromise = load()
    const Shot = await componentPromise
    if (disposed) throw new Error('DomFrameRenderer 已释放')

    // 每帧开始前清掉上一帧遗留的闸门：有的 demo 只在挂载时 delayRender 一次，
    // 若不清，第二帧就会一直等一个永远不会再关闭的门。
    resetRenderGate()

    root!.render(
      createElement(FrameProvider, {
        frame,
        durationInFrames,
        fps,
        // cover / fit 模式下镜头仍按 1920×1080 逻辑空间作画（VerticalFrame 负责装进竖屏画布），
        // 所以 useVideoConfig() 必须报告内容尺寸；reflow 变体才需要真实竖屏尺寸。
        width: vertical && vertical.mode !== 'reflow' ? 1920 : width,
        height: vertical && vertical.mode !== 'reflow' ? 1080 : height,
        props: props ?? {},
        children: vertical
          ? createElement(
              VerticalFrame,
              {
                mode: vertical.mode,
                focusX: vertical.focusX,
                focusY: vertical.focusY,
                width,
                height,
                children: createElement(Shot, props ?? {}),
              },
            )
          : createElement(Shot, props ?? {}),
      }),
    )

    await nextPaint()
    await waitForFonts()
    await waitForImages()
    // 等 demo 自己量完 DOM（如测量文本宽度）；顺序必须在图片之后、截图之前
    await waitForRenderGate()
    await nextPaint()

    if (!stage) throw new Error('渲染容器丢失')
    const canvas = await toCanvas(stage, {
      width,
      height,
      // 必须为 1：否则会按设备 DPR 放大，导出尺寸与工程画布不符
      pixelRatio: 1,
      // 每帧带时间戳会让图片反复重新请求，性能崩溃
      cacheBust: false,
      backgroundColor: undefined,
      fontEmbedCSS: await embeddedFonts(stage),
    })
    return canvas
  }

  return {
    renderFrame(frame: number) {
      // 串行化，避免并发渲染
      const task = queue.then(() => renderOnce(frame))
      queue = task.catch(() => undefined)
      return task
    },
    dispose() {
      if (disposed) return
      disposed = true
      try {
        root?.unmount()
      } catch {
        // 卸载期的 React 报错不应阻断清理
      }
      root = null
      fontCssCache = undefined
      if (host?.parentNode) host.parentNode.removeChild(host)
      host = null
      stage = null
    },
  }
}
