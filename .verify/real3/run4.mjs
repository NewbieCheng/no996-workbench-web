/**
 * 真机断言式复测：真实 API + 真实数据，三页各跑一次完整生成，**逐条判定通过/失败**。
 *
 * 与上一版（run3.mjs）的差别：run3 只导出摘要，得靠人眼看；这一版把「不该出现的情况」
 * 全部写成断言，有问题直接退出码非 0，才能做到「跑到没有问题为止」。
 *
 * 用法：node .verify/real3/run4.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, newPage, loginToken, setAuth, seedPersona, attachNet, sleep, HERE, APP } from './lib.mjs'

const report = { app: APP, startedAt: new Date().toISOString(), pages: {} }
const failures = []
let pass = 0
const say = (...a) => console.log(...a)

function check(label, ok, detail) {
  if (ok) {
    pass++
    say(`  PASS  ${label}`)
  } else {
    failures.push(`${label}${detail === undefined ? '' : ` → ${detail}`}`)
    say(`  FAIL  ${label}${detail === undefined ? '' : ` → ${detail}`}`)
  }
}

async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(HERE, name), Buffer.from(data, 'base64'))
}

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
          const done = () => { if (--left === 0) resolve(out) }
          const p0 = store.get(job.payloadId)
          p0.onsuccess = () => { out[i] = { job, data: p0.result?.data ?? null }; done() }
          p0.onerror = () => { out[i] = { job, data: null }; done() }
        })
      }
    }
  })
})()`

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
  say(`  已点击「${hit}」`)
}

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

/** 从 DOM 读过程面板，确认呈现层也是诚实的 */
async function readProcessPanel(cdp) {
  return cdp.evaluate(`(() => {
    const text = document.body.innerText
    const prog = document.querySelector('.stage-progress')
    const detail = document.querySelector('.agent-detail')
    const steps = prog
      ? [...prog.querySelectorAll('.stage-step')].map((li) => ({
          role: li.querySelector('.stage-step__label')?.textContent?.trim(),
          status: li.getAttribute('data-status'),
          label: li.querySelector('.stage-step__status')?.textContent?.trim(),
        }))
      : []
    // 详情折叠区列出的是**全部**阶段（含被跳过的），进度条只列六个可见步骤，
    // 所以「跳过有没有被如实标出」必须在详情里看。
    const detailSteps = detail
      ? [...detail.querySelectorAll('.agent-detail__item')].map((li) => ({
          role: li.querySelector('.agent-detail__role')?.textContent?.trim(),
          status: li.getAttribute('data-status'),
          label: li.querySelector('.agent-detail__status')?.textContent?.trim(),
        }))
      : []
    return {
      hasProgress: Boolean(prog),
      hasDetail: Boolean(detail),
      steps,
      detailSteps,
      // 流程结束后不该还有步骤说「待执行」——那意味着还在排队
      waitCount: (text.match(/待执行/g) || []).length,
      skippedCount: (text.match(/已跳过/g) || []).length,
      // 提示词绝不能出现在界面上
      leaksPromptMarker: /【背景上下文】|表达参考人设|«|»/.test(text),
      // 流式过滤：正文里不该出现裸 JSON 键值对（要求前面有 { 或 , 才判定，
      // 否则正常文案里的引号加冒号会误报）
      leaksJsonKey: /[{,]\\s*"[A-Za-z_][A-Za-z0-9_]*"\\s*:/.test(text),
      bodyHasResult: text.length > 500,
    }
  })()`)
}

/**
 * 一次生成的全部断言。mode: 'titles' | 'script'
 */
