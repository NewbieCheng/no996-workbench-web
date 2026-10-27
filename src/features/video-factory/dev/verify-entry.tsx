/**
 * 镜头渲染验证入口（开发专用独立页）
 *
 * 不走 React Router、不需要登录，直接把指定镜头渲染成 canvas 并挂到页面上。
 * 供 scripts/verify-shot-render.mjs 用真实浏览器驱动。
 *
 * 访问：/verify-shot.html
 */

import { createRoot } from 'react-dom/client'
import { SHOT_CATALOG } from '@no996/video-editor'
import { createDomFrameRenderer } from '@no996/video-editor/demos/pipeline/dom-frame-renderer.ts'

type Result = {
  shotId: string
  status: 'ok' | 'fail'
  ms: number
  width?: number
  height?: number
  /** 非空像素占比，用于识别「渲染成功但整幅空白」 */
  inkRatio?: number
  /** 内容横向分布宽度（0–0.5）：越大越说明画面依赖宽幅构图，竖屏 cover 会裁掉信息 */
  inkSpread?: number
  /** 缩略 PNG（base64，不带 data: 前缀）；仅供校准脚本存盘查看 */
  png?: string
  message?: string
}

/**
 * 统计画布非背景像素占比：能抓住「出帧但全黑/全空」这类静默失败。
 * 同时算 inkSpread（内容在横向上的分布宽度，0–0.5）：
 * 竖屏 cover 只保留中间 31.6% 的横向内容，spread 大的镜头裁完会丢信息，
 * 所以它直接决定 V.2 里一个镜头该走 cover 还是 fit。
 */
function measureInk(canvas: HTMLCanvasElement): { ink: number; spread: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { ink: 0, spread: 0 }
  const { width, height } = canvas
  const stepX = Math.max(1, Math.floor(width / 80))
  const stepY = Math.max(1, Math.floor(height / 45))
  let nonEmpty = 0
  let total = 0
  let sumX = 0
  let sumX2 = 0
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
      total++
      // 有透明度或亮度明显偏离纯黑，就算有内容
      if (a > 8 && (r > 6 || g > 6 || b > 6)) {
        nonEmpty++
        const nx = x / width
        sumX += nx
        sumX2 += nx * nx
      }
    }
  }
  if (!nonEmpty) return { ink: 0, spread: 0 }
  const mean = sumX / nonEmpty
  const variance = Math.max(0, sumX2 / nonEmpty - mean * mean)
  return { ink: nonEmpty / total, spread: Math.sqrt(variance) }
}

