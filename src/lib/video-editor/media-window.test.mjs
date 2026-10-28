import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectPreviewAssets } from './media-window.ts'

const doc = {
  assets: Object.fromEntries(['current', 'next', 'later', 'fourth', 'unused'].map(id => [id, { blobId: id }])),
  tracks: [
    { hidden: false, elements: [
      { type: 'image', assetId: 'current', startUs: 0, durationUs: 1_000_000 },
      { type: 'video', assetId: 'next', startUs: 1_000_000, durationUs: 1_000_000 },
      { type: 'image', assetId: 'later', startUs: 1_500_000, durationUs: 1_000_000 },
      { type: 'image', assetId: 'fourth', startUs: 2_000_000, durationUs: 1_000_000 },
    ] },
    { hidden: true, elements: [{ type: 'image', assetId: 'unused', startUs: 0, durationUs: 10_000_000 }] },
  ],
}

test('loads active assets and a bounded nearest lookahead, ignoring unused and hidden assets', () => {
  assert.deepEqual(selectPreviewAssets(doc, 0), ['current', 'next', 'later'])
  assert.deepEqual(selectPreviewAssets(doc, 1_500_000), ['next', 'later', 'fourth'])
  assert.deepEqual(selectPreviewAssets(doc, 4_000_000), [])
})

test('never drops active overlapping assets to enforce prefetch limit', () => {
  assert.deepEqual(selectPreviewAssets(doc, 1_500_000, 2_000_000, 0), ['next', 'later'])
})
