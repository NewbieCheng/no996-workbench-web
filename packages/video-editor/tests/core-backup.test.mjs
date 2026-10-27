import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import {
  createProjectBackup,
  inspectProjectBackup,
  restoreProjectBackup,
  BackupCorruptedError,
} from '../src/core/backup/container.ts'

test('backup: binary backup creation, inspection and safe restoration', async () => {
  const doc = createEmptyDocument('proj-backup', '备份工程', 'scope-src')

  // 添加资产与引用
  doc.assets['asset-test-1'] = {
    id: 'asset-test-1',
    kind: 'image',
    name: '封面图.png',
    mimeType: 'image/png',
    sizeBytes: 12,
    blobId: 'blob-1',
    createdAt: Date.now(),
  }

  const assetStore = new Map()
  const mockBlob = new Blob(['mock png data'], { type: 'image/png' })
  assetStore.set('blob-1', mockBlob)

  // 1. 打包备份
  const backupBlob = await createProjectBackup(doc, async (blobId) => assetStore.get(blobId) || null)
  assert.ok(backupBlob.size > 16, '备份体积必须大于文件头')

  const arrayBuffer = await backupBlob.arrayBuffer()

  // 2. 预检备份
  const inspected = inspectProjectBackup(arrayBuffer)
  assert.equal(inspected.version, 1)
  assert.equal(inspected.document.name, '备份工程')
  assert.equal(inspected.assets.length, 1)
  assert.equal(inspected.assets[0].name, '封面图.png')

  // 3. 恢复备份到目标账号 (新 scope)
  const targetSaved = new Map()
  const restoredDoc = await restoreProjectBackup(arrayBuffer, 'target-scope-user', async (blobId, scope, blob) => {
    assert.equal(scope, 'target-scope-user', '解压时必须强行归属目标 scope')
    targetSaved.set(blobId, blob)
  })

  assert.equal(restoredDoc.scope, 'target-scope-user')
  assert.notEqual(restoredDoc.id, 'proj-backup', '恢复后的工程必须获得安全新 ID，避免覆盖原有工程')
  assert.equal(targetSaved.has('blob-1'), true)
  const restoredBlob = targetSaved.get('blob-1')
  assert.equal(await restoredBlob.text(), 'mock png data')
})

test('backup: corrupted header or truncated file is rejected', async () => {
  const badBuffer = new ArrayBuffer(8) // 太短
  assert.throws(() => inspectProjectBackup(badBuffer), BackupCorruptedError)

  const fakeHeader = new Uint8Array(20)
  fakeHeader.set([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]) // 错误 Magic
  assert.throws(() => inspectProjectBackup(fakeHeader.buffer), BackupCorruptedError)
})
