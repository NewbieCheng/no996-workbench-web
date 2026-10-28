/** Own an asynchronously created object URL until the caller disposes it. */
export function manageDownloadUrl(load: () => Promise<string>, onReady: (url: string) => void): () => void {
  let disposed = false
  let ownedUrl = ''
  void load().then((url) => {
    if (disposed) {
      if (url) URL.revokeObjectURL(url)
      return
    }
    ownedUrl = url
    onReady(url)
  }).catch(() => {
    if (!disposed) onReady('')
  })
  return () => {
    disposed = true
    if (ownedUrl) URL.revokeObjectURL(ownedUrl)
  }
}
