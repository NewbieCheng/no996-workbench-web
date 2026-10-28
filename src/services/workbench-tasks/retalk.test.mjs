import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// In-memory bundles keep axios/auth/i18n out of these mock-only assertions.
async function load(relative, stubs = {}) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(relative, import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'retalk-mocks', setup(b) {
    b.onResolve({ filter: /(?:api\/video-retalk|api\/models|api\/client|\.\/client|\.\/errors|models)$/ }, (args) => ({
      path: args.path.includes('video-retalk')
        ? 'retalk'
        : args.path.includes('models')
          ? 'models'
          : args.path.endsWith('errors')
            ? 'errors'
            : 'client',
      namespace: 'mock',
    }))
    b.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({
      contents: stubs[args.path] ?? (args.path === 'errors'
        ? 'export function throwApiError(e) { throw e }; export function parseApiError() { return null }'
        : args.path === 'client'
          ? 'export const api = globalThis.__retalkApi; export const apiErrorMessage = e => e.message'
          : args.path === 'models'
            ? 'export const resolveDefaultLipsyncModel = async () => globalThis.__retalkLipsyncModel ?? "videoretalk"'
            : 'export const submitRetalk = (...args) => globalThis.__retalkMock.submit(...args); export const getRetalkTask = (...args) => globalThis.__retalkMock.get(...args); export const cancelRetalkTask = (...args) => globalThis.__retalkMock.cancel(...args)'),
    }))
  } }] })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${Math.random()}`)
}
function installLocks() {
  const chains = new Map()
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { async request(name, options, callback) {
    const fn = typeof options === 'function' ? options : callback
    if (typeof options !== 'function' && options.ifAvailable && chains.has(name)) return fn(null)
    const before = chains.get(name) ?? Promise.resolve()
    const current = before.then(() => fn({ name }))
    const held = current.catch(() => undefined)
    chains.set(name, held)
    try { return await current } finally { if (chains.get(name) === held) chains.delete(name) }
  } } } })
}
function fixture() {
  const job = { id: 'local', ownerUserId: 1, payloadId: 'p', kind: 'digital_human_retalk', status: 'queued', createdAt: 1, meta: {} }
  let payload = { projectId: 'project', segmentId: 'segment', versionId: 'version', clientRequestId: 'same-key', video: 'oss://video', audio: 'oss://audio', title: 'title' }
  return { job, get payload() { return payload }, repo: { async getJob() { return { ...job } }, async getPayload() { return { data: structuredClone(payload) } }, async patchPayload(_id, data) { payload = data }, async patchJob(_id, patch) { Object.assign(job, patch) }, async listJobsForUser() { return [{ ...job }] } } }
}

test('upload policy is nested, file is last, sanitized key is the returned reference', async () => {
  const { buildLipsyncUpload } = await load('../../api/media-uploads.ts')
  const p = { direct: false, max_file_size_mb: 300, policy: { upload_host: 'https://bucket.example', policy: 'signed', signature: 'signature', oss_access_key_id: 'temporary-id', x_oss_object_acl: 'private', x_oss_forbid_overwrite: 'true', key_prefix: 'temp/prefix', expire_in_seconds: 300 } }
  const result = buildLipsyncUpload(new File(['video'], '../中文.mp4'), 'video', p)
  const keys = [...result.form.keys()]
  assert.equal(keys.at(-1), 'file')
  assert.equal(result.reference, `oss://${result.form.get('key')}`)
  assert.doesNotMatch(result.form.get('key'), /\.\.|中文/)
  assert.throws(() => buildLipsyncUpload(new File(['x'], 'x.mp4'), 'video', { direct: true }), /公网 URL/)
  assert.throws(() => buildLipsyncUpload(new File(['xx'], 'x.mp4'), 'video', { ...p, max_file_size_mb: 0.000001 }), /超过/)
})

test('uploads use dedicated unauthenticated XHR and measured progress', async () => {
  const p = { direct: false, max_file_size_mb: 300, policy: { upload_host: 'https://oss.example', policy: 'p', signature: 's', oss_access_key_id: 'id', x_oss_object_acl: 'private', x_oss_forbid_overwrite: 'true', key_prefix: 'temp', expire_in_seconds: 300 } }
  globalThis.__retalkApi = { async get(path, config) { assert.equal(path, '/ai/uploads/policy'); assert.equal(config.params.capability, 'lipsync'); return { data: p } } }
  let sent
  globalThis.XMLHttpRequest = class { upload = {}; open(method, host) { assert.equal(method, 'POST'); assert.equal(host, p.policy.upload_host) } send(form) { sent = this; assert.equal([...form.keys()].at(-1), 'file'); this.upload.onprogress({ lengthComputable: true, loaded: 2, total: 4 }); this.status = 200; this.onload() } }
  const { uploadLipsyncAsset } = await load('../../api/media-uploads.ts')
  const progress = []
  assert.equal(await uploadLipsyncAsset(new File(['x'], 'x.mp4'), 'video', { onProgress: (n) => progress.push(n) }), 'oss://temp/x.mp4')
  assert.equal(sent.withCredentials, false)
  assert.deepEqual(progress, [50])
})