async function run(shotId: string, aspect: '16:9' | '9:16' = '16:9'): Promise<Result> {
  const shot = SHOT_CATALOG.find((item) => item.shotId === shotId)
  if (!shot) return { shotId, status: 'fail', ms: 0, message: '注册表里没有这个镜头' }

  const vertical = aspect === '9:16'
  const started = performance.now()
  const renderer = createDomFrameRenderer({
    load: shot.load,
    // 竖屏按 1080×1920 渲染，内容由 VerticalFrame 装进画布（register 里的 vertical 元数据决定 cover/fit/reflow）
    width: vertical ? 540 : 960,
    height: vertical ? 960 : 540,
    fps: 30,
    durationInFrames: shot.durationInFrames,
    vertical: vertical ? (shot.vertical ?? { mode: 'cover', focusX: 0.5, focusY: 0.5 }) : undefined,
  })
  try {
    const canvas = await renderer.renderFrame(Math.floor(shot.durationInFrames * 0.5))
    const measured = measureInk(canvas)
    return {
      shotId,
      status: 'ok',
      ms: Math.round(performance.now() - started),
      width: canvas.width,
      height: canvas.height,
      inkRatio: Math.round(measured.ink * 1000) / 1000,
      inkSpread: Math.round(measured.spread * 1000) / 1000,
      // 只在脚本要求存图时回传 base64，避免 151 帧把浏览器内存打爆
      png: (window as unknown as { __shotVerifyWantPng?: boolean }).__shotVerifyWantPng
        ? canvas.toDataURL('image/png').split(',')[1]
        : undefined,
    }
  } catch (error) {
    return {
      shotId,
      status: 'fail',
      ms: Math.round(performance.now() - started),
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    renderer.dispose()
  }
}

/**
 * 逐镜渲染并输出结果。脚本按 id 轮询 window.__shotVerifyResults。
 * 串行执行：并行会让渲染容器互相干扰，也无法定位问题。
 */
async function runAll(shotIds: string[], aspect: '16:9' | '9:16' = '16:9') {
  const results: Result[] = []
  for (const shotId of shotIds) {
    const result = await run(shotId, aspect)
    results.push(result)
    // 每出一条就更新一次，脚本可提前读到进度
    ;(window as unknown as { __shotVerifyResults: Result[] }).__shotVerifyResults = [...results]
  }
  ;(window as unknown as { __shotVerifyDone: boolean }).__shotVerifyDone = true
}

const root = document.getElementById('verify-root')
const fallbackIds = ['outro/grain-dissolve', 'opening/spotlight-hero-card']

type ColorCheck = {
  shotId: string
  ok: boolean
  themeRatio?: number
  primaryRatio?: number
  bgRatio?: number
  inkRatio?: number
  message?: string
}

function pixelDiffRatio(a: HTMLCanvasElement, b: HTMLCanvasElement): number {
  const ca = a.getContext('2d')
  const cb = b.getContext('2d')
  if (!ca || !cb || a.width !== b.width || a.height !== b.height) return 0
  const ba = ca.getImageData(0, 0, a.width, a.height).data
  const bb = cb.getImageData(0, 0, b.width, b.height).data
  let changed = 0
  for (let i = 0; i < ba.length; i += 4) {
    if (
      Math.abs(ba[i] - bb[i]) > 8 ||
      Math.abs(ba[i + 1] - bb[i + 1]) > 8 ||
      Math.abs(ba[i + 2] - bb[i + 2]) > 8
    ) {
      changed++
    }
  }
  return changed / (a.width * a.height)
}

/**
 * 改色生效抽查：同一镜头、同一帧，分别用默认 props / 预设主题 / 自定义主色渲染，
 * 比较像素差异比例。证明「检查器传进来的配色真的进了画面」，而不是只写进注册表。
 */
async function colorCheck(shotIds: string[]): Promise<ColorCheck[]> {
  const results: ColorCheck[] = []
  for (const shotId of shotIds) {
    const shot = SHOT_CATALOG.find((item) => item.shotId === shotId)
    if (!shot) {
      results.push({ shotId, ok: false, message: '注册表里没有这个镜头' })
      continue
    }
    const frame = Math.floor(shot.durationInFrames * 0.5)
    const make = (props: Record<string, unknown>) =>
      createDomFrameRenderer({
        load: shot.load,
        width: 960,
        height: 540,
        fps: 30,
        durationInFrames: shot.durationInFrames,
        props,
      })
    const renderWith = async (props: Record<string, unknown>) => {
      const renderer = make(props)
      try {
        return await renderer.renderFrame(frame)
      } finally {
        renderer.dispose()
      }
    }
    try {
      const base = await renderWith({})
      const theme = await renderWith({ colorTheme: 'ember' })
      const primary = await renderWith({ customPrimary: '#ff00aa' })
      const bg = await renderWith({ customBg: '#123456' })
      const ink = await renderWith({ customInk: '#ffdd00' })
      const ratioOf = (canvas: HTMLCanvasElement) => Math.round(pixelDiffRatio(base, canvas) * 1000) / 1000
      const themeRatio = ratioOf(theme)
      const primaryRatio = ratioOf(primary)
      const bgRatio = ratioOf(bg)
      const inkRatio = ratioOf(ink)
      const threshold = 0.005
      const ok = [themeRatio, primaryRatio, bgRatio, inkRatio].some((value) => value > threshold)
      const channels = [
        themeRatio > threshold ? '预设主题' : '',
        primaryRatio > threshold ? '主色' : '',
        bgRatio > threshold ? '底色' : '',
        inkRatio > threshold ? '墨色' : '',
      ]
        .filter(Boolean)
        .join(' / ')
      results.push({
        shotId,
        ok,
        themeRatio,
        primaryRatio,
        bgRatio,
        inkRatio,
        message: ok
          ? `${channels}已改变成片像素`
          : '传入配色后画面没有任何变化，配色键可能没接进渲染',
      })
    } catch (error) {
      results.push({
        shotId,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return results
}

declare global {
  interface Window {
    __shotVerifyResults?: Result[]
    __shotVerifyDone?: boolean
    __shotVerifyRun?: (ids: string[], aspect?: '16:9' | '9:16') => Promise<void>
    __shotVerifyColorCheck?: (ids: string[]) => Promise<ColorCheck[]>
  }
}

window.__shotVerifyRun = runAll
window.__shotVerifyColorCheck = colorCheck
;(window as unknown as { __shotVerifyAllIds: string[] }).__shotVerifyAllIds = SHOT_CATALOG.map(
  (shot) => shot.shotId,
)
;(window as unknown as { __shotVerifyReady: boolean }).__shotVerifyReady = true

addEventListener('DOMContentLoaded', () => {
  if (root) {
    root.textContent = `镜头渲染验证就绪（共 ${SHOT_CATALOG.length} 个镜头）。等待脚本驱动……`
  }
})

// 兜底：若脚本没驱动，自动跑两个代表镜头，便于人工直接打开看
if (location.search.includes('auto=1')) {
  void runAll(fallbackIds)
}

if (root) {
  const mount = document.createElement('div')
  root.appendChild(mount)
  createRoot(mount).render(
    <div style={{ fontFamily: 'system-ui', padding: 16, fontSize: 13 }}>
      <h1 style={{ fontSize: 15, margin: '0 0 8px' }}>镜头渲染验证（开发专用）</h1>
      <p style={{ color: '#666', margin: 0 }}>
        共 {SHOT_CATALOG.length} 个镜头。加 <code>?auto=1</code> 自动跑两个代表镜头。
      </p>
    </div>,
  )
}

/**
 * IP 侧复合验证：把动效镜头挂到 TemplateProject 的 shots 上，
 * 用真实的 TemplatePainter + ShotBackdropRenderer 画一帧，再统计非空像素。
 * 这是「IP 口播视频复用工厂动效」这条主张的唯一硬证据。
 */
async function runIpComposite(): Promise<{
  ok: boolean
  inkRatio: number
  message: string
}> {
  try {
    const [{ TemplatePainter }, { ShotBackdropRenderer }] = await Promise.all([
      import('../../ip-video/lib/template-renderer.ts'),
      import('../../ip-video/lib/shot-backdrop.ts'),
    ])
    const { createTemplateProject } = await import('../../ip-video/lib/template-project.ts')

    const project = createTemplateProject({
      templateId: 'scroll',
      script: '这是一次动效背景复用验证。',
      duration: 6,
      title: '动效背景验证',
    })
    // 挂一个明确能出画面的镜头
    project.shots = [{ shotId: 'opening/spotlight-hero-card', start: 0, end: 6, rate: 1, opacity: 1 }]

    const backdrop = new ShotBackdropRenderer({ width: 540, height: 960 })
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1920
    const context = canvas.getContext('2d')
    if (!context) return { ok: false, inkRatio: 0, message: '拿不到 2D 上下文' }

    const painter = new TemplatePainter(project)
    const frame = await backdrop.frameAt(project, 2)
    if (!frame) return { ok: false, inkRatio: 0, message: '动效背景没出帧' }
    painter.setBackdrop(frame)
    painter.draw(context, 2)

    // 只统计背景区域（避开文字），确认镜头真的铺上去了
    const { data } = context.getImageData(0, 0, 1080, 600)
    let nonEmpty = 0
    let total = 0
    for (let i = 0; i < data.length; i += 4 * 137) {
      total++
      if (data[i + 3] > 8 && (data[i] > 6 || data[i + 1] > 6 || data[i + 2] > 6)) nonEmpty++
    }
    backdrop.dispose()
    const ratio = total ? nonEmpty / total : 0
    return {
      ok: ratio > 0.005,
      inkRatio: Math.round(ratio * 1000) / 1000,
      message: ratio > 0.005 ? 'IP 模板已复合动效背景' : '背景区域几乎空白',
    }
  } catch (error) {
    return { ok: false, inkRatio: 0, message: error instanceof Error ? error.message : String(error) }
  }
}

;(window as unknown as { __shotVerifyIpComposite: typeof runIpComposite }).__shotVerifyIpComposite =
  runIpComposite

/**
 * 面板数据验证：把真实的镜头库与音效库面板挂到一个临时容器里，
 * 检查它们是否读到真实注册表数据（151 镜头 / 149 音效 / 16 分类）。
 * 这能抓住「注册表生成错了但页面长得像对的」这类问题。
 */
async function runPanelCheck(): Promise<{
  ok: boolean
  shotCards: number
  shotGroups: number
  sfxGroups: number
  sfxSearchPlaceholder: string
  message: string
}> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:300px;height:600px;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const [{ ShotLibraryPanel }, { SfxLibraryPanel }] = await Promise.all([
      import('../../../../packages/video-editor/src/panels/shots/ShotLibraryPanel.tsx'),
      import('../../../../packages/video-editor/src/panels/audio/SfxLibraryPanel.tsx'),
    ])
    root.render(
      <div>
        <div style={{ height: 600, overflow: 'auto' }}>
          <ShotLibraryPanel />
        </div>
        <div style={{ height: 600, overflow: 'auto' }}>
          <SfxLibraryPanel />
        </div>
      </div>,
    )
    // 等 React 提交与面板内部状态初始化
    await new Promise((resolve) => setTimeout(resolve, 1200))

    // 镜头库：每个镜头是一个 draggable 的 button；分组标题是带 aria-expanded 的 button
    const shotPanel = host.querySelector('[data-testid="shot-library-panel"]')
    const sfxPanel = host.querySelector('[data-testid="sfx-library-panel"]')
    const shotCards = shotPanel ? shotPanel.querySelectorAll('button[draggable="true"]').length : 0
    const shotGroups = shotPanel ? shotPanel.querySelectorAll('button[aria-expanded]').length : 0
    const sfxGroups = sfxPanel ? sfxPanel.querySelectorAll('button[aria-expanded]').length : 0
    const sfxSearch =
      (sfxPanel?.querySelector('input[type="search"]') as HTMLInputElement | null)?.placeholder ?? ''

    const ok = shotCards >= 100 && shotGroups === 10 && sfxGroups === 16 && sfxSearch.includes('149')
    return {
      ok,
      shotCards,
      shotGroups,
      sfxGroups,
      sfxSearchPlaceholder: sfxSearch,
      message: ok
        ? '面板已读到真实注册表数据'
        : `数据不符：镜头卡 ${shotCards}（应 ≥100）、镜头分组 ${shotGroups}（应 10）、音效分组 ${sfxGroups}（应 16）`,
    }
  } catch (error) {
    return {
      ok: false,
      shotCards: 0,
      shotGroups: 0,
      sfxGroups: 0,
      sfxSearchPlaceholder: '',
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    root.unmount()
    host.remove()
  }
}

;(window as unknown as { __shotVerifyPanels: typeof runPanelCheck }).__shotVerifyPanels = runPanelCheck

/**
 * 整页装配验证：把视频工厂的三栏主体（左库 + 中舞台 + 右属性 + 底部时间轴）
 * 用真实的 editor 实例完整挂载一次，确认所有面板都能协同渲染。
 * 这抓的是「单个面板都对，拼在一起就崩」这类问题。
 */
async function runStudioMount(): Promise<{
  ok: boolean
  panels: Record<string, boolean>
  shotClips: number
  message: string
}> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:1400px;height:900px;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const [
      { createEditor, createEmptyDocument },
      { EditorProvider },
      { PlayerSurface },
      { TimelinePanel },
      { InspectorPanel },
      { ShotLibraryPanel },
      { SfxLibraryPanel },
      { TimingPanel },
      { AudioEnvelopePanel },
      { InsertShotCommand },
    ] = await Promise.all([
      import('@no996/video-editor'),
      import('@no996/video-editor'),
      import('@no996/video-editor'),
      import('@no996/video-editor'),
      import('@no996/video-editor'),
      import('@no996/video-editor'),
      import('@no996/video-editor'),
      import('@no996/video-editor'),
      import('@no996/video-editor'),
      import('@no996/video-editor'),
    ])

    const doc = createEmptyDocument('proj-verify', '装配验证', 'verify-scope', '16:9')
    const editor = createEditor({ document: doc })

    // 插一个镜头，让时间轴上有内容
    const fps = doc.canvas.fps.num / doc.canvas.fps.den
    const shotTracks = doc.tracks.filter((track) => track.type === 'shot')
    if (shotTracks.length) {
      editor.executeCommand(
        new InsertShotCommand(
          {
            trackId: shotTracks[0].id,
            shotId: 'opening/spotlight-hero-card',
            sourceDurationFrames: 90,
            startUs: 0,
            canvasWidth: doc.canvas.width,
            canvasHeight: doc.canvas.height,
          },
          fps,
        ),
      )
    }

    root.render(
      <EditorProvider editor={editor}>
        <div style={{ display: 'grid', gridTemplateColumns: '256px 1fr 300px', height: 700 }}>
          <div>
            <ShotLibraryPanel />
          </div>
          <PlayerSurface editor={editor} playheadUs={0} isPlaying={false} onTogglePlay={() => {}} onSeek={() => {}} />
          <div>
            <InspectorPanel editor={editor} />
            <TimingPanel editor={editor} />
            <AudioEnvelopePanel editor={editor} />
          </div>
        </div>
        <div style={{ height: 200 }}>
          <TimelinePanel editor={editor} variant="full" playheadUs={0} />
        </div>
        <div style={{ height: 200, display: 'none' }}>
          <SfxLibraryPanel />
        </div>
      </EditorProvider>,
    )

    // 等各面板挂载完成
    await new Promise((resolve) => setTimeout(resolve, 2500))

    const panels = {
      shotLibrary: Boolean(host.querySelector('[data-testid="shot-library-panel"]')),
      sfxLibrary: Boolean(host.querySelector('[data-testid="sfx-library-panel"]')),
      timingPanel: Boolean(host.querySelector('[data-testid="timing-panel"]')),
      // 未选中音频片段时它渲染的是「请选中一个音频片段」提示，
      // 因此这里检查它是否挂载（提示或面板都算挂载成功）
      audioEnvelope: Boolean(
        host.querySelector('[data-testid="audio-envelope-panel"]') ??
          Array.from(host.querySelectorAll('div')).find((node) =>
            node.textContent?.includes('选中一个音频片段'),
          ),
      ),
      // 舞台是 canvas
      stage: host.querySelectorAll('canvas').length > 0,
    }
    const shotClips = editor.getDocument().tracks.flatMap((track) => track.elements).filter((el) => el.type === 'shot').length

    const ok =
      panels.shotLibrary && panels.sfxLibrary && panels.stage && panels.timingPanel && panels.audioEnvelope && shotClips === 1
    return {
      ok,
      panels,
      shotClips,
      message: ok
        ? '三栏主体全部挂载成功，镜头已入轨'
        : `挂载不完整：${JSON.stringify(panels)}，镜头数 ${shotClips}`,
    }
  } catch (error) {
    return {
      ok: false,
      panels: {},
      shotClips: 0,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    root.unmount()
    host.remove()
  }
}

;(window as unknown as { __shotVerifyStudio: typeof runStudioMount }).__shotVerifyStudio = runStudioMount

/**
 * 拖放链路验证：模拟一次真实的 DataTransfer drop，确认镜头真的落进了时间轴。
 * 这条链路之前是断的（镜头库能拖，但时间轴没有 drop 处理器）。
 */
async function runDropCheck(): Promise<{
  ok: boolean
  before: number
  after: number
  message: string
}> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:600px;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const { createEditor, createEmptyDocument, EditorProvider, TimelinePanel } = await import(
      '@no996/video-editor'
    )
    const doc = createEmptyDocument('proj-drop', '拖放验证', 'drop-scope', '16:9')
    const editor = createEditor({ document: doc })
    const countShots = () =>
      editor
        .getDocument()
        .tracks.flatMap((track) => track.elements)
        .filter((el) => el.type === 'shot').length

    const before = countShots()
    root.render(
      <EditorProvider editor={editor}>
        <div style={{ height: 400 }}>
          <TimelinePanel editor={editor} variant="full" playheadUs={0} />
        </div>
      </EditorProvider>,
    )
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // 找镜头轨的 drop 容器
    const shotTrackEl = Array.from(host.querySelectorAll('[data-testid^="timeline-track-"]')).find(
      (node) => {
        const id = node.getAttribute('data-testid') ?? ''
        const trackId = id.replace('timeline-track-', '')
        return editor.getDocument().tracks.find((t) => t.id === trackId)?.type === 'shot'
      },
    ) as HTMLElement | undefined

    if (!shotTrackEl) return { ok: false, before, after: before, message: '找不到镜头轨的 drop 容器' }

    // 构造一个真实 DataTransfer 并派发 drop
    const transfer = new DataTransfer()
    transfer.setData(
      'application/x-no996-shot',
      JSON.stringify({ shotId: 'opening/spotlight-hero-card', durationInFrames: 90 }),
    )
    const rect = shotTrackEl.getBoundingClientRect()
    shotTrackEl.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
        clientX: rect.left + 100,
        clientY: rect.top + 10,
      }),
    )
    shotTrackEl.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
        clientX: rect.left + 100,
        clientY: rect.top + 10,
      }),
    )

    await new Promise((resolve) => setTimeout(resolve, 800))
    const after = countShots()
    return {
      ok: after === before + 1,
      before,
      after,
      message: after === before + 1 ? '拖放成功，镜头已入轨' : `镜头数没有增加（${before} → ${after}）`,
    }
  } catch (error) {
    return {
      ok: false,
      before: 0,
      after: 0,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    root.unmount()
    host.remove()
  }
}

