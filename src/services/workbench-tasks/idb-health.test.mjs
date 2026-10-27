import assert from 'node:assert/strict'
import test from 'node:test'
import {
  legacyStoreNamesHealthy,
  mainStoreNamesHealthy,
  shouldWipeLegacy,
  shouldWipeMainFromProbe,
  WORKBENCH_TASKS_DB_VERSION,
} from './idb-store-health.ts'

test('legacyStoreNamesHealthy requires jobs and blobs', () => {
  assert.equal(legacyStoreNamesHealthy([]), false)
  assert.equal(legacyStoreNamesHealthy(['jobs']), false)
  assert.equal(legacyStoreNamesHealthy(['jobs', 'blobs']), true)
})

test('shouldWipeLegacy only keeps DB with real rows', () => {
  assert.equal(shouldWipeLegacy(true, 0, 0), true)
  assert.equal(shouldWipeLegacy(false, 0, 0), true)
  assert.equal(shouldWipeLegacy(false, 2, 0), false)
  assert.equal(shouldWipeLegacy(false, 0, 1), false)
})

test('mainStoreNamesHealthy requires all task stores', () => {
  assert.equal(mainStoreNamesHealthy(['jobs', 'blobs']), false)
  assert.equal(mainStoreNamesHealthy(['jobs', 'blobs', 'payloads']), true)
})

test('task DB version is a single positive integer shared by health check and writer', () => {
  // 健康检查若用旧版本号 open，IndexedDB 会抛 VersionError，
  // 旧实现把它当成「库损坏」并删除用户全部任务历史。
  assert.equal(Number.isInteger(WORKBENCH_TASKS_DB_VERSION), true)
  assert.ok(WORKBENCH_TASKS_DB_VERSION >= 3, 'script_generate 需要 v3')
})

test('shouldWipeMainFromProbe never wipes when the DB cannot be judged', () => {
  // 只有真正读到结构、且结构不全，才允许清理
  assert.equal(shouldWipeMainFromProbe('ok', true), false)
  assert.equal(shouldWipeMainFromProbe('ok', false), true)
  // 版本更高 / 打不开：无法判定，绝不能删用户历史
  assert.equal(shouldWipeMainFromProbe('version-ahead', false), false)
  assert.equal(shouldWipeMainFromProbe('unavailable', false), false)
})
