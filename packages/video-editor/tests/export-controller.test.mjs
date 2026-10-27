import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { createEditor } from '../src/core/instance.ts'
import { ExportController } from '../src/core/export/controller.ts'
import { runExportPreflight } from '../src/core/export/preflight.ts'
import { MockMediaEngineAdapter } from '../src/media/mock-adapter.ts'

test('export: preflight detects empty duration and missing assets', async () => {
  const emptyDoc = createEmptyDocument('doc-e', '空工程')
  const report1 = await runExportPreflight(emptyDoc, async () => true)
  assert.equal(report1.valid, false)
  assert.ok(report1.issues.some((i) => i.code === 'EMPTY_DURATION'))

  // 加入引用了不存在的资产
  emptyDoc.durationUs = 1_000_000
  emptyDoc.tracks[0].elements.push({
    id: 'clip-1',
    trackId: 'track-main-video',
    type: 'video',
    assetId: 'non-existent-asset',
    startUs: 0,
    durationUs: 1_000_000,
    sourceInUs: 0,
    sourceOutUs: 1_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  })
  emptyDoc.assets['non-existent-asset'] = {
    id: 'non-existent-asset',
    kind: 'video',
    name: '丢失视频.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 100,
    createdAt: Date.now(),
  }

  const report2 = await runExportPreflight(emptyDoc, async () => false) // 模拟资产丢失
  assert.equal(report2.valid, false)
  assert.ok(report2.issues.some((i) => i.code === 'MISSING_MEDIA_BLOB'))
})

test('export: controller binds immutable snapshot and produces artifact', async () => {
  const doc = createEmptyDocument('doc-export', '导出工程')
  doc.durationUs = 1_000_000 // 1 秒 = 30 帧
  doc.tracks[0].elements.push({
    id: 'clip-1',
    trackId: 'track-main-video',
    type: 'video',
    assetId: 'asset-1',
    startUs: 0,
    durationUs: 1_000_000,
    sourceInUs: 0,
    sourceOutUs: 1_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  })
  doc.assets['asset-1'] = {
    id: 'asset-1',
    kind: 'video',
    name: '视频.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 100,
    createdAt: Date.now(),
  }

  const editor = createEditor({ document: doc })
  const controller = new ExportController()
  const mockEngine = new MockMediaEngineAdapter()

  let progressCalled = false
  const exportPromise = controller.exportDocument(
    editor.getDocument(),
    mockEngine,
    async () => null,
    async () => true,
    {
      format: 'mp4',
      onProgress: (p) => {
        if (p > 0) progressCalled = true
      },
    }
  )

  // 在导出过程中，修改编辑器里的文档标题与 revision
  editor.updateDocument((prev) => ({
    ...prev,
    name: '用户在导出过程中修改了标题',
  }))
  assert.equal(editor.getDocument().revision, 2)

  const { artifact, preflight } = await exportPromise
  assert.equal(preflight.valid, true)
  assert.ok(progressCalled, '进度回调必须触发')
  // 产物绑定的必须是启动时冻结的快照 (revision=1)
  assert.equal(artifact.revision, 1)
  assert.equal(artifact.documentId, 'doc-export')
  assert.ok(artifact.blob.size > 0)

  editor.dispose()
})

test('export: cancel triggers AbortError and resets state', async () => {
  const doc = createEmptyDocument('doc-cancel', '取消测试')
  doc.durationUs = 5_000_000

  const controller = new ExportController()
  const mockEngine = new MockMediaEngineAdapter()

  const promise = controller.exportDocument(
    doc,
    mockEngine,
    async () => null,
    async () => true
  )

  // 立即取消
  controller.cancel()

  await assert.rejects(
    () => promise,
    (err) => err.name === 'AbortError' || err.message.includes('取消')
  )

  assert.equal(controller.getIsExporting(), false)
})