;(window as unknown as { __shotVerifyDrop: typeof runDropCheck }).__shotVerifyDrop = runDropCheck

/**
 * 导出带音频验证：真的跑一次 encodeVideo，把混好的 PCM 写进 MP4，
 * 再用 probe 读回来确认「音频轨存在」。
 *
 * 这是「导出的成片有声音」这条承诺的唯一硬证据 ——
 * 只看代码写了 addAudioTrack 是证明不了的（编码器可能静默忽略）。
 */
async function runExportAudioCheck(): Promise<{
  ok: boolean
  hasAudio: boolean
  videoBytes: number
  durationUs: number
  message: string
}> {
  try {
    const [{ MediabunnyMediaAdapter }, { mixDocumentAudio }, { createEditor, createEmptyDocument }] =
      await Promise.all([
        import('../../../../packages/video-editor/src/media/mediabunny-adapter.ts'),
        import('../../../../packages/video-editor/src/media/audio-mixer.ts'),
        import('@no996/video-editor'),
      ])

    if (typeof VideoEncoder !== 'function') {
      return { ok: false, hasAudio: false, videoBytes: 0, durationUs: 0, message: '浏览器不支持 WebCodecs，跳过' }
    }

    // 造一段 1 秒的 440Hz 正弦波作为音频源
    const sampleRate = 48_000
    const seconds = 1
    const length = sampleRate * seconds
    const left = new Float32Array(length)
    for (let i = 0; i < length; i++) left[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5
    const right = new Float32Array(left)
    const pcm = { channels: [left, right], length, sampleRate }

    // 造一个 1 秒、30fps、320x180 的纯色视频
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const ctx = canvas.getContext('2d')!
    const adapter = new MediabunnyMediaAdapter()

    const blob = await adapter.encodeVideo({
      width: 320,
      height: 180,
      frameRate: { num: 30, den: 1 },
      format: 'mp4',
      totalFrames: 30,
      pcm,
      renderFrame: async (frame: number) => {
        ctx.fillStyle = frame % 2 === 0 ? '#2f81f7' : '#0b0d10'
        ctx.fillRect(0, 0, 320, 180)
        ctx.fillStyle = '#ffffff'
        ctx.font = '24px sans-serif'
        ctx.fillText(`f${frame}`, 20, 100)
        return canvas
      },
    })

    const probe = await adapter.probe(blob)
    adapter.dispose()

    // 顺带确认 mixDocumentAudio 在无音频元素时返回静音 PCM（而不是 null）
    const emptyDoc = createEmptyDocument('proj-audio-check', '音频检查', 'audio-scope', '16:9')
    const silent = await mixDocumentAudio(emptyDoc, async () => null)
    const silentOk = silent.length > 0 && silent.channels.length === 2
    void createEditor

    const ok = probe.hasAudio && blob.size > 1000 && silentOk
    return {
      ok,
      hasAudio: probe.hasAudio,
      videoBytes: blob.size,
      durationUs: probe.durationUs,
      message: ok
        ? `成片 ${(blob.size / 1024).toFixed(0)}KB，音频轨已写入，静音回退正常`
        : `音频轨 ${probe.hasAudio ? '有' : '缺失'}，大小 ${blob.size}B，静音回退 ${silentOk ? '正常' : '异常'}`,
    }
  } catch (error) {
    return {
      ok: false,
      hasAudio: false,
      videoBytes: 0,
      durationUs: 0,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

;(window as unknown as { __shotVerifyExportAudio: typeof runExportAudioCheck }).__shotVerifyExportAudio =
  runExportAudioCheck

/**
 * 节拍检测验证。
 *
 * 用合成信号测：在 120 BPM 上生成干净的鼓点（每 0.5 秒一个短促噪声脉冲），
 * 检查算法能不能还原出 120 BPM 和正确的拍点数量。
 *
 * 这是纯算法，必须用「已知答案的输入」验证 —— 拿真实音乐测只能看「有没有输出」，
 * 看不出对不对。
 */
async function runBeatCheck(): Promise<{
  ok: boolean
  cases: Array<{ bpm: number; detected: number | null; beats: number; expectedBeats: number }>
  message: string
}> {
  try {
    const { analyzeBeats } = await import('../lib/beat-detect.ts')

    /** 合成一段「每 60/bpm 秒一次脉冲」的音频 */
    const makeBuffer = (bpm: number, seconds: number): AudioBuffer => {
      const sampleRate = 48_000
      const length = Math.round(sampleRate * seconds)
      const buffer = new AudioBuffer({ length, numberOfChannels: 1, sampleRate })
      const data = buffer.getChannelData(0)
      const period = 60 / bpm
      // 脉冲用 40ms 的衰减噪声，接近真实鼓点
      const pulseLength = Math.round(sampleRate * 0.04)
      for (let t = 0; t < seconds; t += period) {
        const start = Math.round(t * sampleRate)
        for (let i = 0; i < pulseLength && start + i < length; i++) {
          const decay = 1 - i / pulseLength
          // 确定性噪声（不用 Math.random），保证验证可复现
          const n = Math.sin(i * 12.9898) * 43758.5453
          data[start + i] += (n - Math.floor(n) - 0.5) * decay
        }
      }
      return buffer
    }

    const cases: Array<{ bpm: number; detected: number | null; beats: number; expectedBeats: number }> = []
    for (const bpm of [90, 120, 150]) {
      const seconds = 8
      const buffer = makeBuffer(bpm, seconds)
      const analysis = analyzeBeats(buffer)
      const expectedBeats = Math.floor(seconds / (60 / bpm)) + 1
      cases.push({
        bpm,
        detected: analysis ? analysis.bpm : null,
        beats: analysis ? analysis.beatsUs.length : 0,
        expectedBeats,
      })
    }

    // bpm 误差 3 以内、且拍点数量合理就算过
    const ok = cases.every(
      (item) =>
        item.detected !== null &&
        Math.abs(item.detected - item.bpm) <= 3 &&
        item.beats >= item.expectedBeats - 2,
    )
    return {
      ok,
      cases,
      message: ok
        ? '节拍检测在合成鼓点上复现了正确 BPM'
        : `检测结果不符：${cases.map((c) => `${c.bpm}→${c.detected}`).join(', ')}`,
    }
  } catch (error) {
    return {
      ok: false,
      cases: [],
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

;(window as unknown as { __shotVerifyBeats: typeof runBeatCheck }).__shotVerifyBeats = runBeatCheck

/**
 * 拖动 + 吸附验证。
 *
 * 之前片段只能调整头尾，**不能整体拖动**（MoveElementsCommand 只被键盘微调用到）。
 * 这里派发真实的 mousedown/mousemove/mouseup，检查片段位置是否真的变了，
 * 并且验证「一次拖动只产生一步撤销」。
 */
async function runDragCheck(): Promise<{
  ok: boolean
  before: number
  after: number
  undoSteps: number
  message: string
}> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:600px;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const { createEditor, createEmptyDocument, EditorProvider, TimelinePanel, InsertShotCommand } =
      await import('@no996/video-editor')
    const doc = createEmptyDocument('proj-drag', '拖动验证', 'drag-scope', '16:9')
    const editor = createEditor({ document: doc })
    const fps = doc.canvas.fps.num / doc.canvas.fps.den
    const shotTrack = doc.tracks.find((track) => track.type === 'shot')
    if (!shotTrack) return { ok: false, before: 0, after: 0, undoSteps: 0, message: '没有镜头轨' }

    editor.executeCommand(
      new InsertShotCommand(
        {
          trackId: shotTrack.id,
          shotId: 'opening/spotlight-hero-card',
          sourceDurationFrames: 30,
          startUs: 2_000_000,
          canvasWidth: doc.canvas.width,
          canvasHeight: doc.canvas.height,
        },
        fps,
      ),
    )

    root.render(
      <EditorProvider editor={editor}>
        <div style={{ height: 400 }}>
          <TimelinePanel editor={editor} variant="full" playheadUs={0} snapEnabled={false} />
        </div>
      </EditorProvider>,
    )
    await new Promise((resolve) => setTimeout(resolve, 1600))

    const clip = host.querySelector('[data-testid^="timeline-clip-"]') as HTMLElement | undefined
    if (!clip) return { ok: false, before: 0, after: 0, undoSteps: 0, message: '找不到片段元素' }

    const getStart = () =>
      editor
        .getDocument()
        .tracks.flatMap((track) => track.elements)
        .find((el) => el.type === 'shot')?.startUs ?? -1

    const before = getStart()
    const rect = clip.getBoundingClientRect()
    const startX = rect.left + rect.width / 2
    const startY = rect.top + rect.height / 2

    // 真实拖动：按下 → 移动 → 松手
    clip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: startX, clientY: startY, button: 0 }))
    await new Promise((resolve) => setTimeout(resolve, 60))
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: startX + 80, clientY: startY }))
    await new Promise((resolve) => setTimeout(resolve, 60))
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: startX + 80, clientY: startY }))
    await new Promise((resolve) => setTimeout(resolve, 400))

    const after = getStart()

    // 撤销一次应该回到原位（证明拖动只写了一步命令）
    editor.undo()
    await new Promise((resolve) => setTimeout(resolve, 200))
    const afterUndo = getStart()
    const undoSteps = Math.abs(afterUndo - before) < 1000 ? 1 : 2

    const moved = after > before + 100_000
    return {
      ok: moved && undoSteps === 1,
      before,
      after,
      undoSteps,
      message: !moved
        ? `片段没动（${before} → ${after}）`
        : undoSteps === 1
          ? '拖动生效，且一次撤销即回到原位'
          : '能拖动，但一次撤销回不到位',
    }
  } catch (error) {
    return { ok: false, before: 0, after: 0, undoSteps: 0, message: error instanceof Error ? error.message : String(error) }
  } finally {
    root.unmount()
    host.remove()
  }
}