test('retalk transport uses registered routes, resolved lipsync model, abort signal and authoritative cancellation query', async () => {
  const calls = []; const ac = new AbortController()
  globalThis.__retalkApi = {
    async post(path, body, config) { calls.push({ path, body, config }); return { data: path.endsWith('/cancel') ? undefined : { task_id: 'rt/one', status: 'QUEUED' } } },
    async get(path, config) { calls.push({ path, config }); return { data: { task_id: 'rt/one', status: 'CANCELED' } } },
  }
  const { submitRetalk, getRetalkTask, cancelRetalkTask } = await load('../../api/video-retalk.ts')
  await submitRetalk({ video: 'oss://video', audio: 'https://cdn.example/audio.wav', client_request_id: 'stable' }, ac.signal)
  assert.equal(calls[0].path, '/ai/videos/retalk'); assert.equal(calls[0].body.model, 'videoretalk'); assert.equal(calls[0].config.signal, ac.signal)
  await getRetalkTask('rt/one', ac.signal)
  assert.equal(calls[1].path, '/ai/videos/retalk/tasks/rt%2Fone')
  assert.equal((await cancelRetalkTask('rt/one', ac.signal)).status, 'CANCELED')
  assert.equal(calls[2].path, '/ai/videos/retalk/tasks/rt%2Fone/cancel')
  assert.equal(calls[3].path, '/ai/videos/retalk/tasks/rt%2Fone')
  await assert.rejects(submitRetalk({ video: 'blob:local', audio: 'oss://audio', client_request_id: 'stable' }), /公网 URL/)
})

test('accepted remote task persists status and source_url', async () => {
  installLocks()
  const f = fixture()
  let count = 0
  globalThis.__retalkMock = { async submit(input) { count++; assert.equal(input.client_request_id, 'same-key'); return { task_id: 'rt_one', status: 'QUEUED', source_url: 'temporary', created_at: 'now' } } }
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const observer = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  await Promise.all([observer.submit('local'), observer.submit('local')])
  assert.equal(count, 1)
  assert.equal(f.job.status, 'running')
  assert.equal(f.payload.taskId, 'rt_one')
  assert.equal(f.payload.status, 'QUEUED')
  assert.equal(f.payload.result.source_url, 'temporary')
  globalThis.__retalkMock.get = async () => ({ task_id: 'rt_one', status: 'SUCCEEDED', video_url: '/media/video.mp4', created_at: 'now' })
  await observer.refresh('local')
  assert.equal(f.payload.result.source_url, 'temporary')
  assert.equal(f.payload.result.video_url, '/media/video.mp4')
  observer.dispose()
})

test('uncertain submit is never automatically replayed and explicit confirmation reuses id', async () => {
  installLocks()
  const f = fixture(); const ids = []
  globalThis.__retalkMock = { async submit(input) { ids.push(input.client_request_id); if (ids.length === 1) throw new Error('network timeout'); return { task_id: 'rt_one', status: 'QUEUED', created_at: 'now' } } }
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const observer = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  await observer.submit('local'); await observer.submit('local')
  assert.equal(f.payload.submissionUncertain, true)
  assert.equal(ids.length, 1)
  await observer.submit('local', true)
  assert.deepEqual(ids, ['same-key', 'same-key'])
  observer.dispose()
})

test('429 is explicit failure, not automatic replay; cancel 409 preserves remote state', async () => {
  installLocks()
  const f = fixture()
  globalThis.__retalkMock = { async submit() { throw Object.assign(new Error('queue saturated'), { status: 429 }) }, async cancel() { throw Object.assign(new Error('already running'), { status: 409 }) } }
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const observer = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  await observer.submit('local')
  assert.equal(f.job.status, 'failed'); assert.equal(f.payload.submissionUncertain, false)
  await assert.rejects(observer.submit('local', true), /明确结束/)
  f.job.status = 'running'; await f.repo.patchPayload('p', { ...f.payload, taskId: 'rt_one', status: 'RUNNING' })
  await assert.rejects(observer.cancel('local'), { status: 409 })
  assert.equal(f.job.status, 'running'); assert.equal(f.payload.status, 'RUNNING')
  observer.dispose()
})

