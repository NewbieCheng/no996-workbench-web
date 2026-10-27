/**
 * 用真实 Chrome 跑一遍镜头渲染验证页（无需 puppeteer）。
 *
 * 做法：headless Chrome + 远程调试端口 + 原生 WebSocket 直连 CDP。
 * 走的是真实浏览器渲染管线，能发现「打包成功但跑不起来」「出帧但整幅空白」的问题。
 *
 * 用法：
 *   node scripts/verify-shot-render.mjs                 # 默认抽 10 个代表镜头
 *   node scripts/verify-shot-render.mjs --all           # 全部 151 个
 *   node scripts/verify-shot-render.mjs --limit 20 --port 8903
 *
 * 前置：另开一个 vite dev server（端口要与 --port 一致）。
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
const argOf = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const ALL = args.includes('--all')
const LIMIT = ALL ? Number.MAX_SAFE_INTEGER : Number(argOf('--limit', '10'))
const PORT = Number(argOf('--port', '8903'))
const SHOT_DIR = argOf('--shots-dir', '')
const IDS = (argOf('--ids', '') || '').split(',').map((v) => v.trim()).filter(Boolean)
const ASPECT = (argOf('--aspect', '16:9') || '16:9').trim() === '9:16' ? '9:16' : '16:9'
const DEBUG_PORT = PORT + 1

/** 跨 10 个分类各取代表，覆盖 SVG / 纹理 / CSS 3D / 运动模糊 / 闸门 等不同实现 */
const SAMPLES = [
  'outro/grain-dissolve',
  'opening/spotlight-hero-card',
  'typography/lead-word-zoom-assemble',
  'camera/crash-zoom-punch~CrashZoomReal',
  'ui-entrance/card-stack',
  'data/chart-live-moves~AxisRescaleShockV2',
  'effects/spotlight-sweep-moves~SlideSpotlightPan',
  'transition/shot-transitions~PortalWipeV2',
  'rhythm/beat-cut-moves',
  'interaction/glass-pill-dictation-typing',
]

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
if (!chromePath) {
  console.error('未找到 Chrome / Edge，跳过浏览器验证')
  process.exit(0)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 极简 CDP 客户端：一条 WebSocket，请求/响应按 id 配对。 */
class CDP {
  constructor(url) {
    this.url = url
    this.nextId = 1
    this.pending = new Map()
    this.ws = null
    this.exceptions = []
  }

  async connect() {
    const WebSocketImpl = globalThis.WebSocket
    if (!WebSocketImpl) throw new Error('当前 Node 无 WebSocket 全局对象（需 Node 22+）')
    this.ws = new WebSocketImpl(this.url)
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', () => reject(new Error('CDP 连接失败')), { once: true })
    })
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(
          message.params?.exceptionDetails?.exception?.description ??
            message.params?.exceptionDetails?.text ??
            'unknown',
        )
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(JSON.stringify(message.error)))
        else resolve(message.result)
      }
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP 超时: ${method}`))
        }
      }, 300_000)
    })
  }

  async evalJs(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? '求值异常')
    }
    return result.result?.value
  }

  close() {
    this.ws?.close()
  }
}

async function fetchJson(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return await response.json()
    } catch {
      // 浏览器还没起来
    }
    await sleep(300)
  }
  throw new Error(`无法连接 ${url}`)
}

/** 探测 dev server 是否已经在跑；返回 true 表示可直接用。 */
async function isDevServerUp() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/verify-shot.html`, {
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * 没有现成 dev server 时自己拉一个，并在结束时关掉。
 * 这样 `npm run verify:shots` 是一条命令能跑完的，不必先手动开另一个终端。
 */
let ownedServer = null
if (!(await isDevServerUp())) {
  console.log(`未检测到 :${PORT} 上的 dev server，自动启动一个…`)
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  ownedServer = spawn(npxCmd, ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: path.resolve(fileURLToPath(new URL('..', import.meta.url))),
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })

  // 最多等 60 秒
  let up = false
  for (let i = 0; i < 120; i++) {
    await sleep(500)
    if (await isDevServerUp()) {
      up = true
      break
    }
  }
  if (!up) {
    console.error(`❌ 自动启动的 dev server 在 :${PORT} 上没起来`)
    ownedServer.kill()
    process.exit(1)
  }
  console.log('dev server 就绪')
}

const userDataDir = await mkdtemp(path.join(tmpdir(), 'shot-verify-'))

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1400,1000',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