;(window as unknown as { __shotVerifyDrag: typeof runDragCheck }).__shotVerifyDrag = runDragCheck

async function runTrimCheck(): Promise<{
  ok: boolean
  before: number
  after: number
  undoSteps: number
  message: string
}> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:600px;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const { createEditor, createEmptyDocument, EditorProvider, TimelinePanel, InsertShotCommand } =
      await import('@no996/video-editor')
    const doc = createEmptyDocument('proj-trim', '裁切验证', 'trim-scope', '16:9')
    const editor = createEditor({ document: doc })
    const fps = doc.canvas.fps.num / doc.canvas.fps.den
    const shotTrack = doc.tracks.find((track) => track.type === 'shot')
    if (!shotTrack) return { ok: false, before: 0, after: 0, undoSteps: 0, message: '没有镜头轨' }

    editor.executeCommand(
      new InsertShotCommand(
        {
          trackId: shotTrack.id,
          shotId: 'opening/spotlight-hero-card',
          sourceDurationFrames: 90,
          startUs: 0,
          canvasWidth: doc.canvas.width,
          canvasHeight: doc.canvas.height,
        },
        fps,
      ),
    )

    root.render(
      <EditorProvider editor={editor}>
        <div style={{ height: 400 }}>
          <TimelinePanel editor={editor} variant="full" playheadUs={0} snapEnabled={false} />
        </div>
      </EditorProvider>,
    )
    await new Promise((resolve) => setTimeout(resolve, 1600))

    const handle = host.querySelector('[data-testid="trim-right-handle"]') as HTMLElement | undefined
    if (!handle) return { ok: false, before: 0, after: 0, undoSteps: 0, message: '找不到右缘裁切把手' }

    const getDuration = () =>
      editor
        .getDocument()
        .tracks.flatMap((track) => track.elements)
        .find((el) => el.type === 'shot')?.durationUs ?? -1

    const before = getDuration()
    const rect = handle.getBoundingClientRect()
    const startX = rect.left + rect.width / 2
    const startY = rect.top + rect.height / 2

    handle.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: startX, clientY: startY, button: 0, pointerId: 1 }),
    )
    await new Promise((resolve) => setTimeout(resolve, 60))
    window.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX: startX + 80, clientY: startY, pointerId: 1 }),
    )
    await new Promise((resolve) => setTimeout(resolve, 60))
    window.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, clientX: startX + 80, clientY: startY, pointerId: 1 }),
    )
    await new Promise((resolve) => setTimeout(resolve, 400))

    const after = getDuration()
    editor.undo()
    await new Promise((resolve) => setTimeout(resolve, 200))
    const afterUndo = getDuration()
    const undoSteps = Math.abs(afterUndo - before) < 1000 ? 1 : 2

    const extended = after > before + 100_000
    return {
      ok: extended && undoSteps === 1,
      before,
      after,
      undoSteps,
      message: !extended
        ? `时长未变（${before} → ${after}）`
        : undoSteps === 1
          ? '裁切生效，且一次撤销即恢复'
          : '能裁切，但一次撤销回不到位',
    }
  } catch (error) {
    return { ok: false, before: 0, after: 0, undoSteps: 0, message: error instanceof Error ? error.message : String(error) }
  } finally {
    root.unmount()
    host.remove()
  }
}