async function assertRun({ kind, label, job, net, before, cdp }) {
  const chat = net.slice(before).filter((c) => c.kind === 'chat')
  const search = net.slice(before).filter((c) => c.kind === 'search')
  const stages = job.data?.run?.stages ?? []
  const byId = new Map(stages.map((s) => [s.id, s]))
  const run = job.data?.run ?? {}

  // 展开「创作过程」（默认折叠），才能读到面板文案
  await cdp.evaluate(`(() => {
    const d = document.querySelector('.agent-detail')
    if (d) d.open = true
    return Boolean(d)
  })()`)
  await sleep(1000)
  const panel = await readProcessPanel(cdp)

  say(`\n----- ${label} 断言 -----`)
  say(`  调用 ${chat.length} 次模型 / ${search.length} 次检索；阶段 ${stages.length} 个`)

  // ① 任务本身必须真的成功，不能是失败或取消
  check(`${label}：任务成功（非失败/取消）`, job.job.status === 'succeeded', job.job.status)
  check(`${label}：任务无错误信息`, !job.job.error, job.job.error)

  // ② 真机调用：全部 200，且用的是真实客户端
  check(`${label}：模型调用 > 0`, chat.length > 0, chat.length)
  check(
    `${label}：全部模型调用 HTTP 200`,
    chat.every((c) => c.status === 200),
    chat.map((c) => c.status).join(','),
  )
  check(`${label}：未使用演示客户端`, job.data?.usedMock === false, job.data?.usedMock)

  // ③ 思考强度：每一次都要带上 low（用户明确要求的默认值）
  const efforts = chat.map((c) => c.body?.reasoning_effort)
  check(
    `${label}：每次调用都带 reasoning_effort=low`,
    efforts.length > 0 && efforts.every((e) => e === 'low'),
    [...new Set(efforts)].join(','),
  )

  // ④ 背景人设：每一次都要注入，不能有一步漏掉
  const bgFlags = chat.map(
    (c) =>
      Array.isArray(c.body?.messages) &&
      c.body.messages.some(
        (m) => m.role === 'system' && typeof m.content === 'string' && m.content.startsWith('【背景上下文】'),
      ),
  )
  check(
    `${label}：每一步都注入背景人设（无遗漏）`,
    bgFlags.length > 0 && bgFlags.every(Boolean),
    `${bgFlags.filter(Boolean).length}/${bgFlags.length}`,
  )
  // 背景里必须真的有定位卡片内容，不能只是个空壳标记
  const bgText = chat
    .flatMap((c) => c.body?.messages ?? [])
    .filter((m) => typeof m.content === 'string' && m.content.startsWith('【背景上下文】'))
    .map((m) => m.content)
    .join('\n')
  check(`${label}：背景含真实身份信息（定位卡片）`, bgText.includes('餐饮代运营'), bgText.slice(0, 60))
  check(`${label}：背景不含风格标签（两路不串）`, !bgText.includes('表达参考人设'))

  // ⑤ 流程完整性：没有步骤失败；跑完的状态只有 done/skipped
  check(
    `${label}：没有任何步骤失败`,
    stages.every((s) => s.status !== 'failed'),
    stages.filter((s) => s.status === 'failed').map((s) => s.id).join(','),
  )
  check(`${label}：整轮没有降级`, job.data?.fallback === false, job.data?.fallback)
  check(`${label}：整轮状态为 done`, run.status === 'done', run.status)
  check(
    `${label}：没有步骤卡在 idle/running（说明流程跑完）`,
    stages.every((s) => s.status === 'done' || s.status === 'skipped'),
    stages.filter((s) => ['idle', 'running'].includes(s.status)).map((s) => s.id).join(','),
  )

  // ⑥ 本轮修复点：被跳过的步骤不能留下上一轮的计时与提示词
  const skipped = stages.filter((s) => s.status === 'skipped')
  check(
    `${label}：跳过步骤无残留计时/提示词`,
    skipped.every((s) => s.startedAt === undefined && s.finishedAt === undefined && s.actualPrompt === undefined),
    skipped.map((s) => `${s.id}(started=${s.startedAt ?? '-'},prompt=${s.actualPrompt ? '有' : '无'})`).join(' '),
  )

  // ⑦ 评审必须真的跑过（上一轮它是最脆的一步）
  const reviewer = byId.get('reviewer')
  check(`${label}：评审步骤存在且已完成`, reviewer?.status === 'done', reviewer?.status)
  check(
    `${label}：有调用要求了 json_object`,
    chat.some((c) => c.body?.response_format?.type === 'json_object'),
    chat.map((c) => c.body?.response_format?.type ?? '-').join(','),
  )

  // ⑧ 提示词记录存在（供本机排障），且界面**不**渲染它
  check(
    `${label}：模型步骤记录了 actualPrompt（排障用）`,
    stages.some((s) => typeof s.actualPrompt === 'string' && s.actualPrompt.length > 50),
  )
  check(`${label}：界面不泄露提示词/占位符`, !panel.leaksPromptMarker, JSON.stringify(panel))
  check(`${label}：界面不泄露裸 JSON 字段名`, !panel.leaksJsonKey)
  check(`${label}：界面有真实结果内容`, panel.bodyHasResult)

  // ⑨b 呈现层与快照要一致：流程结束后不能还有「待执行」，跳过要写「已跳过」
  check(`${label}：过程面板已渲染`, panel.hasProgress, JSON.stringify(panel.steps))
  check(`${label}：详情折叠区已渲染`, panel.hasDetail, JSON.stringify(panel.detailSteps))
  check(
    `${label}：面板没有步骤显示「待执行」`,
    panel.waitCount === 0,
    `出现 ${panel.waitCount} 次；详情=${JSON.stringify(panel.detailSteps)}`,
  )
  // 详情区必须和快照一一对上：既不能少列，也不能把跳过伪装成跑过
  const skippedNow = stages.filter((s) => s.status === 'skipped').map((s) => s.id)
  const detailDoneIds = new Set(
    (panel.detailSteps ?? []).filter((s) => s.status === 'done').map((s) => s.role),
  )
  if (skippedNow.length) {
    const skippedRoles = stages
      .filter((s) => s.status === 'skipped')
      .map((s) => s.roleName)
      .filter(Boolean)
    const shownSkipped = (panel.detailSteps ?? []).filter((s) => s.status === 'skipped')
    check(
      `${label}：被跳过的步骤在详情里标为 skipped`,
      shownSkipped.length === skippedNow.length,
      `快照跳过=${skippedNow.join(',')}(${skippedRoles.join(',')})；详情=${JSON.stringify(panel.detailSteps)}`,
    )
    check(`${label}：被跳过的步骤显示「已跳过」文案`, panel.skippedCount > 0, panel.skippedCount)
    // 关键：跳过的角色名绝不能出现在标记为 done 的步骤里
    const mislabeled = skippedRoles.filter((r) => detailDoneIds.has(r))
    check(`${label}：跳过没被伪装成已完成`, mislabeled.length === 0, mislabeled.join(','))
  }

  // ⑨ 产物必须有内容
  const productCount = (job.data?.segments ?? job.data?.candidates ?? []).length
  check(`${label}：产出了内容（分段/候选 > 0）`, productCount > 0, productCount)

  return { chat, search, stages, productCount, run, panel }
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
  say(`登录成功（token ${token.length} 字符）`)
  await seedPersona(cdp)
  say('人设已写入本机库')

  /* ------------------------------ 爆款标题 ------------------------------ */
  say('\n========== [1/3] 爆款标题 ==========')
  await cdp.send('Page.navigate', { url: `${APP}/workbench/titles` })
  await sleep(3500)
  await fill(cdp, '.titles-sentence__field', '上班族', 0)
  await fill(cdp, '.titles-sentence__field', '早八通勤穿搭', 1)
  // 确认人设控件默认开启
  const ctl = await cdp.evaluate(`(() => {
    const r = document.querySelector('.persona-injection')
    return { on: r?.hasAttribute('data-on') ?? false, text: r?.querySelector('.persona-injection__text')?.textContent?.trim() ?? null }
  })()`)
  check('标题页：人设控件默认开启', ctl.on === true, JSON.stringify(ctl))

  let before = net.length
  let ids = (await cdp.evaluate(READ_JOBS('titles_generate'))).map((j) => j.job.id)
  await clickGenerate(cdp, '/生成爆款标题/')
  const t1 = await waitNewJob(cdp, 'titles_generate', ids, 420_000)
  await sleep(2500)
  await shot(cdp, 'r4-1-标题-结果.png')
  report.pages.titles = await assertRun({ kind: 'titles_generate', label: '标题', job: t1, net, before, cdp })

  /* ------------------------------ 视频脚本 ------------------------------ */
  say('\n========== [2/3] 视频脚本 ==========')
  await cdp.send('Page.navigate', { url: `${APP}/workbench/video-script` })
  await sleep(3500)
  await fill(cdp, '.sl-box__input', '儿童保温杯', 0)
  const ctl2 = await cdp.evaluate(`(() => {
    const r = document.querySelector('.persona-injection')
    return { on: r?.hasAttribute('data-on') ?? false }
  })()`)
  check('视频页：人设控件默认开启', ctl2.on === true, JSON.stringify(ctl2))

  before = net.length
  ids = (await cdp.evaluate(READ_JOBS('script_generate'))).map((j) => j.job.id)
  await clickGenerate(cdp, '/生成(视频|直播)?脚本/')
  const t2 = await waitNewJob(cdp, 'script_generate', ids, 600_000)
  await sleep(2500)
  await shot(cdp, 'r4-2-视频-结果.png')
  report.pages.video = await assertRun({ kind: 'script_generate', label: '视频', job: t2, net, before, cdp })

  /* ------------------------------ 直播脚本 ------------------------------ */
  say('\n========== [3/3] 直播脚本 ==========')
  await cdp.send('Page.navigate', { url: `${APP}/workbench/live-script` })
  await sleep(3500)
  await fill(cdp, '.sl-box__input', '秋冬护手霜', 0)
  const ctl3 = await cdp.evaluate(`(() => {
    const r = document.querySelector('.persona-injection')
    return { on: r?.hasAttribute('data-on') ?? false }
  })()`)
  check('直播页：人设控件默认开启', ctl3.on === true, JSON.stringify(ctl3))

  before = net.length
  ids = (await cdp.evaluate(READ_JOBS('script_generate'))).map((j) => j.job.id)
  await clickGenerate(cdp, '/生成(视频|直播)?脚本/')
  const t3 = await waitNewJob(cdp, 'script_generate', ids, 600_000)
  await sleep(2500)
  await shot(cdp, 'r4-3-直播-结果.png')
  report.pages.live = await assertRun({ kind: 'script_generate', label: '直播', job: t3, net, before, cdp })

  /* --------------------------- 关掉开关后的行为 --------------------------- */
  say('\n========== [附加] 关掉人设开关 ==========')
  await cdp.send('Page.navigate', { url: `${APP}/workbench/titles` })
  await sleep(3000)
  await cdp.evaluate(`document.querySelector('.persona-injection__input')?.click()`)
  await sleep(600)
  const offState = await cdp.evaluate(`(() => {
    const r = document.querySelector('.persona-injection')
    return { on: r?.hasAttribute('data-on') ?? false, text: r?.querySelector('.persona-injection__text')?.textContent?.trim() ?? null }
  })()`)
  check('关掉后：状态为不注入', offState.on === false && offState.text === '不注入人设', JSON.stringify(offState))
  await shot(cdp, 'r4-4-人设已关闭.png')
} finally {
  report.finishedAt = new Date().toISOString()
  report.passed = pass
  report.failures = failures
  // 网络细节只留可判读的字段，避免报告过大
  report.calls = net.map((n) => ({
    kind: n.kind,
    status: n.status,
    stageHint: n.body?.stageHint,
    model: n.body?.model,
    effort: n.body?.reasoning_effort,
    rf: n.body?.response_format?.type,
    maxTokens: n.body?.max_tokens,
    msgs: Array.isArray(n.body?.messages) ? n.body.messages.length : undefined,
    hasBg: Array.isArray(n.body?.messages)
      ? n.body.messages.some((m) => typeof m.content === 'string' && m.content.startsWith('【背景上下文】'))
      : undefined,
  }))
  writeFileSync(join(HERE, 'report4.json'), JSON.stringify(report, null, 2), 'utf8')

  say('\n================================================================')
  say(`  通过 ${pass} 项，失败 ${failures.length} 项`)
  if (failures.length) {
    say('  失败明细：')
    failures.forEach((f) => say(`    ! ${f}`))
  } else {
    say('  ✅ 三页真机复测无遗留问题')
  }
  say(`  报告 → .verify/real3/report4.json`)

  try {
    chrome.kill()
  } catch {
    /* ignore */
  }
  process.exit(failures.length ? 1 : 0)
}
