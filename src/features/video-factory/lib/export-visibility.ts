/** 导出循环中：标签页隐藏时暂停，回到前台再继续 */
export async function waitForDocumentVisible(signal?: AbortSignal): Promise<void> {
  if (typeof document === 'undefined' || !document.hidden) return

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      cleanup()
      reject(new DOMException('编码已取消', 'AbortError'))
    }
    const onVisible = () => {
      if (!document.hidden) {
        cleanup()
        resolve()
      }
    }
    const cleanup = () => {
      document.removeEventListener('visibilitychange', onVisible)
      signal?.removeEventListener('abort', onAbort)
    }
    document.addEventListener('visibilitychange', onVisible)
    signal?.addEventListener('abort', onAbort)
    if (signal?.aborted) onAbort()
  })
}

export function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden
}