;(window as unknown as { __shotVerifyTrim: typeof runTrimCheck }).__shotVerifyTrim = runTrimCheck

/**
 * 配音链路验证（不依赖真实后端）。
 *
 * 用一个假的 actions/repo 走完 synthesizeVoice 的完整状态机：
 *   入队 → 轮询到 succeeded → 取回 Blob
 * 并验证失败路径（任务 failed 时必须抛错，不能静默返回空音频）。
 *
 * 真实 TTS 需要登录后端，无法在验证页里跑；但状态机本身是纯逻辑，
 * 用假实现可以确定性地测出「接线对不对、失败会不会被吞」。
 */
async function runVoiceCheck(): Promise<{
  ok: boolean
  steps: string[]
  message: string
}> {
  try {
    const { synthesizeVoice, estimateSpeechSeconds } = await import('../lib/synthesize-voice.ts')
    const steps: string[] = []

    // 造一个 0.2 秒的 WAV，作为「TTS 返回的音频」
    const sampleRate = 8000
    const samples = Math.round(sampleRate * 0.2)
    const wav = new Uint8Array(44 + samples * 2)
    const view = new DataView(wav.buffer)
    const writeStr = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i++) wav[offset + i] = text.charCodeAt(i)
    }
    writeStr(0, 'RIFF')
    view.setUint32(4, 36 + samples * 2, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeStr(36, 'data')
    view.setUint32(40, samples * 2, true)
    const audioBlob = new Blob([wav], { type: 'audio/wav' })
    const audioUrl = URL.createObjectURL(audioBlob)

    let polls = 0
    const actions = {
      enqueueIPVideoAudio: async () => {
        steps.push('enqueue')
        return 'task-fake-1'
      },
      getVoicePlaybackUrl: async () => {
        steps.push('url')
        return audioUrl
      },
      cancelTask: async () => {
        steps.push('cancel')
      },
    }
    // 前两次 queued，第三次 succeeded —— 模拟真实轮询
    const getTask = async (taskId: string) => {
      polls++
      steps.push(`poll${polls}`)
      const status = polls < 3 ? 'queued' : 'succeeded'
      return {
        id: taskId,
        ownerUserId: 1,
        kind: 'ip_video_audio',
        status,
        title: 't',
        route: '/x',
        createdAt: Date.now(),
        payloadId: 'p',
      } as never
    }

    const blob = await synthesizeVoice(
      { text: '测试文案', voiceId: 'v1', voiceLabel: '音色一', speed: 1 },
      actions,
      { getTask, pollIntervalMs: 30 },
    )
    const successOk = blob.size > 40
    steps.push(`blob:${blob.size}`)

    // 失败路径：任务 failed 必须抛错，不能返回空音频
    let failedThrew = false
    try {
      await synthesizeVoice(
        { text: '测试文案', voiceId: 'v1', voiceLabel: '音色一', speed: 1 },
        { ...actions, enqueueIPVideoAudio: async () => 'task-fake-2' },
        {
          getTask: async (taskId) =>
            ({
              id: taskId,
              ownerUserId: 1,
              kind: 'ip_video_audio',
              status: 'failed',
              errorMessage: '余额不足',
              title: 't',
              route: '/x',
              createdAt: Date.now(),
              payloadId: 'p',
            }) as never,
          pollIntervalMs: 30,
        },
      )
    } catch (error) {
      failedThrew = error instanceof Error && error.message.includes('余额不足')
      steps.push(`failed:${failedThrew ? 'threw' : 'wrong-message'}`)
    }

    // 取消路径：abort 时必须调 cancelTask 停了后台任务（避免继续计费）
    const controller = new AbortController()
    let cancelled = false
    const cancelPromise = synthesizeVoice(
      { text: '测试文案', voiceId: 'v1', voiceLabel: '音色一', speed: 1 },
      { ...actions, enqueueIPVideoAudio: async () => 'task-fake-3' },
      { getTask, pollIntervalMs: 2000, signal: controller.signal },
    ).catch(() => {
      cancelled = true
    })
    await new Promise((resolve) => setTimeout(resolve, 100))
    controller.abort()
    await cancelPromise
    const cancelOk = cancelled && steps.includes('cancel')

    URL.revokeObjectURL(audioUrl)

    const estimate = estimateSpeechSeconds('十个字的测试文案内容', 1)
    const estimateOk = estimate > 1 && estimate < 3

    const ok = successOk && failedThrew && cancelOk && estimateOk
    return {
      ok,
      steps,
      message: ok
        ? '入队 / 轮询 / 取回 / 失败抛出 / 取消停任务 全部正确'
        : `接线不完整：blob=${successOk} failedThrew=${failedThrew} cancel=${cancelOk} estimate=${estimateOk}`,
    }
  } catch (error) {
    return { ok: false, steps: [], message: error instanceof Error ? error.message : String(error) }
  }
}

