/** Random-access output storage: media containers can rewrite earlier bytes. */
export class BoundedByteStore {
  private pages = new Map<number, Uint8Array<ArrayBuffer>>()
  private length = 0
  private readonly pageSize = 1024 * 1024
  private readonly limit: number
  constructor(limit = 250 * 1024 * 1024) { this.limit = limit }

  write(position: number, data: Uint8Array): void {
    const end = position + data.byteLength
    if (!Number.isSafeInteger(position) || position < 0 || !Number.isSafeInteger(end) || end > this.limit) throw new Error('exportTooLarge')
    for (let offset = 0; offset < data.byteLength;) {
      const absolute = position + offset
      const pageIndex = Math.floor(absolute / this.pageSize)
      let page = this.pages.get(pageIndex)
      if (!page) {
        page = new Uint8Array(Math.min(this.pageSize, this.limit - pageIndex * this.pageSize))
        this.pages.set(pageIndex, page)
      }
      const inPage = absolute % this.pageSize
      const count = Math.min(page.length - inPage, data.byteLength - offset)
      page.set(data.subarray(offset, offset + count), inPage)
      offset += count
    }
    this.length = Math.max(this.length, end)
  }

  toBlob(mime: string): Blob {
    const parts: Uint8Array<ArrayBuffer>[] = []
    for (let start = 0; start < this.length; start += this.pageSize) {
      const count = Math.min(this.pageSize, this.length - start)
      parts.push((this.pages.get(Math.floor(start / this.pageSize)) ?? new Uint8Array(count)).subarray(0, count))
    }
    return new Blob(parts, { type: mime })
  }

  clear(): void { this.pages.clear(); this.length = 0 }
}
