/**
 * 只读回放：重开上次复测留下的 Chrome profile，把真实任务记录原样导出。
 *
 * 目的：不重复调用模型（不花积分），也能拿到上一次真机跑出来的**阶段级**证据。
 * 用 launch({ fresh: false }) 保留 profile。
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, newPage, loginToken, setAuth, sleep, HERE, APP } from './lib.mjs'

const READ_JOBS = (kind) => `(() => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('no996-workbench-tasks', 3)
    req.onerror = () => reject(new Error('open failed'))
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('jobs')) return resolve([])
      const all = db.transaction('jobs', 'readonly').objectStore('jobs').getAll()
      all.onerror = () => reject(all.error)
      all.onsuccess = () => {
        const jobs = (all.result || [])
          .filter((j) => j.kind === ${JSON.stringify(kind)})
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        if (!jobs.length) return resolve([])
        const store = db.transaction('payloads', 'readonly').objectStore('payloads')
        let left = jobs.length
        const out = new Array(jobs.length)
        jobs.forEach((job, i) => {
          const p = store.get(job.payloadId)
          const done = () => { if (--left === 0) resolve(out) }
          p.onsuccess = () => { out[i] = { job, data: p.result?.data ?? null }; done() }
          p.onerror = () => { out[i] = { job, data: null }; done() }
        })
      }
    }
  })
})()`

const chrome = await launch({ fresh: false })
const page = await newPage()
const { cdp } = page

await cdp.send('Page.navigate', { url: `${APP}/workbench/titles` })
await sleep(2500)
await setAuth(cdp, await loginToken())
// 必须刷新，页面才会带着登录态读 IndexedDB
await cdp.send('Page.navigate', { url: `${APP}/workbench/titles` })
await sleep(2500)

const dump = {}
for (const kind of ['titles_generate', 'script_generate']) {
  const rows = await cdp.evaluate(READ_JOBS(kind))
  dump[kind] = rows.map((r) => ({
    id: r.job.id,
    status: r.job.status,
    error: r.job.error ?? null,
    meta: r.job.meta ?? null,
    createdAt: r.job.createdAt,
    title: r.job.title,
    subtitle: r.job.subtitle ?? null,
    // payload 里真正写了什么，原样保留
    data: r.data,
  }))
  console.log(`${kind}: ${rows.length} 条`)
}

writeFileSync(join(HERE, 'dump-raw.json'), JSON.stringify(dump, null, 2), 'utf8')
console.log('原始快照 → .verify/real3/dump-raw.json')

/* 顺带把每步的关键事实打印出来，便于人读 */
for (const [kind, rows] of Object.entries(dump)) {
  for (const r of rows.slice(0, 3)) {
    console.log(`\n===== ${kind}  ${r.id}  status=${r.status} =====`)
    console.log(`  title=${r.title}`)
    const run = r.data?.run
    console.log(`  data 顶层键: ${r.data ? Object.keys(r.data).join(', ') : '(null)'}`)
    if (run?.stages) {
      console.log(`  run.status=${run.status}  run.round=${run.round}  阶段数=${run.stages.length}`)
      for (const s of run.stages) {
        const ms = s.startedAt && s.finishedAt ? s.finishedAt - s.startedAt : '-'
        console.log(
          `    ${String(s.id).padEnd(20)} ${String(s.status).padEnd(8)} round=${s.round ?? '-'} ${String(ms).padStart(7)}ms  headline=${(s.headline ?? '').slice(0, 24)}  prompt=${s.actualPrompt ? s.actualPrompt.length + '字' : '无'}  stream=${s.streamingContent ? s.streamingContent.length + '字' : '无'}`,
        )
      }
    } else {
      console.log('  (payload 里没有 run.stages)')
    }
    if (r.data?.review) console.log(`  review.rounds=${r.data.review.rounds?.length}`)
  }
}

chrome.kill()
process.exit(0)