let shouldFail = false
/** 供 finally 优雅关闭浏览器 */
let cdpRef = null
try {
  const version = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
  console.log(`浏览器: ${version.Browser}`)

  const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
  const page = targets.find((target) => target.type === 'page')
  const cdp = new CDP(page.webSocketDebuggerUrl)
  cdpRef = cdp
  await cdp.connect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  const url = `http://127.0.0.1:${PORT}/verify-shot.html`
  console.log(`打开 ${url}`)
  await cdp.send('Page.navigate', { url })

  let ready = false
  for (let i = 0; i < 60; i++) {
    await sleep(500)
    // 以 __shotVerifyRun 为准：__shotVerifyReady 可能在同一模块里被后置覆盖
    ready = await cdp.evalJs('typeof window.__shotVerifyRun === "function"').catch(() => false)
    if (ready) break
  }

  if (!ready) {
    console.error('❌ 验证入口未就绪 —— dev server 未运行或入口编译失败')
    if (cdp.exceptions.length) console.error(cdp.exceptions.slice(0, 5).join('\n'))
    shouldFail = true
  } else {
    const allIds = await cdp.evalJs('window.__shotVerifyAllIds ?? []')
    const ids = IDS.length ? IDS : ALL ? null : SAMPLES.slice(0, LIMIT)
    const targetIds = ids ?? allIds
    console.log(`验证 ${targetIds.length} 个镜头`)

    await cdp.evalJs(`
      (() => {
        window.__shotVerifyResults = []
        window.__shotVerifyDone = false
        window.__shotVerifyWantPng = ${SHOT_DIR ? 'true' : 'false'}
        void window.__shotVerifyRun(${JSON.stringify(targetIds)}, ${JSON.stringify(ASPECT)})
        return true
      })()
    `)

    let results = []
    const startedAt = Date.now()
    while (Date.now() - startedAt < 280_000) {
      await sleep(2500)
      // 先只读长度，避免每次回传整个结果数组（151 条含 base64 缩略图时会很大）
      const count = await cdp
        .evalJs('(window.__shotVerifyResults ?? []).length')
        .catch(() => 0)
      const done = await cdp.evalJs('Boolean(window.__shotVerifyDone)').catch(() => false)
      if (count >= targetIds.length || done) {
        // 完成后再一次性取回完整结果
        results = (await cdp.evalJs('window.__shotVerifyResults ?? []').catch(() => [])) ?? []
        break
      }
    }

    // 找出没出结果的镜头：轮询可能在最后一条写入前就结束了
    const reported = new Set(results.map((item) => item.shotId))
    const missing = targetIds.filter((id) => !reported.has(id))
    if (missing.length) {
      console.log('\n⚠ 未产出结果（可能被轮询截断或卡住）：')
      for (const id of missing) console.log(`   ${id}`)
    }

    const ok = results.filter((item) => item.status === 'ok')
    const failed = results.filter((item) => item.status === 'fail')
    const blank = ok.filter((item) => (item.inkRatio ?? 0) < 0.005)

    console.log(`\n结果：${ok.length} 通过 / ${failed.length} 失败 / 共 ${results.length}`)
    if (ok.length) {
      const times = ok.map((item) => item.ms).sort((a, b) => a - b)
      console.log(
        `单帧耗时：中位 ${times[Math.floor(times.length / 2)]}ms，最快 ${times[0]}ms，最慢 ${times[times.length - 1]}ms`,
      )
    }
    if (blank.length) {
      console.log(`\n⚠ 出帧但几乎全空白（inkRatio < 0.005，可能是静默失败）：`)
      for (const item of blank) console.log(`   ${item.shotId}  ink=${item.inkRatio}`)
    }

    // 横向内容分布：竖屏 cover 只留中间 31.6%，spread 大的镜头应该改 fit
    const spreadPath = argOf('--save-spread', '')
    if (spreadPath) {
      const { writeFileSync } = await import('node:fs')
      const table = Object.fromEntries(
        ok.map((item) => [item.shotId, { ink: item.inkRatio ?? 0, spread: item.inkSpread ?? 0 }]),
      )
      writeFileSync(spreadPath, JSON.stringify(table, null, 2), 'utf8')
      console.log(`已写入内容分布：${spreadPath}（${Object.keys(table).length} 个镜头）`)
    }

    // 存 inkRatio 基线：后续批次拿它对比"默认帧零变化"
    const inkPath = argOf('--save-ink', '')
    if (inkPath) {
      const { writeFileSync } = await import('node:fs')
      const baseline = Object.fromEntries(ok.map((item) => [item.shotId, item.inkRatio ?? 0]))
      writeFileSync(inkPath, JSON.stringify(baseline, null, 2), 'utf8')
      console.log(`已写入 inkRatio 基线：${inkPath}（${Object.keys(baseline).length} 个镜头）`)
    }
    // 存 PNG 帧（竖屏校准用：人工过一遍有没有裁断字/裁掉主体）
    const shotDir = argOf('--shots-dir', '')
    if (shotDir) {
      const { mkdirSync, writeFileSync } = await import('node:fs')
      const path = await import('node:path')
      mkdirSync(shotDir, { recursive: true })
      let saved = 0
      for (const item of [...ok, ...failed]) {
        if (!item.png) continue
        const name = item.shotId.replace(/[/~]/g, '__') + '.png'
        writeFileSync(path.join(shotDir, name), Buffer.from(item.png, 'base64'))
        saved++
      }
      console.log(`已保存 ${saved} 张帧到：${shotDir}`)
    }

    if (failed.length) {
      console.log(`\n❌ 渲染失败：`)
      for (const item of failed) console.log(`   ${item.shotId}  ${item.ms}ms  ${item.message ?? ''}`)
    }
    if (cdp.exceptions.length) {
      console.log(`\n页面共 ${cdp.exceptions.length} 条未捕获异常，前 3 条：`)
      console.log(cdp.exceptions.slice(0, 3).join('\n'))
    }

    // 改色生效抽查：同一帧分别用默认 / 预设主题 / 自定义主色渲染，比较像素差异
    const colorIds = (argOf('--colors', '') || '').split(',').map((item) => item.trim()).filter(Boolean)
    if (colorIds.length) {
      const colorResults =
        (await cdp
          .evalJs(`window.__shotVerifyColorCheck ? window.__shotVerifyColorCheck(${JSON.stringify(colorIds)}) : null`)
          .catch(() => null)) ?? []
      console.log('\n改色生效抽查（同帧像素差异比例）：')
      if (!colorResults.length) {
        console.log('  ❌ 验证入口没有暴露 __shotVerifyColorCheck')
        shouldFail = true
      }
      for (const item of colorResults) {
        const verdict = item.ok ? '✅ 通过' : '❌ 失败'
        console.log(
          `  ${verdict}  ${item.shotId}  theme=${item.themeRatio ?? '-'}  primary=${item.primaryRatio ?? '-'}  bg=${item.bgRatio ?? '-'}  ink=${item.inkRatio ?? '-'}  ${item.message ?? ''}`,
        )
        if (!item.ok) shouldFail = true
      }
    }

    // 真实入队验证：ip_video_audio 任务是否真的写进本机仓储
    const enqueue = await cdp
      .evalJs('window.__shotVerifyVoiceEnqueue ? window.__shotVerifyVoiceEnqueue() : null')
      .catch(() => null)
    if (enqueue) {
      const verdict = enqueue.ok ? '✅ 通过' : '❌ 失败'
      console.log(`配音入队：${verdict}  ${enqueue.message}`)
      if (!enqueue.ok) shouldFail = true
    }

    // 新增界面验证：IP 组装面板嵌入镜头库、向导三步可达
    const newUi = await cdp
      .evalJs('window.__shotVerifyNewUi ? window.__shotVerifyNewUi() : null')
      .catch(() => null)
    if (newUi) {
      const verdict = newUi.ok ? '✅ 通过' : '❌ 失败'
      console.log(`新增界面：${verdict}  ${newUi.message}`)
      if (!newUi.ok) shouldFail = true
    }

    // 配音链路验证：用假后端走完入队/轮询/取回/失败/取消
    const voice = await cdp
      .evalJs('window.__shotVerifyVoice ? window.__shotVerifyVoice() : null')
      .catch(() => null)
    if (voice) {
      const verdict = voice.ok ? '✅ 通过' : '❌ 失败'
      console.log(`配音链路：${verdict}  ${voice.message}`)
      if (!voice.ok) shouldFail = true
    }

    // 拖动验证：片段能否整体拖动，且一次撤销回到原位
    const drag = await cdp
      .evalJs('window.__shotVerifyDrag ? window.__shotVerifyDrag() : null')
      .catch(() => null)
    if (drag) {
      const verdict = drag.ok ? '✅ 通过' : '❌ 失败'
      console.log(`片段拖动：${verdict}  ${drag.before}µs → ${drag.after}µs  ${drag.message}`)
      if (!drag.ok) shouldFail = true
    }

    // 节拍检测验证：用已知 BPM 的合成鼓点检查算法是否还原正确
    const beats = await cdp
      .evalJs('window.__shotVerifyBeats ? window.__shotVerifyBeats() : null')
      .catch(() => null)
    if (beats) {
      const verdict = beats.ok ? '✅ 通过' : '❌ 失败'
      const detail = (beats.cases ?? [])
        .map((item) => `${item.bpm}BPM→${item.detected ?? '无'}(${item.beats}拍)`)
        .join('  ')
      console.log(`节拍检测：${verdict}  ${detail}  ${beats.message}`)
      if (!beats.ok) shouldFail = true
    }

    // IP 侧复合验证：证明模板确实把动效镜头画进了背景
    const ipComposite = await cdp
      .evalJs('window.__shotVerifyIpComposite ? window.__shotVerifyIpComposite() : null')
      .catch(() => null)
    if (ipComposite) {
      const verdict = ipComposite.ok ? '✅ 通过' : '❌ 失败'
      console.log(
        `\nIP 模板复合动效背景：${verdict}  ink=${ipComposite.inkRatio}  ${ipComposite.message}`,
      )
      if (!ipComposite.ok) shouldFail = true
    }

    // 面板数据验证：镜头库与音效库是否读到真实注册表
    const panels = await cdp
      .evalJs('window.__shotVerifyPanels ? window.__shotVerifyPanels() : null')
      .catch(() => null)
    if (panels) {
      const verdict = panels.ok ? '✅ 通过' : '❌ 失败'
      console.log(
        `面板数据：${verdict}  镜头卡 ${panels.shotCards} / 镜头分组 ${panels.shotGroups} / 音效分组 ${panels.sfxGroups}  ${panels.message}`,
      )
      if (!panels.ok) shouldFail = true
    }

    // 整页装配验证：三栏主体 + 舞台 + 时间轴一起挂载
    const studio = await cdp
      .evalJs('window.__shotVerifyStudio ? window.__shotVerifyStudio() : null')
      .catch(() => null)
    if (studio) {
      const verdict = studio.ok ? '✅ 通过' : '❌ 失败'
      const flags = Object.entries(studio.panels ?? {})
        .map(([key, value]) => `${key}=${value ? '✓' : '✗'}`)
        .join(' ')
      console.log(`整页装配：${verdict}  ${flags}  镜头片段 ${studio.shotClips}  ${studio.message}`)
      if (!studio.ok) shouldFail = true
    }

    // 导出带音频验证：真的编码一次 MP4 并读回音频轨
    const exportAudio = await cdp
      .evalJs('window.__shotVerifyExportAudio ? window.__shotVerifyExportAudio() : null')
      .catch(() => null)
    if (exportAudio) {
      const verdict = exportAudio.ok ? '✅ 通过' : '❌ 失败'
      console.log(
        `导出带音频：${verdict}  hasAudio=${exportAudio.hasAudio}  ${(exportAudio.videoBytes / 1024).toFixed(0)}KB  ${exportAudio.message}`,
      )
      if (!exportAudio.ok) shouldFail = true
    }

    // 拖放验证：镜头库拖到时间轴是否真的落到轨道
    const drop = await cdp
      .evalJs('window.__shotVerifyDrop ? window.__shotVerifyDrop() : null')
      .catch(() => null)
    if (drop) {
      const verdict = drop.ok ? '✅ 通过' : '❌ 失败'
      console.log(`拖放入轨：${verdict}  ${drop.before} → ${drop.after}  ${drop.message}`)
      if (!drop.ok) shouldFail = true
    }

    if (!ok.length) {
      console.error('\n❌ 没有任何镜头渲染成功')
      shouldFail = true
    } else if (failed.length || blank.length) {
      console.log('\n⚠ 有失败或空白镜头，见上。')
      shouldFail = true
    } else {
      console.log('\n✅ 管线在真实浏览器里成功出帧')
    }
    cdp.close()
  }
} catch (error) {
  console.error('验证过程出错:', error.message)
  shouldFail = true
} finally {
  // chrome.kill() 只结束主进程；渲染/GPU/utility 子进程会残留，
  // 跑几次验证就能攒出几十个僵尸进程。用 CDP 的 Browser.close 优雅退出，再按
  // user-data-dir 兜底清一次（本次运行独占该临时目录，不会误杀别的浏览器）。
  try {
    await cdpRef?.send('Browser.close')
  } catch {
    // 已被关闭或连接已断，忽略
  }
  chrome.kill()
  await sleep(1200)
  if (process.platform === 'win32') {
    try {
      const { execFileSync } = await import('node:child_process')
      // 只杀命令行里带本次临时目录的进程
      const script =
        "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | " +
        `Where-Object { $_.CommandLine -like '*${path.basename(userDataDir)}*' } | ` +
        'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }'
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        stdio: 'ignore',
      })
    } catch {
      // 清理失败不影响验证结论
    }
  }
  await rm(userDataDir, { recursive: true, force: true }).catch(() => undefined)
  if (ownedServer) {
    // 自己拉起的 dev server 要负责收掉，否则会一直占着端口
    try {
      if (process.platform === 'win32') {
        const { execFileSync } = await import('node:child_process')
        const killScript =
          `Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | ` +
          'ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }'
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', killScript], {
          stdio: 'ignore',
        })
      } else {
        ownedServer.kill()
      }
    } catch {
      try {
        ownedServer.kill()
      } catch {
        // 已退出
      }
    }
  }
}

process.exit(shouldFail ? 1 : 0)