;(window as unknown as { __shotVerifyVoice: typeof runVoiceCheck }).__shotVerifyVoice = runVoiceCheck

/**
 * 新增界面验证：IP 组装面板是否真的嵌入了镜头库、向导三步是否可达。
 *
 * 这两处是按要求新改的界面，之前从未在浏览器里跑过 ——
 * 单测「函数被调用」证明不了「面板里真的有 151 张卡」。
 */
async function runNewUiCheck(): Promise<{
  ok: boolean
  assemblyShotCards: number
  assemblyHasStyleSelect: boolean
  wizardSteps: number
  wizardVoiceControls: boolean
  message: string
}> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:600px;height:900px;'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const [{ AssemblyControlPanel }, { QuickAssemblyWizard }, { createEditor, createEmptyDocument }] =
      await Promise.all([
        import('../../ip-video/components/AssemblyControlPanel.tsx'),
        import('../QuickAssemblyWizard.tsx'),
        import('@no996/video-editor'),
      ])

    const doc = createEmptyDocument('proj-ui', '界面验证', 'ui-scope', '9:16')
    const editor = createEditor({ document: doc })

    root.render(
      <div>
        <AssemblyControlPanel
          currentStyleId="style.knowledge-editorial"
          currentLayoutId="layout.type-led"
          onStyleChange={() => {}}
          onLayoutChange={() => {}}
          onApplyAssembly={() => {}}
          onPickShot={() => {}}
          shotCount={2}
        />
        <QuickAssemblyWizard
          editor={editor}
          doc={doc}
          voices={[
            { id: 'v1', label: '音色一' },
            { id: 'v2', label: '音色二' },
          ]}
          voiceActions={{
            enqueueIPVideoAudio: async () => 't',
            getVoicePlaybackUrl: async () => '',
            cancelTask: async () => {},
          }}
          getTask={async () => null}
          saveAssetBlob={async () => {}}
          onDone={() => {}}
          onClose={() => {}}
        />
      </div>,
    )
    await new Promise((resolve) => setTimeout(resolve, 1800))

    // 组装面板：镜头库卡片 + 原有排版下拉都应在
    const assemblyShotCards = host.querySelectorAll(
      '[aria-label="动效镜头库"] button[draggable="true"]',
    ).length
    const assemblyHasStyleSelect = Boolean(host.querySelector('#ipv-style')) &&
      Boolean(host.querySelector('#ipv-layout'))

    // 向导：步骤条应有三步；进到第三步应能看到配音控件
    const wizardSteps = host.querySelectorAll('.vf-wizard__steps li').length
    let wizardVoiceControls = false
    const nextButtons = Array.from(host.querySelectorAll('button')).filter((b) =>
      (b.textContent ?? '').includes('下一步'),
    )
    // 让向导走到第三步：先填文案，再连点两次「下一步」
    const textarea = host.querySelector('#vf-script') as HTMLTextAreaElement | null
    if (textarea) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set
      setter?.call(textarea, '这是一段用于验证向导第三步的测试文案，需要足够长才会切出分段。')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 400))

      for (let i = 0; i < 2; i++) {
        const btn = Array.from(host.querySelectorAll('button')).find((b) =>
          (b.textContent ?? '').trim() === '下一步',
        )
        if (btn) {
          ;(btn as HTMLButtonElement).click()
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
      wizardVoiceControls =
        Boolean(host.querySelector('#vf-voice')) || host.textContent?.includes('同时生成配音') === true
    }
    void nextButtons

    const ok =
      assemblyShotCards >= 100 &&
      assemblyHasStyleSelect &&
      wizardSteps === 3 &&
      wizardVoiceControls
    return {
      ok,
      assemblyShotCards,
      assemblyHasStyleSelect,
      wizardSteps,
      wizardVoiceControls,
      message: ok
        ? 'IP 组装面板已含镜头库且保留排版下拉；向导三步可达并带配音控件'
        : `不符：镜头卡 ${assemblyShotCards}、排版下拉 ${assemblyHasStyleSelect}、步骤 ${wizardSteps}、配音控件 ${wizardVoiceControls}`,
    }
  } catch (error) {
    return {
      ok: false,
      assemblyShotCards: 0,
      assemblyHasStyleSelect: false,
      wizardSteps: 0,
      wizardVoiceControls: false,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    root.unmount()
    host.remove()
  }
}

