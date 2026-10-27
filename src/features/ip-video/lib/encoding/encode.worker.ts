import regularFont from '@pinhai/ali-fonts/fonts/AlibabaPuHuiTi-3-55-Regular.woff2?url'
import boldFont from '@pinhai/ali-fonts/fonts/AlibabaPuHuiTi-3-85-Bold.woff2?url'
import { OUTPUT_HEIGHT, OUTPUT_WIDTH, type TemplateProject } from '../template-project.ts'
import { detectEncoding } from './capabilities.ts'
import { encodeOffline } from './offline.ts'
import { supportsWorkerFont, throwIfAborted, type EncodingChoice } from './policy.ts'
import type { WorkerRequest, WorkerResponse } from './protocol.ts'

// Keep DOM and WebWorker lib declarations separate: this app compiles with lib DOM.
type EncodingWorkerScope = {
  fonts?: { add(face: FontFace): void; check(font: string, text?: string): boolean }
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage(message: WorkerResponse): void
  close(): void
}
const scope = globalThis as unknown as EncodingWorkerScope
const controller = new AbortController()
let prepared: { project: TemplateProject; canvas: OffscreenCanvas; context: OffscreenCanvasRenderingContext2D; choice: EncodingChoice } | undefined
let started = false

async function installFonts(project: TemplateProject): Promise<boolean> {
  if (typeof FontFace !== 'function' || !scope.fonts) return false
  if (![project.title, project.subtitle].filter(layer => layer.enabled).every(layer => supportsWorkerFont(layer.font, layer.weight))) return false
  const faces = await Promise.all([
    new FontFace('Alibaba PuHuiTi', `url("${regularFont}")`, { weight: '400' }).load(),
    new FontFace('Alibaba PuHuiTi', `url("${boldFont}")`, { weight: '700' }).load()
  ])
  for (const face of faces) scope.fonts.add(face)
  return scope.fonts.check('400 24px "Alibaba PuHuiTi"', '口播') && scope.fonts.check('700 24px "Alibaba PuHuiTi"', '口播')
}

async function receive(message: WorkerRequest): Promise<void> {
  if (message.type === 'cancel') { controller.abort(); return }
  if (message.type === 'prepare') {
    // All fallback decisions happen before receiving image/PCM ownership or starting encoders.
    try {
      if (typeof OffscreenCanvas !== 'function' || !await installFonts(message.project)) { scope.postMessage({ type: 'unavailable' }); return }
      const canvas = new OffscreenCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT)
      const context = canvas.getContext('2d', { alpha: false })
      const choice = await detectEncoding(message.audio, controller.signal)
      if (!context || !choice) { scope.postMessage({ type: 'unavailable' }); return }
      throwIfAborted(controller.signal)
      prepared = { canvas, context, choice, project: message.project }
      scope.postMessage({ type: 'ready', choice })
    } catch {
      scope.postMessage({ type: 'unavailable' })
    }
    return
  }
  if (!prepared || started) throw new Error('encodeFailed')
  started = true
  try {
    const blob = await encodeOffline({ ...prepared, pcm: message.pcm, image: message.image, signal: controller.signal, mainThread: false,
      onProgress: (progress, stage) => scope.postMessage({ type: 'progress', progress, stage }) })
    scope.postMessage({ type: 'done', blob })
  } finally {
    message.image.close()
    prepared = undefined
  }
}

scope.onmessage = event => {
  void receive(event.data).catch(error => {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'encodeFailed', name: error instanceof Error ? error.name : 'Error' })
  })
}
