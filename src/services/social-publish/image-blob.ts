export async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  if (!blobUrl.startsWith('blob:')) return blobUrl
  const res = await fetch(blobUrl)
  const blob = await res.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function resolveImageUrlsForPublish(urls: string[]): Promise<string[]> {
  const out: string[] = []
  for (const url of urls) {
    if (url.startsWith('blob:')) {
      out.push(await blobUrlToDataUrl(url))
    } else {
      out.push(url)
    }
  }
  return out
}

export function appendImagesToMarkdown(markdown: string, imageUrls: string[]): string {
  const base = (markdown || '').trim()
  if (imageUrls.length === 0) return base
  const imgs = imageUrls.map((url) => `![](${url})`).join('\n')
  return base ? `${base}\n\n${imgs}` : imgs
}

export function appendImagesToHtml(html: string, imageUrls: string[]): string {
  const base = (html || '').trim()
  const imgs = imageUrls.map((url) => `<p><img src="${url}" alt="" /></p>`).join('')
  return base ? `${base}\n${imgs}` : imgs
}
