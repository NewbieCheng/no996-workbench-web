import assert from 'node:assert/strict'
import test from 'node:test'
import { coerceModelText, fenceJsonForMoments } from './model-text.ts'

test('coerceModelText keeps trimmed strings', () => {
  assert.equal(coerceModelText('  hello  '), 'hello')
})

test('coerceModelText stringifies objects', () => {
  assert.equal(coerceModelText({ status: 'success' }), '{"status":"success"}')
})

test('fenceJsonForMoments wraps bare json', () => {
  const out = fenceJsonForMoments('{"status":"success"}')
  assert.match(out, /^```json\n/)
  assert.match(out, /\n```$/)
})

test('fenceJsonForMoments preserves existing fence', () => {
  const fenced = '```json\n{}\n```'
  assert.equal(fenceJsonForMoments(fenced), fenced)
})
