import { OUTPUT_HEIGHT, OUTPUT_WIDTH, validateTemplateProject, type TemplateProject } from '../template-project.ts'
import { loadTemplateFonts, loadTemplateImage } from '../template-renderer.ts'
import { decodeAudioPCM, envelopeFromPCM } from './audio.ts'
import { detectEncoding, type AudioShape } from './capabilities.ts'
import { encodeOffline } from './offline.ts'
import { MAX_BYTES, abortable, resolveDuration, supportsWorkerFont, throwIfAborted, type EncodingChoice, type PCM } from './policy.ts'
import type { WorkerRequest, WorkerResponse } from './protocol.ts'

export { analyzeAudioEnvelope } from './audio.ts'
export type EncodeTemplateInput = {
  project: TemplateProject
  cover: Blob
  audio?: Blob
  signal?: AbortSignal
  onProgress?: (progress: number, stage: string) => void
  onMode?: (mode: 'worker' | 'offline' | 'realtime', mime: string) => void
}
type PreparedWorker = { worker: Worker; choice: EncodingChoice }

async function prepareWorker(project: TemplateProject, audio: AudioShape | undefined, signal?: AbortSignal): Promise<PreparedWorker | null> {
  throwIfAborted(signal)
  if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function' || ![project.title, project.subtitle].filter(layer => layer.enabled).every(layer => supportsWorkerFont(layer.font, layer.weight))) return null
  let worker: Worker
  try { worker = new Worker(new URL('./encode.worker.ts', import.meta.url), { type: 'module', name: 'ip-video-encoder' }) } catch { return null }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(null), 30_000)
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
    }
    const finish = (result: PreparedWorker | null) => {
      cleanup()
      if (!result) worker.terminate()
      resolve(result)
    }
    const cancel = () => {
      cleanup(); worker.terminate()
      reject(new DOMException('Export canceled', 'AbortError'))
    }
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.type === 'ready') finish({ worker, choice: event.data.choice })
      else if (event.data.type === 'unavailable' || event.data.type === 'error') finish(null)
    }
    worker.onerror = event => { event.preventDefault(); finish(null) }
    worker.onmessageerror = () => finish(null)
    signal?.addEventListener('abort', cancel, { once: true })
    if (signal?.aborted) { cancel(); return }
    const request: WorkerRequest = { type: 'prepare', project, audio }
    try { worker.postMessage(request) } catch { finish(null) }
  })
}

function runWorker(prepared: PreparedWorker, image: ImageBitmap, pcm: PCM | undefined, input: EncodeTemplateInput): Promise<Blob> {
  const { worker } = prepared
  throwIfAborted(input.signal)
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      input.signal?.removeEventListener('abort', cancel)
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
    }
    const fail = (error: Error) => { cleanup(); reject(error) }
    const cancel = () => {
      // Give output.cancel a short opportunity to close encoders; terminate remains bounded.
      try { worker.postMessage({ type: 'cancel' } satisfies WorkerRequest) } catch { /* already terminated */ }
      fail(new DOMException('Export canceled', 'AbortError'))
    }
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      if (message.type === 'progress') {
        try { input.onProgress?.(message.progress, message.stage) } catch (error) { fail(error instanceof Error ? error : new Error('encodeFailed')) }
      }
      else if (message.type === 'done') { cleanup(); resolve(message.blob) }
      else if (message.type === 'error') {
        const error = new Error(message.message); error.name = message.name; fail(error)
      } else if (message.type === 'unavailable') fail(new Error('encodeFailed'))
    }
    worker.onerror = event => { event.preventDefault(); fail(new Error(event.message || 'encodeFailed')) }
    worker.onmessageerror = () => fail(new Error('encodeFailed'))
    input.signal?.addEventListener('abort', cancel, { once: true })
    if (input.signal?.aborted) { cancel(); return }
    const transfer: Transferable[] = [image, ...(pcm?.channels.map(channel => channel.buffer) ?? [])]
    const request: WorkerRequest = { type: 'start', image, pcm }
    // Once start is sent, every error is a real export failure, never a realtime fallback.
    try { worker.postMessage(request, transfer) } catch (error) { fail(error instanceof Error ? error : new Error('encodeFailed')) }
  })
}

/** null means preflight found no offline path. The caller alone owns realtime fallback. */
export async function encodeTemplate(input: EncodeTemplateInput): Promise<Blob | null> {
  const { signal } = input
  throwIfAborted(signal)
  const snapshot = structuredClone(input.project)
  validateTemplateProject(snapshot)
  if (!input.cover.size || input.cover.size + (input.audio?.size ?? 0) > MAX_BYTES) throw new Error('exportTooLarge')
  if (typeof document === 'undefined' || typeof globalThis.VideoFrame !== 'function' || typeof globalThis.VideoEncoder !== 'function' || typeof globalThis.createImageBitmap !== 'function') return null
  if (input.audio && !globalThis.OfflineAudioContext && !globalThis.AudioContext) return null
  input.onProgress?.(0, 'prepareStage')
  const pcm = input.audio ? await decodeAudioPCM(input.audio, signal) : undefined
  const duration = resolveDuration(snapshot.duration, pcm ? pcm.length / pcm.sampleRate : undefined)
  input.onProgress?.(5, 'prepareStage')
  const envelope = pcm ? await envelopeFromPCM(pcm, signal) : snapshot.audioEnvelope
  // Work on a snapshot. Captions are never retimed or silently regenerated.
  const project: TemplateProject = { ...snapshot, duration, audioEnvelope: envelope }
  input.onProgress?.(10, 'subtitleStage')
  let prepared: PreparedWorker | null = null
  let image: ImageBitmap | undefined
  let canvas: HTMLCanvasElement | undefined
  try {
    prepared = await prepareWorker(project, pcm ? { sampleRate: pcm.sampleRate, numberOfChannels: pcm.channels.length } : undefined, signal)
    throwIfAborted(signal)
    const choice = prepared?.choice ?? await detectEncoding(pcm ? { sampleRate: pcm.sampleRate, numberOfChannels: pcm.channels.length } : undefined, signal)
    if (!choice) return null
    let context: CanvasRenderingContext2D | null = null
    if (!prepared) {
      canvas = document.createElement('canvas')
      canvas.width = OUTPUT_WIDTH; canvas.height = OUTPUT_HEIGHT
      context = canvas.getContext('2d', { alpha: false })
      if (!context) return null
      await abortable(loadTemplateFonts(project), signal)
    }
    const loadingImage = loadTemplateImage(input.cover, signal)
    try { image = await abortable(loadingImage, signal) } catch (error) {
      // createImageBitmap cannot be canceled; close a result that arrives after the abort race.
      void loadingImage.then(bitmap => bitmap.close(), () => {})
      throw error
    }
    throwIfAborted(signal)
    if (!image.width || !image.height || image.width * image.height > 40_000_000) throw new Error('invalidImage')
    input.onProgress?.(15, 'encodeStage')
    input.onMode?.(prepared ? 'worker' : 'offline', choice.mime)
    if (prepared) return await runWorker(prepared, image, pcm, input)
    if (!canvas || !context) throw new Error('encodeFailed')
    return await encodeOffline({ project, pcm, image, choice, signal, canvas, context, mainThread: true, onProgress: input.onProgress })
  } finally {
    image?.close()
    if (canvas) { canvas.width = 1; canvas.height = 1 }
    if (prepared) {
      const worker = prepared.worker
      // Browser suspension/closing still interrupts export; this is not a background service.
      if (signal?.aborted) setTimeout(() => worker.terminate(), 100)
      else worker.terminate()
    }
  }
}
