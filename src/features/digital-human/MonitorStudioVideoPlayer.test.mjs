import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFallbackSources } from './lib/video-sources.ts'

test('resolveFallbackSources orders upstream first, server second, local blob third', () => {
  const result = resolveFallbackSources({
    sourceVideoUrl: 'https://cdn.aliyun.com/video.mp4',
    videoUrl: '/media/video/server.mp4',
    localVideoUrl: 'blob:https://localhost/local-uuid',
  })
  assert.deepEqual(result, [
    'https://cdn.aliyun.com/video.mp4',
    '/media/video/server.mp4',
    'blob:https://localhost/local-uuid',
  ])
})

test('resolveFallbackSources deduplicates identical URLs and skips empty ones', () => {
  const result = resolveFallbackSources({
    src: 'https://cdn.aliyun.com/video.mp4',
    sourceVideoUrl: 'https://cdn.aliyun.com/video.mp4',
    videoUrl: '   ',
    localVideoUrl: undefined,
  })
  assert.deepEqual(result, ['https://cdn.aliyun.com/video.mp4'])
})
