import { inkToastBody, toast } from '../../../lib/toast'
import { INK_TOAST_DURATIONS } from '../../../lib/toast-durations'
import { resolveVideoFactoryToastKind, type VideoFactoryToastKind } from './page-notice-kind'

export { resolveVideoFactoryToastKind, type VideoFactoryToastKind } from './page-notice-kind'

const VIDEO_FACTORY_TOAST_ID = 'video-factory-notice'

function pushInk(kind: VideoFactoryToastKind, message: string) {
  const body = inkToastBody(message)
  toast[kind](body.title, {
    description: body.description,
    duration: INK_TOAST_DURATIONS[kind],
    id: VIDEO_FACTORY_TOAST_ID,
  })
}

/** 视频工厂页操作反馈：统一走全局墨囊 Toast（Sonner），不用页内 vf-banner */
export function notifyVideoFactory(message: string) {
  const kind = resolveVideoFactoryToastKind(message)
  if (!kind) return
  pushInk(kind, message.trim())
}
