import assert from 'node:assert/strict'
import test from 'node:test'

if (!globalThis.sessionStorage) {
  const map = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}
import {
  clearMaterialCaptureSession,
  createEmptySession,
  mergeItemIntoSession,
  readMaterialCaptureSession,
  writeMaterialCaptureSession,
} from './material-capture-session-store.ts'

test('material capture session replaces previous batch', () => {
  clearMaterialCaptureSession()
  const first = createEmptySession('keyword')
  first.query = '春季'
  first.status = 'done'
  first.items = [
    {
      url: 'https://example.com/a',
      platformId: 'xiaohongshu',
      collectedAt: 1,
      title: 'A',
    },
  ]
  writeMaterialCaptureSession(first)

  const second = createEmptySession('link')
  second.query = 'https://xhs/link'
  writeMaterialCaptureSession(second)

  const read = readMaterialCaptureSession()
  assert.equal(read?.id, second.id)
  assert.equal(read?.mode, 'link')
  assert.equal(read?.items.length, 0)
})

test('mergeItemIntoSession dedupes by url', () => {
  const session = createEmptySession('link')
  const item = {
    url: 'https://example.com/note',
    platformId: 'xiaohongshu',
    collectedAt: Date.now(),
    title: 'v1',
  }
  const merged = mergeItemIntoSession(session, item)
  assert.equal(merged.items.length, 1)
  const updated = mergeItemIntoSession(merged, { ...item, title: 'v2' })
  assert.equal(updated.items.length, 1)
  assert.equal(updated.items[0].title, 'v2')
})
