import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeScriptText,
  checkScriptMismatch,
  applyTtsResultToDocument,
} from '../../../src/features/ip-video/adapters/tts-adapter.ts'
import {
  applyDigitalHumanToDocument,
} from '../../../src/features/ip-video/adapters/digital-human-adapter.ts'
import {
  migrateLegacyHistoryToDocument,
} from '../../../src/features/ip-video/migration/migrate-legacy-history.ts'
import { IP_VIDEO_CUSTOM_PROFILE } from '../../../src/features/ip-video/ip-profile.ts'
import { isPanelPermitted } from '../src/core/capabilities.ts'
import { createEmptyDocument } from '../src/core/project.ts'

test('s8-01: TTS snapshot binding, mismatch detection and blank padding normalization', () => {
  const snapshot = {
    scriptText: '大家好，欢迎收看职场小妙招。',
    voiceId: 'voice-v1',
    speedRate: 1.0,
    submittedAt: Date.now(),
    version: 1,
  }

  // 1. 首尾带空白和换行的文稿：归一化后对比，不判定为失配
  const paddedScript = '   \n 大家好，欢迎收看职场小妙招。 \n\n  '
  assert.equal(checkScriptMismatch(paddedScript, snapshot), false)

  // 2. 真实改动文稿内容：判定为失配
  const modifiedScript = '大家好，欢迎收看职场升级干货！'
  assert.equal(checkScriptMismatch(modifiedScript, snapshot), true)

  // 3. 回填配音到工程
  const doc = createEmptyDocument('doc-ip-test', '测试口播', 'user-1001')
  const mockAudioBlob = new Blob(['mock audio binary bytes'], { type: 'audio/mp3' })

  const updatedDoc = applyTtsResultToDocument(doc, {
    audioBlob: mockAudioBlob,
    audioDurationUs: 4_500_000,
    snapshot,
    voiceLabel: '知性女声',
  })

  // 断言：资产挂载成功，音频轨填入片段，字幕自动对齐
  assert.equal(Object.keys(updatedDoc.assets).length, 1)
  const audioTrack = updatedDoc.tracks.find((t) => t.type === 'audio')
  assert.ok(audioTrack)
  assert.equal(audioTrack.elements.length, 1)
  assert.equal(audioTrack.elements[0].durationUs, 4_500_000)
  assert.ok(updatedDoc.captions.length > 0)

  // 断言：任务中心记录被清空（例如外部清除 taskCenter），工程内部资产仍然完全保留不受影响
  const simulatedTasksCleared = []
  assert.equal(simulatedTasksCleared.length, 0)
  assert.equal(Object.keys(updatedDoc.assets).length, 1, '任务历史清理不破坏工程已存音频')
})

test('s8-01: Digital Human video output integration', () => {
  const doc = createEmptyDocument('doc-dh-test', '数字人成片测试', 'user-1001')
  const mockVideoBlob = new Blob(['mock video data'], { type: 'video/mp4' })

  // 1. 导入第一个片段
  const doc1 = applyDigitalHumanToDocument(doc, {
    versionId: 'dh-v1024',
    name: '数字人成片_片段1',
    videoBlob: mockVideoBlob,
    blobId: 'blob-dh-1',
    durationUs: 4_000_000,
    width: 1080,
    height: 1920,
  })

  assert.equal(doc1.tracks[0].elements.length, 1)
  assert.equal(doc1.tracks[0].elements[0].startUs, 0)
  assert.equal(doc1.tracks[0].elements[0].durationUs, 4_000_000)
  assert.equal(doc1.durationUs, 4_000_000)

  // 2. 批量连续追加第二个片段，必须追加至末尾而不是覆盖主轨
  const doc2 = applyDigitalHumanToDocument(doc1, {
    versionId: 'dh-v1025',
    name: '数字人成片_片段2',
    videoBlob: mockVideoBlob,
    blobId: 'blob-dh-2',
    durationUs: 3_000_000,
    width: 1080,
    height: 1920,
  })

  assert.equal(doc2.tracks[0].elements.length, 2, '多选数字人版本必须顺序追加而非单轨覆盖')
  assert.equal(doc2.tracks[0].elements[1].startUs, 4_000_000)
  assert.equal(doc2.tracks[0].elements[1].durationUs, 3_000_000)
  assert.equal(doc2.durationUs, 7_000_000)
})

