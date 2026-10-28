import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolveVideoExportDownloadUrl } from './video-export-download-url.ts'
import { manageDownloadUrl } from './managed-download-url.ts'

const task = { kind: 'video_factory_export', status: 'succeeded', blobId: 'video' }

test('downloads support Blob and historical ArrayBuffer without copying Blob', async () => {
  const original = URL.createObjectURL
  const captured = []
  URL.createObjectURL = (blob) => { captured.push(blob); return 'blob:test' }
  try {
    const blob = new Blob(['video'], { type: 'video/mp4' })
    assert.equal(await resolveVideoExportDownloadUrl({ getBlob: async () => ({ data: blob, mime: blob.type }) }, task), 'blob:test')
    assert.equal(captured[0], blob)
    const data = new Uint8Array([1, 2, 3]).buffer
    assert.equal(await resolveVideoExportDownloadUrl({ getBlob: async () => ({ data, mime: 'video/mp4' }) }, task), 'blob:test')
    assert.deepEqual([...new Uint8Array(await captured[1].arrayBuffer())], [1, 2, 3])
    assert.equal(await resolveVideoExportDownloadUrl({ getBlob: async () => ({ data: new Blob([]) }) }, task), '')
    assert.equal(await resolveVideoExportDownloadUrl({ getBlob: async () => ({ data: new ArrayBuffer(0) }) }, task), '')
  } finally { URL.createObjectURL = original }
})

test('late URLs are revoked after disposal and never published', async () => {
  const original = URL.revokeObjectURL
  const revoked = []
  URL.revokeObjectURL = (url) => revoked.push(url)
  try {
    let finish
    const published = []
    const dispose = manageDownloadUrl(() => new Promise((resolve) => { finish = resolve }), (url) => published.push(url))
    dispose()
    finish('blob:late')
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(published, [])
    assert.deepEqual(revoked, ['blob:late'])
    const disposeReady = manageDownloadUrl(async () => 'blob:ready', (url) => published.push(url))
    await new Promise((resolve) => setImmediate(resolve))
    disposeReady()
    assert.deepEqual(published, ['blob:ready'])
    assert.deepEqual(revoked, ['blob:late', 'blob:ready'])
  } finally { URL.revokeObjectURL = original }
})

test('repository accepts both record formats and exporter stores Blob directly', () => {
  const repo = readFileSync(new URL('./idb-repository.ts', import.meta.url), 'utf8')
  const executor = readFileSync(new URL('./executors/video-factory-export.ts', import.meta.url), 'utf8')
  assert.match(repo, /v\.data instanceof ArrayBuffer\) && !\(v\.data instanceof Blob/)
  assert.match(executor, /data: blob/)
  assert.doesNotMatch(executor, /blob\.arrayBuffer\(/)
})
