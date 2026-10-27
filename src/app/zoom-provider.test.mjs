import assert from 'node:assert/strict'
import test from 'node:test'
import { clampZoom, normalizeZoomPercent, parseStoredZoom, ZOOM_DEFAULT, ZOOM_MIN } from './zoom-math.ts'

test('stored zoom defaults to 100 for missing or invalid values', () => {
  for (const value of [null, '', ' ', '0', '0.01', '50', '201', 'NaN', 'Infinity', 'invalid']) {
    assert.equal(parseStoredZoom(value), 100)
  }
  assert.equal(parseStoredZoom('58'), 58)
  assert.equal(parseStoredZoom('125'), 125)
  assert.equal(parseStoredZoom('200'), 200)
})

test('normalizeZoomPercent treats legacy factor storage as percent', () => {
  assert.equal(normalizeZoomPercent(0.9), 90)
  assert.equal(normalizeZoomPercent(1), 100)
})

test('normalizeZoomPercent clamps sub-minimum stored percent', () => {
  assert.equal(normalizeZoomPercent(50), ZOOM_MIN)
  assert.equal(normalizeZoomPercent(40), ZOOM_MIN)
})

test('clampZoom falls back for non-finite input', () => {
  assert.equal(clampZoom(Number.NaN), ZOOM_DEFAULT)
})