test('queue saturation records the server retry delay without replaying a submission', async () => {
  installLocks()
  const f = fixture(); let calls = 0
  globalThis.__retalkMock = { async submit() { calls++; throw Object.assign(new Error('queue saturated'), { status: 429, code: 'QUEUE_SATURATED', retryAfterSeconds: 30 }) } }
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const observer = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  const before = Date.now(); await observer.submit('local'); await observer.submit('local')
  assert.equal(calls, 1)
  assert.ok(f.payload.retryAfterUntil >= before + 30000)
  assert.equal(f.job.status, 'failed')
  observer.dispose()
})

test('poll cadence and observation caps are honest and manual refresh recovers', async () => {
  installLocks()
  const { RetalkTaskObserver, retalkPollDelay, retalkObservationExpired } = await load('./retalk-observer.ts')
  assert.equal(retalkPollDelay('QUEUED'), 5000); assert.equal(retalkPollDelay('RUNNING'), 15000)
  assert.equal(retalkObservationExpired({ status: 'QUEUED', observationStartedAt: 0 }, 600000), true)
  assert.equal(retalkObservationExpired({ status: 'RUNNING', observationStartedAt: 0 }, 600000), false)
  const f = fixture(); f.job.status = 'running'; await f.repo.patchPayload('p', { ...f.payload, taskId: 'rt_one', status: 'QUEUED', observationStartedAt: 0 })
  let queried = 0
  globalThis.__retalkMock = { async get() { queried++; return { task_id: 'rt_one', status: 'SUCCEEDED', video_url: '/media/video/result.mp4', points_charged: 80, created_at: 'now' } } }
  const observer = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  await observer.refresh('local', false)
  assert.equal(queried, 0); assert.equal(f.job.status, 'running'); assert.equal(f.payload.observationPaused, true)
  await observer.refresh('local')
  assert.equal(queried, 1); assert.equal(f.job.status, 'succeeded'); assert.equal(f.payload.result.points_charged, 80)
  observer.dispose()
})

test('manual refresh queries a completed task and preserves its result on 404', async () => {
  installLocks()
  const f = fixture(); f.job.status = 'succeeded'
  await f.repo.patchPayload('p', { ...f.payload, taskId: 'rt_one', status: 'SUCCEEDED', result: { task_id: 'rt_one', status: 'SUCCEEDED', created_at: 'now' } })
  let calls = 0
  globalThis.__retalkMock = { async get() { calls++; if (calls === 2) throw Object.assign(new Error('not found'), { status: 404 }); return { task_id: 'rt_one', status: 'SUCCEEDED', video_url: '/media/result.mp4', created_at: 'now' } } }
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const observer = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  await observer.refresh('local', false); assert.equal(calls, 0)
  await observer.refresh('local'); assert.equal(f.payload.result.video_url, '/media/result.mp4')
  await assert.rejects(observer.refresh('local'), { status: 404 })
  assert.equal(f.job.status, 'succeeded'); assert.equal(f.payload.result.video_url, '/media/result.mp4')
  observer.dispose()
})

test('recovery preserves accepted remote tasks and requeues only work that never attempted HTTP', async () => {
  installLocks()
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const f = fixture(); f.job.status = 'running'
  globalThis.__retalkMock = { async get() { return { task_id: 'rt_saved', status: 'RUNNING', created_at: 'now' } } }
  const observer = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  await f.repo.patchPayload('p', { ...f.payload, taskId: 'rt_saved', status: 'RUNNING', submissionAttempted: true })
  await observer.recover()
  assert.equal(f.job.status, 'running'); assert.equal(f.payload.taskId, 'rt_saved')
  await f.repo.patchPayload('p', { ...f.payload, taskId: undefined, status: undefined, submissionAttempted: false })
  await observer.recover()
  assert.equal(f.job.status, 'queued')
  observer.dispose()
})

