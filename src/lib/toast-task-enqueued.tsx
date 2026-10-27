import { INK_TOAST_DURATIONS } from './toast-durations'
import { inkToastBody, toastSuccess } from './toast'

export const OPEN_TASK_CENTER_EVENT = 'no996:open-task-center'
export const OPEN_PAGE_HISTORY_EVENT = 'no996:open-page-history'

export function openTaskCenter(): void {
  window.dispatchEvent(new CustomEvent(OPEN_TASK_CENTER_EVENT))
}

export function openPageHistory(): void {
  window.dispatchEvent(new CustomEvent(OPEN_PAGE_HISTORY_EVENT))
}

type EnqueueToastOptions = {
  message?: string
  durationMs?: number
}

const DEFAULT_MESSAGE = '任务已发送，请在历史中查看。'

export function toastTaskEnqueued(options?: EnqueueToastOptions): void {
  const raw = options?.message ?? DEFAULT_MESSAGE
  const body = inkToastBody(raw)
  toastSuccess(body.title, body.description, options?.durationMs ?? INK_TOAST_DURATIONS.success)
}
