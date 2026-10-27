import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isVoiceReadyNotified,
  markVoiceReadyNotified,
  isCloneJobHandled,
  markCloneJobHandled,
} from './voice-ready-cache.ts'

// Mock localStorage in Node.js environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
}

test('voice ready cache: marks and queries notified voice ids', () => {
  localStorage.clear()
  assert.equal(isVoiceReadyNotified('voice-1'), false)
  markVoiceReadyNotified('voice-1')
  assert.equal(isVoiceReadyNotified('voice-1'), true)
  assert.equal(isVoiceReadyNotified('voice-2'), false)

  markVoiceReadyNotified(['voice-2', 'voice-3'])
  assert.equal(isVoiceReadyNotified('voice-2'), true)
  assert.equal(isVoiceReadyNotified('voice-3'), true)
})

test('clone job cache: marks and queries handled job ids', () => {
  localStorage.clear()
  assert.equal(isCloneJobHandled('job-1'), false)
  markCloneJobHandled('job-1')
  assert.equal(isCloneJobHandled('job-1'), true)
  assert.equal(isCloneJobHandled('job-2'), false)
})