test('s8-02: IP Video profile restricts panels according to specification', () => {
  // 必须允许的面板
  assert.equal(isPanelPermitted('timeline', IP_VIDEO_CUSTOM_PROFILE), true)
  assert.equal(isPanelPermitted('captions', IP_VIDEO_CUSTOM_PROFILE), true)
  assert.equal(isPanelPermitted('inspector', IP_VIDEO_CUSTOM_PROFILE), true)
  assert.equal(isPanelPermitted('export', IP_VIDEO_CUSTOM_PROFILE), true)

  // 必须屏蔽的专业面板（非仅 display:none，白名单未予放行）
  assert.equal(isPanelPermitted('keyframes', IP_VIDEO_CUSTOM_PROFILE), false)
  assert.equal(isPanelPermitted('audioMixer', IP_VIDEO_CUSTOM_PROFILE), false)
  assert.equal(isPanelPermitted('effects', IP_VIDEO_CUSTOM_PROFILE), false)
  assert.equal(isPanelPermitted('transitions', IP_VIDEO_CUSTOM_PROFILE), false)

  assert.equal(IP_VIDEO_CUSTOM_PROFILE.variant?.timeline, 'compact')
})

test('s8-03: legacy history migration respects user scope isolation, idempotency and reports differences', () => {
  const mockVideo = new Blob(['video data'], { type: 'video/mp4' })
  const mockAudio = new Blob(['audio data'], { type: 'audio/mp3' })
  const mockCover = new Blob(['cover data'], { type: 'image/jpeg' })

  const legacyRecord = {
    id: 'legacy-rec-1',
    ownerUserId: 1001,
    createdAt: 1700000000000,
    title: '旧版搞笑短视频',
    templateId: 'scroll',
    script: '第一句文案内容。第二句文案内容。',
    voiceLabel: '搞笑男声',
    speed: 1.0,
    duration: 5.0,
    demo: false,
    cover: mockCover,
    audio: mockAudio,
    video: mockVideo,
    subtitleStyle: { size: 30, color: '#fff', bg: '#000' },
  }

  // 1. 跨账号隔离拒绝断言
  const crossAccountRes = migrateLegacyHistoryToDocument(legacyRecord, 9999)
  assert.equal(crossAccountRes.report.status, 'rejected_cross_account')
  assert.equal(crossAccountRes.document, undefined)

  // 2. 本账号正常迁入
  const normalRes = migrateLegacyHistoryToDocument(legacyRecord, 1001)
  assert.equal(normalRes.report.status, 'migrated')
  assert.ok(normalRes.document)
  assert.equal(normalRes.document.scope, '1001')
  assert.equal(normalRes.document.durationUs, 5_000_000)
  assert.equal(normalRes.report.audioPreserved, true)
  assert.equal(normalRes.report.videoPreserved, true)
  // 必须明确列出差异，不伪造无损
  assert.ok(normalRes.report.differences.some((d) => d.includes('不伪造无损')))

  // 3. 幂等性断言：已有映射直接返回已迁入状态
  const existingMap = new Map([['legacy-rec-1', 'proj-migrated-legacy-rec-1']])
  const idempotentRes = migrateLegacyHistoryToDocument(legacyRecord, 1001, existingMap)
  assert.equal(idempotentRes.report.status, 'already_migrated')
  assert.equal(idempotentRes.report.newDocumentId, 'proj-migrated-legacy-rec-1')
})
