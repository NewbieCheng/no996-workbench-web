import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import {
  MemoryProjectRepository,
  MemoryAssetRepository,
  RevisionConflictError,
  StorageQuotaExceededError,
} from '../src/core/repository/index.ts'

test('repository: scope isolation prevents cross-account access', async () => {
  const repo = new MemoryProjectRepository()

  const docUser1 = createEmptyDocument('proj-1', '用户1的工程', 'user-alpha')
  const docUser2 = createEmptyDocument('proj-1', '用户2的工程', 'user-beta') // 同 ID 但不同 scope

  await repo.saveProject(docUser1)
  await repo.saveProject(docUser2)

  const listAlpha = await repo.listProjects('user-alpha')
  const listBeta = await repo.listProjects('user-beta')

  assert.equal(listAlpha.length, 1)
  assert.equal(listBeta.length, 1)
  assert.equal(listAlpha[0].name, '用户1的工程')
  assert.equal(listBeta[0].name, '用户2的工程')

  const fetched = await repo.getProject('proj-1', 'user-alpha')
  assert.equal(fetched?.name, '用户1的工程')

  await repo.deleteProject('proj-1', 'user-alpha')
  assert.equal(await repo.getProject('proj-1', 'user-alpha'), null)
  assert.ok(await repo.getProject('proj-1', 'user-beta') !== null, 'user-beta 的同名工程不受影响')
})

test('repository: optimistic locking rejects stale revision save', async () => {
  const repo = new MemoryProjectRepository()
  const doc = createEmptyDocument('proj-opt', '并发工程', 'scope-test')

  await repo.saveProject(doc)

  // 模拟端 A 读取了 r1
  const docA = await repo.getProject('proj-opt', 'scope-test')
  // 模拟端 B 读取了 r1，并将其修改为 r2 写入成功
  const docB = await repo.getProject('proj-opt', 'scope-test')
  docB.revision = 2
  await repo.saveProject(docB, 1)

  // 端 A 试图用旧的 expectedRevision=1 覆盖，必须抛出 RevisionConflictError 拒绝
  docA.revision = 2
  await assert.rejects(
    () => repo.saveProject(docA, 1),
    RevisionConflictError
  )
})

test('repository: asset quota enforcement rejects oversized storage', async () => {
  const assetRepo = new MemoryAssetRepository()

  // 允许保存一个合法小 Blob
  const smallBlob = new Blob(['hello video'], { type: 'text/plain' })
  await assetRepo.saveAssetBlob('blob-1', 'user-q', smallBlob)

  const usage = await assetRepo.getScopeStorageUsage('user-q')
  assert.equal(usage.count, 1)
  assert.equal(usage.totalBytes, smallBlob.size)

  // 构造单个超大 Blob (超出 250MB)
  const hugeBlob = { size: 300 * 1024 * 1024, type: 'video/mp4' }
  await assert.rejects(
    () => assetRepo.saveAssetBlob('huge-blob', 'user-q', hugeBlob),
    StorageQuotaExceededError
  )
})
