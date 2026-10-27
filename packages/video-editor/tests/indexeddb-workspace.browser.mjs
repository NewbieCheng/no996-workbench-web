import { IndexedDBProjectRepository, IndexedDBAssetRepository } from '../src/core/repository/indexeddb.ts'
import { createEmptyDocument } from '../src/core/project.ts'

/** Run through the local Vite server in a browser with native IndexedDB. */
export async function verifyWorkspaceIsolation() {
  const scope = `workspace-check-${crypto.randomUUID()}`
  const otherScope = `${scope}-other-account`
  const id = 'same-project-id'
  const blobId = 'same-blob-id'
  const factory = new IndexedDBProjectRepository()
  const factoryExplicit = new IndexedDBProjectRepository('video-factory')
  const ip = new IndexedDBProjectRepository('ip-video')
  const factoryAssets = new IndexedDBAssetRepository()
  const factoryAssetsExplicit = new IndexedDBAssetRepository('video-factory')
  const ipAssets = new IndexedDBAssetRepository('ip-video')
  const checks = []
  const check = (condition, message) => {
    if (!condition) throw new Error(message)
    checks.push(message)
  }
  try {
    await factory.saveProject(createEmptyDocument(id, '工厂作品', scope))
    await factoryAssets.saveAssetBlob(blobId, scope, new Blob(['factory-media']))
    check(await ip.getProject(id, scope) === null, 'IP 工作区不会打开工厂同 ID 工程')
    check(await ipAssets.getAssetBlob(blobId, scope) === null, 'IP 素材不会回退读取工厂素材')
    await ip.saveProject(createEmptyDocument(id, '口播作品', scope))
    await ipAssets.saveAssetBlob(blobId, scope, new Blob(['ip-media']))
    check((await factoryExplicit.getProject(id, scope))?.name === '工厂作品', '默认仓储保持原视频工厂数据库')
    check((await factory.listProjects(scope)).length === 1 && (await ip.listProjects(scope)).length === 1, '工程列表各自只包含本工作区作品')
    check(await (await factoryAssetsExplicit.getAssetBlob(blobId, scope)).text() === 'factory-media', '默认素材仓储保持原视频工厂数据库')
    check(await (await ipAssets.getAssetBlob(blobId, scope)).text() === 'ip-media', '同账号同素材 ID 在两个工作区分别保存')

    const ipDoc = await ip.getProject(id, scope)
    await ip.saveProject({ ...ipDoc, name: '口播已修改', revision: 2 })
    check((await factory.getProject(id, scope))?.name === '工厂作品', '修改口播不会改变工厂工程')
    const factoryDoc = await factory.getProject(id, scope)
    await factory.saveProject({ ...factoryDoc, name: '工厂已修改', revision: 2 })
    check((await ip.getProject(id, scope))?.name === '口播已修改', '修改工厂不会改变口播工程')
    await ipAssets.saveAssetBlob(blobId, scope, new Blob(['updated-ip-media']))
    check(await (await factoryAssets.getAssetBlob(blobId, scope)).text() === 'factory-media', '替换口播素材不会改变工厂素材')
    await factoryAssets.saveAssetBlob(blobId, scope, new Blob(['updated-factory-media']))
    check(await (await ipAssets.getAssetBlob(blobId, scope)).text() === 'updated-ip-media', '替换工厂素材不会改变口播素材')
    check((await factoryAssets.getScopeStorageUsage(scope)).totalBytes === new Blob(['updated-factory-media']).size, '素材用量只统计本工作区')
    check(await ip.getProject(id, otherScope) === null && await factory.getProject(id, otherScope) === null, '两个工作区均保持账号工程隔离')
    check(await ipAssets.getAssetBlob(blobId, otherScope) === null && await factoryAssets.getAssetBlob(blobId, otherScope) === null, '两个工作区均保持账号素材隔离')

    await ip.deleteProject(id, scope)
    await ipAssets.deleteAssetBlob(blobId, scope)
    check(await ip.getProject(id, scope) === null && (await factory.getProject(id, scope))?.name === '工厂已修改', '删除口播作品不会删除工厂作品')
    check(await ipAssets.getAssetBlob(blobId, scope) === null && await factoryAssets.getAssetBlob(blobId, scope) !== null, '删除口播素材不会删除工厂素材')
    await ip.saveProject(createEmptyDocument(id, '保留的口播作品', scope))
    await ipAssets.saveAssetBlob(blobId, scope, new Blob(['preserved-ip-media']))
    await factory.deleteProject(id, scope)
    await factoryAssets.deleteAssetBlob(blobId, scope)
    check((await ip.getProject(id, scope))?.name === '保留的口播作品', '删除工厂作品不会删除口播作品')
    check(await (await ipAssets.getAssetBlob(blobId, scope)).text() === 'preserved-ip-media', '删除工厂素材不会删除口播素材')
    return { passed: checks.length, checks }
  } finally {
    // Only this run's random account scope is removed; existing user data is untouched.
    await Promise.all([
      factory.deleteProject(id, scope), ip.deleteProject(id, scope),
      factoryAssets.deleteAssetBlob(blobId, scope), ipAssets.deleteAssetBlob(blobId, scope),
    ])
  }
}
