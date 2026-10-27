import type { TemplateProject } from '../template-project.ts'
import type { AudioShape } from './capabilities.ts'
import type { EncodingChoice, PCM } from './policy.ts'

export type WorkerRequest =
  | { type: 'prepare'; project: TemplateProject; audio?: AudioShape }
  | { type: 'start'; image: ImageBitmap; pcm?: PCM }
  | { type: 'cancel' }
export type WorkerResponse =
  | { type: 'ready'; choice: EncodingChoice }
  | { type: 'unavailable' }
  | { type: 'progress'; progress: number; stage: string }
  | { type: 'done'; blob: Blob }
  | { type: 'error'; message: string; name: string }
