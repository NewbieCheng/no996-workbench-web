export type FallbackSourcesInput = {
  src?: string
  sourceVideoUrl?: string
  videoUrl?: string
  localVideoUrl?: string
}

export function resolveFallbackSources(input: FallbackSourcesInput): string[] {
  return [
    ...new Set(
      [input.sourceVideoUrl, input.videoUrl, input.localVideoUrl, input.src].filter(
        (url): url is string => Boolean(url?.trim()),
      ),
    ),
  ]
}
