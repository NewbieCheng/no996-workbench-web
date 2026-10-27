import assert from 'node:assert/strict'
import test from 'node:test'
import { keyboardResizeDelta, pointerResizeDelta } from './resizable-separator-model.ts'

test('pointer movement respects left/right pane direction and zoom scale', () => {
  assert.equal(pointerResizeDelta(100, 120, 1), 20)
  assert.equal(pointerResizeDelta(120, 100, -1), 20)
  assert.equal(pointerResizeDelta(100, 110, 1, 2), 20)
})

test('arrow keys preserve each panel direction', () => {
  assert.equal(keyboardResizeDelta('ArrowRight', 1, 16), 16)
  assert.equal(keyboardResizeDelta('ArrowLeft', 1, 16), -16)
  assert.equal(keyboardResizeDelta('ArrowLeft', -1, 10), 10)
  assert.equal(keyboardResizeDelta('ArrowRight', -1, 10), -10)
})

test('Home and End request exact bounds when values are available', () => {
  assert.equal(keyboardResizeDelta('Home', 1, 16, 340, 280, 420), -60)
  assert.equal(keyboardResizeDelta('End', -1, 10, 340, 280, 420), 80)
  assert.equal(keyboardResizeDelta('Home', 1, 16), undefined)
})
