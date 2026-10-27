/**
 * 真机端到端复测（CDP 驱动 Chrome，走真实 API + 真实数据）。
 *
 * 与前几轮的差别：这一轮专门验证**本轮修复**，所以每一步都要拿到可判读的证据：
 *   1. 人设默认注入 → 先往本机 IndexedDB 写一条**真实人设**（含定位卡片字段）；
 *   2. 三页各跑一遍真实生成，抓真实任务记录与阶段快照；
 *   3. 断言：没有「假成功」（预填降级却声称 AI 已补全）、没有残缺 JSON 导致的整轮降级、
 *      流程没有因为超时被砍断、评审步骤真的跑过。
 *
 * 用法：
 *   node .verify/real3/run.mjs            # 全流程
 *   node .verify/real3/run.mjs --page titles
 */
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = process.env.APP_BASE || 'http://127.0.0.1:8913'
const CDP_PORT = Number(process.env.CDP_PORT || 9333)
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
/**
 * profile 必须放在**项目之外**。
 * 放在 `.verify/` 里会被 vite 的文件监听盯上，Chrome 边写它边被删 → EBUSY → 监听器抛错退出。
 */
const PROFILE = join(tmpdir(), 'no996-real3-profile')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* --------------------------- 最小 CDP 客户端 --------------------------- */
class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.sessionId = null
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    })
  }
  send(method, params = {}, sessionId = this.sessionId) {
    const id = ++this.id
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify(payload))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP 超时: ${method}`))
        }
      }, 120_000)
    })
  }
  async evaluate(expression, awaitPromise = true) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    })
    if (res.exceptionDetails) {
      throw new Error(
        res.exceptionDetails.exception?.description ?? JSON.stringify(res.exceptionDetails),
      )
    }
    return res.result.value
  }
}

async function launch({ fresh = true } = {}) {
  // 上次异常退出会留下占用中的 profile 目录：删不掉就直接换一个，不要因此中断复测
  if (fresh && existsSync(PROFILE)) {
    for (let i = 0; i < 6; i++) {
      try {
        rmSync(PROFILE, { recursive: true, force: true })
        break
      } catch {
        await new Promise((r) => setTimeout(r, 700))
      }
    }
  }
  mkdirSync(PROFILE, { recursive: true })
  const { spawn } = await import('node:child_process')
  const child = spawn(
    CHROME,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1480,1000',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  )
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
      if (res.ok) return child
    } catch {
      /* 还没起来 */
    }
    await sleep(500)
  }
  throw new Error('Chrome 调试端口未就绪')
}

async function newPage() {  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })
  const target = await res.json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  const cdp = new Cdp(ws)
  await cdp.send('Runtime.enable')
  await cdp.send('Page.enable')
  await cdp.send('Network.enable')
  return { cdp, ws, targetId: target.id }
}

/* ------------------------------- 账号登录 ------------------------------- */
async function loginToken() {
  const { execFileSync } = await import('node:child_process')
  const out = execFileSync(process.execPath, ['scripts/workbench-login-token.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, NO996_API_BASE: APP },
  })
  const line = out.split(/\r?\n/).find((l) => /"ok"\s*:\s*true/.test(l))
  if (!line) throw new Error('登录失败: ' + out.slice(-300))
  return JSON.parse(line).access_token
}

/* --------------------------- 写一条真实人设 --------------------------- */
/**
 * 直接往本机 IndexedDB 写一条启用档，跟「人设定位」页保存出来的结构一致。
 * 定位卡片字段是真填的，用于验证它会作为背景上下文进入模型调用。
 */
const PERSONA_CONTENT = `# 个人业务人设

## 基础定位
- 所属行业：餐饮代运营
- 职业身份：团购短视频操盘手
- 核心产品/服务：帮中小餐饮门店做抖音团购短视频与投流

## 目标用户画像
- 目标客户：开了 1-3 家店的餐饮小老板
- 客户目前的状态和困扰：知道要做短视频但不知道拍什么，投了钱没核销
`

async function seedPersona(cdp) {
  const record = {
    id: 'persona_real_check_1',
    kind: 'user',
    name: '餐饮代运营操盘手',
    summary: '帮中小餐饮门店做抖音团购短视频与投流',
    content: PERSONA_CONTENT,
    formData: {
      industry: '餐饮代运营',
      role: '团购短视频操盘手',
      primaryBusiness: '帮中小餐饮门店做抖音团购短视频与投流',
      targetClients: '开了 1-3 家店的餐饮小老板',
      clientPainPoints: '知道要做短视频但不知道拍什么，投了钱没核销',
      desiredImage: '说人话、给具体动作、不吹数据',
      additionalInfo: '',
    },
    isActive: true,
    updatedAt: new Date().toISOString(),
  }
  return cdp.evaluate(`(() => {
    const rec = ${JSON.stringify(record)}
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('no996-workbench-persona', 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('personas')) {
          const store = db.createObjectStore('personas', { keyPath: 'id' })
          store.createIndex('by_kind', 'kind', { unique: false })
          store.createIndex('by_kind_active', ['kind', 'isActive'], { unique: false })
        }
      }
      req.onerror = () => reject(new Error('open failed'))
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('personas', 'readwrite')
        tx.objectStore('personas').put(rec)
        tx.oncomplete = () => resolve('seeded')
        tx.onerror = () => reject(tx.error)
      }
    })
  })()`)
}

async function setAuth(cdp, token) {
  return cdp.evaluate(`(() => {
    localStorage.setItem('no996_wb_access', ${JSON.stringify(token)})
    localStorage.setItem('no996_wb_refresh', ${JSON.stringify(token)})
    localStorage.setItem('no996_wb_remember', '1')
    return 'ok'
  })()`)
}

/* ------------------------------ 网络记录 ------------------------------ */
function attachNet(cdp, out) {
  cdp.ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.method === 'Network.requestWillBeSent') {
      const url = msg.params?.request?.url ?? ''
      if (url.includes('/ai/chat/completions')) {
        let body = msg.params.request.postData
        try {
          body = JSON.parse(body)
        } catch {
          /* 保持字符串 */
        }
        out.push({ kind: 'chat', url, body, t: Date.now(), id: msg.params.requestId })
      } else if (url.includes('/tools/web_search')) {
        out.push({ kind: 'search', url, t: Date.now(), id: msg.params.requestId })
      }
    } else if (msg.method === 'Network.responseReceived') {
      const rec = out.find((r) => r.id === msg.params.requestId)
      if (rec) rec.status = msg.params.response.status
    }
  })
}

export { Cdp, launch, newPage, loginToken, seedPersona, setAuth, attachNet, sleep, PERSONA_CONTENT, HERE, APP, CDP_PORT }
