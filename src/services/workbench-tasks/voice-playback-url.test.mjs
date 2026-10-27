import assert from 'node:assert/strict'
import test from 'node:test'
import { upgradeInsecureMediaUrl, isEmbeddablePlaybackUrl } from '../../lib/secure-media-url.ts'
import {
  getVoiceUpstreamAudioUrl,
  resolveVoiceDownloadUrl,
  resolveVoicePlaybackUrl,
} from './voice-playback-url.ts'
import { resolveVoicePlaybackUrlDeduped } from './voice-playback-resolve.ts'
import { revokePlaybackUrl } from './playback-cache.ts'

const OSS_HTTP =
  'http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/prod/qwen-audio-3.0/foo.wav?Expires=1'

test('upgradeInsecureMediaUrl upgrades aliyuncs http to https', () => {
  const out = upgradeInsecureMediaUrl(OSS_HTTP)
  assert.equal(out.startsWith('https://'), true)
  assert.match(out, /oss-cn-beijing\.aliyuncs\.com/)
})

test('isEmbeddablePlaybackUrl blocks http on https pages', () => {
  globalThis.window = { location: { protocol: 'https:', href: 'https://agent.no996ai.cn/' } }
  assert.equal(isEmbeddablePlaybackUrl(OSS_HTTP), false)
  assert.equal(isEmbeddablePlaybackUrl(upgradeInsecureMediaUrl(OSS_HTTP)), true)
  assert.equal(isEmbeddablePlaybackUrl('blob:https://agent.no996ai.cn/u'), true)
})

test('resolveVoicePlaybackUrl prefers mediaPath over upstream http', async () => {
  globalThis.window = { location: { origin: 'https://agent.no996ai.cn', protocol: 'https:' } }
  const task = {
    id: 't1',
    kind: 'voice_tts',
    status: 'succeeded',
    payloadId: 'p1',
    blobId: undefined,
  }
  const repo = {
    async getPayload() {
      return {
        data: {
          mediaPath: '/media/audio/test.wav',
          upstreamAudioUrl: OSS_HTTP,
        },
      }
    },
    async getBlob() {
      return null
    },
  }
  const url = await resolveVoicePlaybackUrl(repo, task)
  assert.equal(url, 'https://agent.no996ai.cn/media/audio/test.wav')
  assert.equal(url.startsWith('http://'), false)
})

test('resolveVoicePlaybackUrl prefers blob over mediaPath and upstream', async () => {
  globalThis.window = { location: { origin: 'https://agent.no996ai.cn', protocol: 'https:' } }
  const created = []
  const prevCreate = URL.createObjectURL
  URL.createObjectURL = (blob) => {
    created.push(blob)
    return 'blob:test-audio'
  }
  try {
    const task = {
      id: 't2',
      kind: 'voice_tts',
      status: 'succeeded',
      payloadId: 'p2',
      blobId: 't2',
    }
    const repo = {
      async getPayload() {
        return {
          data: {
            mediaPath: '/media/audio/test.wav',
            upstreamAudioUrl: OSS_HTTP,
          },
        }
      },
      async getBlob() {
        return { data: new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer, mime: 'audio/wav' }
      },
    }
    const url = await resolveVoicePlaybackUrl(repo, task)
    assert.equal(url, 'blob:test-audio')
    assert.equal(created.length, 1)
  } finally {
    URL.createObjectURL = prevCreate
  }
})

test('getVoiceUpstreamAudioUrl returns raw upstream without upgrade', async () => {
  const task = { kind: 'voice_tts', payloadId: 'p3' }
  const repo = {
    async getPayload() {
      return { data: { upstreamAudioUrl: OSS_HTTP } }
    },
  }
  const raw = await getVoiceUpstreamAudioUrl(repo, task)
  assert.equal(raw, OSS_HTTP)
})

test('resolveVoiceDownloadUrl prefers upgraded upstream over blob', async () => {
  globalThis.window = { location: { origin: 'https://agent.no996ai.cn', protocol: 'https:' } }
  const task = {
    id: 't-dl',
    kind: 'voice_tts',
    status: 'succeeded',
    payloadId: 'p-dl',
    blobId: 'b-dl',
  }
  const repo = {
    async getPayload() {
      return {
        data: {
          upstreamAudioUrl: OSS_HTTP,
          mediaPath: '/media/audio/test.wav',
        },
      }
    },
    async getBlob() {
      return { data: new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer, mime: 'audio/wav' }
    },
  }
  const url = await resolveVoiceDownloadUrl(repo, task)
  assert.equal(url, upgradeInsecureMediaUrl(OSS_HTTP))
  assert.equal(url.startsWith('blob:'), false)
})

test('resolveVoicePlaybackUrlDeduped uses one resolver for concurrent callers', async () => {
  revokePlaybackUrl('t-dedupe')
  let resolveCalls = 0
  let createCount = 0
  let revokeCount = 0
  const prevCreate = URL.createObjectURL
  const prevRevoke = URL.revokeObjectURL
  URL.createObjectURL = () => {
    createCount += 1
    return 'blob:deduped-once'
  }
  URL.revokeObjectURL = () => {
    revokeCount += 1
  }
  try {
    const resolve = async () => {
      resolveCalls += 1
      await new Promise((r) => setTimeout(r, 5))
      return URL.createObjectURL(new Blob(['x']))
    }
    const [a, b, c] = await Promise.all([
      resolveVoicePlaybackUrlDeduped('t-dedupe', resolve),
      resolveVoicePlaybackUrlDeduped('t-dedupe', resolve),
      resolveVoicePlaybackUrlDeduped('t-dedupe', resolve),
    ])
    assert.equal(a, 'blob:deduped-once')
    assert.equal(b, a)
    assert.equal(c, a)
    assert.equal(resolveCalls, 1)
    assert.equal(createCount, 1)
    assert.equal(revokeCount, 0)
  } finally {
    URL.createObjectURL = prevCreate
    URL.revokeObjectURL = prevRevoke
    revokePlaybackUrl('t-dedupe')
  }
})
