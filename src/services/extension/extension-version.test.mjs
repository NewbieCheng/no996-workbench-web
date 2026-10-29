import assert from 'node:assert/strict'
import test from 'node:test'
import {
  REQUIRED_EXTENSION_VERSION,
  isExtensionOutdated,
  isExtensionVersionBelow,
} from './extension-version.ts'

test('required version is 3.7.7', () => {
  assert.equal(REQUIRED_EXTENSION_VERSION, '3.7.7')
})

test('3.7.2 is below 3.7.7', () => {
  assert.equal(isExtensionVersionBelow('3.7.2', '3.7.7'), true)
  assert.equal(isExtensionOutdated('3.7.2'), true)
})

test('3.7.6 is below 3.7.7; 3.7.7 and above are current', () => {
  assert.equal(isExtensionOutdated('3.7.6'), true)
  assert.equal(isExtensionOutdated('3.7.7'), false)
  assert.equal(isExtensionOutdated('v3.7.7'), false)
  assert.equal(isExtensionOutdated('3.8.0'), false)
})

test('missing version is treated as outdated', () => {
  assert.equal(isExtensionOutdated(undefined), true)
  assert.equal(isExtensionOutdated(''), true)
})
