const urlByJobId = new Map<string, string>()

export function getCachedPlaybackUrl(jobId: string): string | undefined {
  return urlByJobId.get(jobId)
}

export function setCachedPlaybackUrl(jobId: string, url: string): void {
  const prev = urlByJobId.get(jobId)
  if (prev && prev !== url) URL.revokeObjectURL(prev)
  urlByJobId.set(jobId, url)
}

export function revokePlaybackUrl(jobId: string): void {
  const prev = urlByJobId.get(jobId)
  if (prev) URL.revokeObjectURL(prev)
  urlByJobId.delete(jobId)
}

export function revokeAllPlaybackUrls(): void {
  for (const url of urlByJobId.values()) URL.revokeObjectURL(url)
  urlByJobId.clear()
}
