import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dedupeLibraryAssets,
  libraryAssetFingerprint,
} from '../src/panels/shared/dedupe-library-assets.ts'

test('libraryAssetFingerprint combines kind, name, size', () => {
  const fp = libraryAssetFingerprint({
    id: 'a1',
    kind: 'audio',
    name: 'bgm-tech-house',
    mimeType: 'audio/mpeg',
    sizeBytes: 100,
    createdAt: 1,
  })
  assert.equal(fp, 'audio:bgm-tech-house:100')
})

test('dedupeLibraryAssets keeps newest createdAt per fingerprint', () => {
  const older = {
    id: 'old',
    kind: 'audio',
    name: 'sfx',
    mimeType: 'audio/mpeg',
    sizeBytes: 50,
    createdAt: 10,
  }
  const newer = {
    id: 'new',
    kind: 'audio',
    name: 'sfx',
    mimeType: 'audio/mpeg',
    sizeBytes: 50,
    createdAt: 20,
  }
  const other = {
    id: 'vid',
    kind: 'video',
    name: 'clip',
    mimeType: 'video/mp4',
    sizeBytes: 50,
    createdAt: 5,
  }
  const result = dedupeLibraryAssets([older, newer, other])
  assert.equal(result.length, 2)
  assert.equal(result.find((a) => a.name === 'sfx')?.id, 'new')
})
