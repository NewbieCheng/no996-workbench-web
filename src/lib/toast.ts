import { useEffect, useRef } from 'react'
import { toast as sonnerToast } from 'sonner'
import { INK_TOAST_DURATIONS } from './toast-durations'
import { normalizeOperationErrorMessage } from './normalize-operation-error'

export { INK_TOAST_DURATIONS } from './toast-durations'
export { normalizeOperationErrorMessage } from './normalize-operation-error'

export type NotifyOperationOptions = {
  /** Sonner toast id，避免连点重复弹窗 */
  id?: string
  description?: string
  /** 跳过 normalize（如已是 i18n 文案） */
  raw?: boolean
}

export type ToastBody = {
  title: string
  description?: string
}

/** 单句文案按中文逗号拆成标题 + 说明，贴近墨囊规范的双行结构 */
export function inkToastBody(message: string, description?: string): ToastBody {
  if (description?.trim()) return { title: message, description: description.trim() }
  const comma = message.indexOf('，')
  if (comma > 0 && comma < message.length - 1) {
    return {
      title: message.slice(0, comma).trim(),
      description: message.slice(comma + 1).trim(),
    }
  }
  return { title: message }
}

function pushInkToast(
  kind: 'success' | 'error' | 'warning' | 'info',
  message: string,
  description?: string,
  duration?: number,
  id?: string,
) {
  const body = inkToastBody(message, description)
  sonnerToast[kind](body.title, {
    description: body.description,
    duration,
    id,
  })
}

function resolveOperationMessage(message: string, raw?: boolean) {
  return raw ? message.trim() : normalizeOperationErrorMessage(message)
}

/** 生成 / 发布 / API 等操作失败：全局墨囊 Toast，勿在面板内嵌红字 */
export function notifyOperationError(message: string, options?: NotifyOperationOptions) {
  const text = resolveOperationMessage(message, options?.raw)
  if (!text) return
  pushInkToast(
    'error',
    text,
    options?.description,
    INK_TOAST_DURATIONS.error,
    options?.id ?? 'operation-error',
  )
}

/** 提交前校验、可恢复的操作提示 */
export function notifyOperationWarning(message: string, options?: NotifyOperationOptions) {
  const text = resolveOperationMessage(message, options?.raw)
  if (!text) return
  pushInkToast(
    'warning',
    text,
    options?.description,
    INK_TOAST_DURATIONS.warning,
    options?.id ?? 'operation-warning',
  )
}

/**
 * 当 error 文案从空变为非空时弹出 Toast（用于仍保留 error state 驱动逻辑的组件）。
 */
export function useNotifyOperationMessage(
  message: string | undefined,
  kind: 'error' | 'warning' = 'error',
  id = 'operation-message',
) {
  const last = useRef('')
  useEffect(() => {
    const text = message?.trim() ?? ''
    if (!text) {
      last.current = ''
      return
    }
    if (text === last.current) return
    last.current = text
    if (kind === 'warning') notifyOperationWarning(text, { id, raw: true })
    else notifyOperationError(text, { id, raw: true })
  }, [message, kind, id])
}

export function toastSuccess(message: string, description?: string, duration?: number) {
  pushInkToast('success', message, description, duration ?? INK_TOAST_DURATIONS.success)
}

export function toastError(message: string, description?: string) {
  pushInkToast('error', message, description, INK_TOAST_DURATIONS.error)
}

export function toastWarning(message: string, description?: string) {
  pushInkToast('warning', message, description, INK_TOAST_DURATIONS.warning)
}

export function toastInfo(message: string, description?: string) {
  pushInkToast('info', message, description, INK_TOAST_DURATIONS.info)
}

/** 与 Sonner 直连（已套用全局墨囊样式）；新代码优先用 toastSuccess 等封装。 */
export { sonnerToast as toast }

export {
  toastTaskEnqueued,
  openTaskCenter,
  openPageHistory,
  OPEN_TASK_CENTER_EVENT,
  OPEN_PAGE_HISTORY_EVENT,
} from './toast-task-enqueued'