;(window as unknown as { __shotVerifyNewUi: typeof runNewUiCheck }).__shotVerifyNewUi = runNewUiCheck

/**
 * 真实入队验证：走 IndexedDB 仓储，确认 ip_video_audio 任务真的被创建。
 *
 * 前面的 __shotVerifyVoice 用的是假 actions，只能证明状态机对不对；
 * 这里证明「enqueueIPVideoAudio 这个真实入口」在本机确实写得进去 ——
 * 否则用户点「生成配音」会静默什么都没发生。
 *
 * 注意：这里**不会**真正调供应商 TTS（那需要登录态与计费），
 * 只验证任务落库与 payload 内容；执行器分支与 voice_tts 共用，已在生产使用。
 */
async function runVoiceEnqueueCheck(): Promise<{
  ok: boolean
  taskId: string
  kind: string
  status: string
  textOk: boolean
  speedOk: boolean
  message: string
}> {
  try {
    const { createIndexedDbWorkbenchTaskRepository } = await import(
      '../../../services/workbench-tasks/index.ts'
    )
    const repo = createIndexedDbWorkbenchTaskRepository()
    await repo.ensureMigrated()

    const ownerUserId = 987654
    const job = await repo.createIPVideoAudioJob(ownerUserId, {
      text: '这是用于验证入队链路的测试文案，需要超过二十个字才能通过仓储校验。',
      voiceId: 'longanlingxin',
      voiceLabel: '龙安灵心（女声）',
      speed: 1.1,
      templateId: 'video-factory',
    })

    const payload = await repo.getPayload(job.payloadId)
    const data = payload?.data as { text?: string; speed?: number } | undefined
    const listed = await repo.listJobsForUser(ownerUserId)
    const found = listed.some((item) => item.id === job.id)

    // 清理，避免污染真实任务的 IndexedDB
    await repo.deleteJob(job.id)

    const textOk = data?.text === '这是用于验证入队链路的测试文案，需要超过二十个字才能通过仓储校验。'
    const speedOk = data?.speed === 1.1
    const ok = job.kind === 'ip_video_audio' && job.status === 'queued' && found && textOk && speedOk
    return {
      ok,
      taskId: job.id,
      kind: job.kind,
      status: job.status,
      textOk,
      speedOk,
      message: ok
        ? 'ip_video_audio 任务已真实落库，payload 文案与语速正确，已清理'
        : `不符：kind=${job.kind} status=${job.status} found=${found} text=${textOk} speed=${speedOk}`,
    }
  } catch (error) {
    return {
      ok: false,
      taskId: '',
      kind: '',
      status: '',
      textOk: false,
      speedOk: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

;(window as unknown as { __shotVerifyVoiceEnqueue: typeof runVoiceEnqueueCheck }).__shotVerifyVoiceEnqueue =
  runVoiceEnqueueCheck
