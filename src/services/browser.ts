export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error('当前浏览器不支持复制，请手动选择内容复制。')
  await navigator.clipboard.writeText(text)
}

/** Trigger browser download for a remote or blob URL (same-tab anchor click). */
export function downloadUrl(href: string, filename: string): void {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noopener noreferrer'
  document.body.append(link)
  link.click()
  link.remove()
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}
