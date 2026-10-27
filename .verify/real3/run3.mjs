/**
 * 三页真机端到端复测：真实 API + 真实数据，每页跑一次完整生成。
 *
 * 与前几轮的关键差别：这一轮要证明**本轮修复**在真机成立，所以断言都对着
 * 真机才会出现的失败模式（超时、截断、整轮降级、背景未注入），而不是演示模式的快路径。
 *
 * 用法：node .verify/real3/run3.mjs
 */
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { launch, newPage, loginToken, setAuth, seedPersona, attachNet, sleep, HERE, APP } from './lib.mjs'

const results = { app: APP, startedAt: new Date().toISOString(), pages: {} }
const say = (...a) => console.log(...a)

async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(HERE, name), Buffer.from(data, 'base64'))
  say(`   截图 → ${name}`)
}

/** 读指定 kind 的全部任务（最新在前），带 payload.data */
const READ_JOBS = (kind) => `(() => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('no996-workbench-tasks', 3)
    req.onerror = () => reject(new Error('open failed'))
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('jobs')) return resolve([])
      const tx = db.transaction('jobs', 'readonly')
      const all = tx.objectStore('jobs').getAll()
      all.onerror = () => reject(all.error)
      all.onsuccess = () => {
        const jobs = (all.result || [])
          .filter((j) => j.kind === ${JSON.stringify(kind)})
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        if (!jobs.length) return resolve([])
        const tx2 = db.transaction('payloads', 'readonly')
        const store = tx2.objectStore('payloads')
        let left = jobs.length
        const out = new Array(jobs.length)
        jobs.forEach((job, i) => {
          const p = store.get(job.payloadId)
          p.onsuccess = () => {
            out[i] = { job, data: p.result?.data ?? null }
            if (--left === 0) resolve(out)
          }
          p.onerror = () => {
            out[i] = { job, data: null }
            if (--left === 0) resolve(out)
          }
        })
      }
    }
  })
})()`

/** 点「生成…」按钮 */
async function clickGenerate(cdp, pattern) {
  const hit = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => ${pattern}.test((b.textContent || '').trim()) && !b.disabled,
    )
    if (!btn) return null
    btn.click()
    return btn.textContent.trim()
  })()`)
  if (!hit) throw new Error('找不到生成按钮')
  say(`   已点击「${hit}」`)
}

/** 填受控输入：必须走原生 setter + input 事件，否则 React 收不到 */
async function fill(cdp, selector, value, nth = 0) {
  const ok = await cdp.evaluate(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(
      (el) => el.type !== 'checkbox' && el.getBoundingClientRect().width > 0,
    )
    const el = els[${nth}]
    if (!el) return false
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return el.value === ${JSON.stringify(value)}
  })()`)
  if (!ok) throw new Error(`填值失败: ${selector}[${nth}]`)
}

/** 等一个新任务出现并跑到终态 */
async function waitNewJob(cdp, kind, beforeIds, timeout) {
  const deadline = Date.now() + timeout
  let seen = null
  while (Date.now() < deadline) {
    const jobs = await cdp.evaluate(READ_JOBS(kind)).catch(() => [])
    const fresh = jobs.find((j) => !beforeIds.includes(j.job.id))
    if (fresh) {
      seen = fresh
      if (['succeeded', 'failed', 'cancelled'].includes(fresh.job.status)) return seen
    }
    await sleep(2000)
  }
  if (seen) return seen
  throw new Error(`等不到新的 ${kind} 任务`)
}

/** 汇总一次运行的证据 */
function summarize(entry, net, before) {
  const calls = net.slice(before)
  const chat = calls.filter((c) => c.kind === 'chat')
  const algoTrace = entry.data?.run?.stages ?? []
  const segs = entry.data?.segments ?? entry.data?.candidates ?? []
  return {
    status: entry.job.status,
    error: entry.job.error ?? null,
    meta: entry.job.meta ?? null,
    fallback: entry.data?.fallback ?? null,
    usedMock: entry.data?.usedMock ?? null,
    chatCalls: chat.length,
    chatStatuses: chat.map((c) => c.status),
    models: [...new Set(chat.map((c) => c.body?.model).filter(Boolean))],
    efforts: [...new Set(chat.map((c) => c.body?.reasoning_effort).filter(Boolean))],
    responseFormats: [...new Set(chat.map((c) => c.body?.response_format?.type ?? '(none)'))],
    backgroundInjected: chat.map(
      (c) =>
        Array.isArray(c.body?.messages) &&
        c.body.messages.some(
          (m) => m.role === 'system' && typeof m.content === 'string' && m.content.startsWith('【背景上下文】'),
        ),
    ),
    searchCalls: calls.filter((c) => c.kind === 'search').length,
    stages: algoTrace.map((s) => ({ id: s.id, status: s.status, ms: s.ms, kind: s.kind })),
    reviewRounds: entry.data?.review?.rounds?.length ?? null,
    productCount: segs.length,
    hardCheck: entry.data?.hardCheck ?? entry.data?.check ?? null,
  }
}

