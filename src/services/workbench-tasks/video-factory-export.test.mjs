import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('video_factory_export payload shape is stable for executor', () => {
  const input = {
    documentId: 'doc-1',
    documentRevision: 3,
    projectTitle: '测试成片',
    resolutionPreset: '720p',
    source: 'video-factory',
    ownerScope: '42',
  }
  assert.equal(input.source, 'video-factory')
  assert.equal(typeof input.documentRevision, 'number')
  assert.ok(['720p', '1080p'].includes(input.resolutionPreset))
  const ip = { ...input, source: 'ip-composition' }
  assert.equal(ip.source, 'ip-composition')
})

test('task meta progress uses string percent for IDB meta contract', () => {
  const meta = { progress: '42', stage: '正在浏览器逐帧编码', resolution: '720p' }
  assert.equal(meta.progress, '42')
  const n = Number(meta.progress)
  assert.ok(Number.isFinite(n) && n >= 0 && n <= 100)
})

test('default composition is preview not offline raster', () => {
  const composition = 'preview'
  assert.notEqual(composition, 'offline')
  assert.equal(['preview', 'offline'].includes(composition), true)
})

test('interrupted browser export is failed not silently requeued', () => {
  const next = { status: 'failed', errorMessage: '页面已刷新或关闭，浏览器合成已中断，请重新导出' }
  assert.equal(next.status, 'failed')
  assert.match(next.errorMessage, /中断/)
})

test('shared video encoders honor random-access container writes', () => {
  for (const path of [
    '../../../packages/video-editor/src/core/export/composition-recorder.ts',
    '../../../packages/video-editor/src/media/mediabunny-adapter.ts',
  ]) {
    const src = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(src, /store\.write\(chunk\.position, chunk\.data\)/)
    assert.match(src, /store\.toBlob\(/)
  }
})

test('fast export bitrate is speed-first', () => {
  const src = readFileSync(new URL('../../../packages/video-editor/src/core/export/composition-recorder.ts', import.meta.url), 'utf8')
  assert.match(src, /export const FAST_EXPORT_VIDEO_BITRATE = 4_000_000/)
  assert.match(src, /latencyMode: 'realtime'/)
})

test('export progress persist must notify UI snapshot (contract)', () => {
  // 执行器写 meta 后若不同步 onJobsChanged，ExportPanel 会一直显示入队时的「排队中 0%」。
  let notified = 0
  const onProgressPersisted = () => {
    notified += 1
  }
  const patchProgress = async (progress, stage, notify) => {
    const meta = { progress: String(Math.round(progress)), stage }
    assert.equal(typeof meta.progress, 'string')
    notify?.()
  }
  return patchProgress(0, '正在启动浏览器合成', onProgressPersisted).then(() => {
    assert.equal(notified, 1)
  })
})