test('recovery queries paused and expired observations once and restores the real result', async () => {
  installLocks()
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const f = fixture(); f.job.status = 'running'
  await f.repo.patchPayload('p', { ...f.payload, taskId: 'rt_saved', status: 'RUNNING', submissionAttempted: true, observationPaused: true, observationStartedAt: 0, lastCheckedAt: 0 })
  let calls = 0
  globalThis.__retalkMock = { async submit() { assert.fail('must not resubmit') }, async get(id) { calls++; assert.equal(id, 'rt_saved'); return { task_id: id, status: 'SUCCEEDED', video_url: '/media/result.mp4', created_at: 'now' } } }
  const a = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  const b = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  await Promise.all([a.recover(), b.recover()])
  assert.equal(calls, 1); assert.equal(f.job.status, 'succeeded')
  assert.equal(f.payload.observationPaused, false); assert.equal(f.payload.result.video_url, '/media/result.mp4')
  a.dispose(); b.dispose()
})

test('recovery restarts bounded observation for running tasks and keeps real errors', async () => {
  installLocks()
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const f = fixture(); f.job.status = 'running'
  await f.repo.patchPayload('p', { ...f.payload, taskId: 'rt_saved', status: 'RUNNING', submissionAttempted: true, observationPaused: true, observationStartedAt: 0 })
  let fail = false; let calls = 0
  globalThis.__retalkMock = { async get(id) { calls++; if (fail) throw new Error('network unavailable'); return { task_id: id, status: 'RUNNING', created_at: 'now' } } }
  const observer = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  const before = Date.now(); await observer.recover()
  assert.equal(f.job.status, 'running'); assert.equal(f.payload.observationPaused, false)
  assert.ok(f.payload.observationStartedAt >= before)
  await observer.recover(); assert.equal(calls, 1)
  await f.repo.patchPayload('p', { ...f.payload, observationPaused: true })
  fail = true; await observer.recover()
  assert.equal(f.job.status, 'running'); assert.equal(f.payload.observationError, 'network unavailable')
  observer.dispose()
})

test('returning to a visible browser tab triggers a recovery query', async () => {
  installLocks()
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const f = fixture(); f.job.status = 'running'
  await f.repo.patchPayload('p', { ...f.payload, taskId: 'rt_saved', status: 'RUNNING', submissionAttempted: true, observationPaused: true })
  let listener
  globalThis.document = { hidden: false, addEventListener(_name, fn) { listener = fn }, removeEventListener() {} }
  let resolveChanged
  const changed = new Promise(resolve => { resolveChanged = resolve })
  globalThis.__retalkMock = { async get(id) { return { task_id: id, status: 'FAILED', error: '生成失败', created_at: 'now' } } }
  const observer = new RetalkTaskObserver(f.repo, 1, () => true, resolveChanged)
  try {
    listener(); await changed
    assert.equal(f.job.status, 'failed'); assert.equal(f.job.errorMessage, '生成失败')
  } finally { observer.dispose(); delete globalThis.document }
})

test('recovery skips uncertain submissions and other accounts', async () => {
  installLocks()
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const f = fixture(); f.job.status = 'running'
  await f.repo.patchPayload('p', { ...f.payload, submissionAttempted: true, submissionUncertain: true })
  globalThis.__retalkMock = { async get() { assert.fail('must not query') }, async submit() { assert.fail('must not submit') } }
  const observer = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  await observer.recover(); assert.equal(f.job.status, 'running'); assert.equal(f.payload.submissionUncertain, true)
  const other = new RetalkTaskObserver(f.repo, 2, () => true, () => {})
  await other.recover()
  observer.dispose(); other.dispose()
})

test('logout/dispose and other owners never issue remote requests; no locks fails closed', async () => {
  installLocks()
  const { RetalkTaskObserver } = await load('./retalk-observer.ts')
  const f = fixture()
  globalThis.__retalkMock = { async submit() { assert.fail('must not submit') } }
  const observer = new RetalkTaskObserver(f.repo, 2, () => true, () => {})
  await assert.rejects(observer.submit('local'), /当前账号/)
  observer.dispose(); await observer.submit('local')
  const loggedOut = new RetalkTaskObserver(f.repo, 1, () => false, () => {})
  await loggedOut.submit('local'); loggedOut.dispose()
  globalThis.document = { hidden: true, addEventListener() {}, removeEventListener() {} }
  const hidden = new RetalkTaskObserver(f.repo, 1, () => true, () => {})
  await hidden.submit('local'); hidden.dispose(); delete globalThis.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })
  const { requireTaskLocks } = await load('./task-locks.ts')
  assert.throws(requireTaskLocks, /Web Locks/)
})

test('patchJob accepts title and updates job record', async () => {
  const f = fixture()
  await f.repo.patchJob('local', { title: '全新口播项目' })
  assert.equal(f.job.title, '全新口播项目')
})