const chrome = await launch()
const page = await newPage()
const { cdp } = page
const net = []
attachNet(cdp, net)

try {
  await cdp.send('Page.navigate', { url: `${APP}/workbench/titles` })
  await sleep(2500)
  const token = await loginToken()
  await setAuth(cdp, token)
  say(`登录成功（token 长度 ${token.length}）`)
  say(`人设写入: ${await seedPersona(cdp)}`)

  /* ============================ 1. 爆款标题 ============================ */
  say('\n[1/3] 爆款标题 …')
  await cdp.send('Page.navigate', { url: `${APP}/workbench/titles` })
  await sleep(3500)
  await fill(cdp, '.titles-sentence__field', '上班族', 0)
  await fill(cdp, '.titles-sentence__field', '早八通勤穿搭', 1)
  await shot(cdp, 'r1-标题-已填表.png')

  let before = net.length
  let beforeJobs = (await cdp.evaluate(READ_JOBS('titles_generate'))).map((j) => j.job.id)
  await clickGenerate(cdp, '/生成爆款标题/')
  const t1 = await waitNewJob(cdp, 'titles_generate', beforeJobs, 420_000)
  await sleep(2000)
  await shot(cdp, 'r1-标题-结果.png')
  results.pages.titles = summarize(t1, net, before)
  say(`   状态=${results.pages.titles.status}  调用=${results.pages.titles.chatCalls}  候选=${results.pages.titles.productCount}  降级=${results.pages.titles.fallback}`)

  /* ============================ 2. 视频脚本 ============================ */
  say('\n[2/3] 视频脚本 …')
  await cdp.send('Page.navigate', { url: `${APP}/workbench/video-script` })
  await sleep(3500)
  await fill(cdp, '.sl-box__input', '儿童保温杯', 0)
  await shot(cdp, 'r2-视频-已填表.png')

  before = net.length
  beforeJobs = (await cdp.evaluate(READ_JOBS('script_generate'))).map((j) => j.job.id)
  await clickGenerate(cdp, '/生成(视频|直播)?脚本/')
  const t2 = await waitNewJob(cdp, 'script_generate', beforeJobs, 600_000)
  await sleep(2000)
  await shot(cdp, 'r2-视频-结果.png')
  results.pages.video = summarize(t2, net, before)
  say(`   状态=${results.pages.video.status}  调用=${results.pages.video.chatCalls}  分段=${results.pages.video.productCount}  降级=${results.pages.video.fallback}`)

  /* ============================ 3. 直播脚本 ============================ */
  say('\n[3/3] 直播脚本 …')
  await cdp.send('Page.navigate', { url: `${APP}/workbench/live-script` })
  await sleep(3500)
  await fill(cdp, '.sl-box__input', '秋冬护手霜', 0)
  await shot(cdp, 'r3-直播-已填表.png')

  before = net.length
  beforeJobs = (await cdp.evaluate(READ_JOBS('script_generate'))).map((j) => j.job.id)
  await clickGenerate(cdp, '/生成(视频|直播)?脚本/')
  const t3 = await waitNewJob(cdp, 'script_generate', beforeJobs, 600_000)
  await sleep(2000)
  await shot(cdp, 'r3-直播-结果.png')
  results.pages.live = summarize(t3, net, before)
  say(`   状态=${results.pages.live.status}  调用=${results.pages.live.chatCalls}  分段=${results.pages.live.productCount}  降级=${results.pages.live.fallback}`)
} finally {
  results.finishedAt = new Date().toISOString()
  writeFileSync(join(HERE, 'report3.json'), JSON.stringify(results, null, 2), 'utf8')
  say('\n报告 → .verify/real3/report3.json')
  try {
    chrome.kill()
  } catch {
    /* ignore */
  }
  // CDP socket 与 Chrome 子进程会拖住事件循环，显式退出
  process.exit(0)
}
