import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: ['src/services/materials/material-repository.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
const { materialIdForUser } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

test('same collected work has separate owner keys', () => {
  const item = { platformId: 'douyin', workId: '42', url: 'https://example.com/42', collectedAt: 1 }
  assert.notEqual(materialIdForUser(1, item), materialIdForUser(2, item))
  assert.equal(materialIdForUser(1, item), materialIdForUser(1, { ...item }))
})

test('fallback URL identity is scoped by owner', () => {
  const item = { platformId: 'weixin', url: 'https://example.com/article', collectedAt: 1 }
  assert.notEqual(materialIdForUser(1, item), materialIdForUser(2, item))
})
