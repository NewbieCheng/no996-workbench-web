import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PreviewMediaPool } from '../src/core/export/preview-media-pool.ts'

const image = (id) => ({ id, type: 'image', assetId: id, startUs: 0, durationUs: 100 })
const doc = (tracks, assets) => ({ tracks, assets, durationUs: 100 })
const asset = (id) => ({ blobId: id, kind: 'image', name: id })

test('loads only visible timeline assets with bounded concurrency', async () => {
  const original = globalThis.createImageBitmap
  let active = 0, max = 0
  const closed = []
  globalThis.createImageBitmap = async (blob) => {
    active++; max = Math.max(max, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active--
    return { close: () => closed.push(blob.id) }
  }
  try {
    const loaded = []
    const pool = new PreviewMediaPool()
    await pool.load(doc([
      { hidden: false, elements: [image('a'), image('b'), image('c'), image('a')] },
      { hidden: true, elements: [image('hidden')] },
    ], Object.fromEntries(['a', 'b', 'c', 'hidden', 'unused'].map((id) => [id, asset(id)]))), async (id) => {
      loaded.push(id)
      return { id, size: 1, type: 'image/png' }
    })
    assert.deepEqual(loaded.sort(), ['a', 'b', 'c'])
    assert.equal(max, 2)
    pool.dispose()
    assert.deepEqual(closed.sort(), ['a', 'b', 'c'])
  } finally { globalThis.createImageBitmap = original }
})

test('closes a bitmap that finishes after another asset fails', async () => {
  const original = globalThis.createImageBitmap
  let release
  let closed = false
  globalThis.createImageBitmap = () => new Promise((resolve) => { release = () => resolve({ close: () => { closed = true } }) })
  try {
    const pool = new PreviewMediaPool()
    const loading = pool.load(doc([{ hidden: false, elements: [image('a'), image('b')] }], { a: asset('a'), b: asset('b') }), async (id) => {
      if (id === 'b') { await new Promise((resolve) => setTimeout(resolve, 0)); return null }
      return { size: 1, type: 'image/png' }
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    release()
    await assert.rejects(loading, /缺失/)
    assert.equal(closed, true)
  } finally { globalThis.createImageBitmap = original }
})
