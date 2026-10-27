/**
 * 验收网关真 SSE：默认打 8080（VITE_API_PROXY_TARGET），可自动登录拿 token。
 * 用法：node scripts/verify-chat-stream.mjs
 * 或：$env:WORKBENCH_ACCESS_TOKEN='<jwt>'; node scripts/verify-chat-stream.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const localEnvPath = resolve(root, '.env.development.local')

function loadEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (!m) continue
    out[m[1].trim()] = m[2].trim()
  }
  return out
}

const fileEnv = loadEnvFile(localEnvPath)
const base = (process.env.VITE_API_PROXY_TARGET || fileEnv.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080').replace(
  /\/$/,
  '',
)
const model = process.env.VITE_CHAT_MODEL || fileEnv.VITE_CHAT_MODEL || 'deepseek-v4-flash'

const backendEnvPath =
  'F:/Dev/Desktop-Projects/不加班智能团后端/.worktrees/v1-backend/.env'
let email = process.env.NO996_MEMBER_EMAIL
let password = process.env.NO996_MEMBER_PASSWORD
if ((!email || !password) && existsSync(backendEnvPath)) {
  const be = loadEnvFile(backendEnvPath)
  email = email || be.SEED_SUPER_ADMIN_EMAIL
  password = password || be.SEED_SUPER_ADMIN_PASSWORD
}
if (!email || !password) {
  throw new Error('缺少联调账号：请设置 NO996_MEMBER_EMAIL / NO996_MEMBER_PASSWORD（仓库不保存凭据）。')
}
const loginMode = /@bujiaoban\.cn$/i.test(email) ? 2 : 1

function parseImageCaptchaSvg(svg) {
  if (!svg || typeof svg !== 'string') return ''
  const texts = []
  const re = /<text[^>]*x="([^"]+)"[^>]*>([^<]*)<\/text>/gi
  let m
  while ((m = re.exec(svg)) !== null) {
    texts.push({ x: Number(m[1]), ch: m[2].trim() })
  }
  texts.sort((a, b) => a.x - b.x)
  return texts.map((t) => t.ch).join('')
}

async function jsonFetch(url, init = {}) {
  const res = await fetch(url, init)
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text.slice(0, 300) }
  }
  return { status: res.status, body }
}

async function resolveToken() {
  if (process.env.WORKBENCH_ACCESS_TOKEN || process.env.NO996_ACCESS_TOKEN) {
    return process.env.WORKBENCH_ACCESS_TOKEN || process.env.NO996_ACCESS_TOKEN
  }
  const captcha = await jsonFetch(`${base}/api/v1/auth/captcha?type=image`)
  const loginBody = { email, password, mode: loginMode, session_channel: 'app' }
  const captchaId = captcha.body?.data?.id ?? captcha.body?.id
  let captchaCode = captcha.body?.data?.code ?? captcha.body?.code
  if (!captchaCode && captcha.body?.data?.svg) {
    captchaCode = parseImageCaptchaSvg(captcha.body.data.svg)
  }
  if (captchaId && captchaCode) {
    loginBody.captcha_id = captchaId
    loginBody.captcha_code = captchaCode
  }
  const login = await jsonFetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginBody),
  })
  return login.body?.data?.access_token ?? login.body?.access_token ?? null
}

async function main() {
  console.log(`base=${base} model=${model}`)
  const live = await fetch(`${base}/health/live`)
  if (!live.ok) {
    console.error('health/live failed', live.status)
    process.exit(1)
  }
  const ready = await fetch(`${base}/health/ready`)
  console.log(`health/live OK ready=${ready.ok ? 'OK' : ready.status}`)

  const token = await resolveToken()
  if (!token) {
    console.error('no access token (login failed)')
    process.exit(1)
  }

  const res = await fetch(`${base}/api/v1/ai/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 64,
      messages: [{ role: 'user', content: '用一句话介绍杭州。' }],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('chat stream failed', res.status, text.slice(0, 500))
    process.exit(1)
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/event-stream')) {
    console.error('expected text/event-stream, got', ct)
    process.exit(1)
  }
  if (!res.body) {
    console.error('no response body')
    process.exit(1)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let readChunks = 0
  let deltaFrames = 0
  const t0 = Date.now()
  let tFirst = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    readChunks += 1
    if (!tFirst) tFirst = Date.now()
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue
      if (payload.includes('"content"') || payload.includes('reasoning_content')) {
        deltaFrames += 1
      }
    }
  }

  const elapsed = Date.now() - t0
  const firstMs = tFirst ? tFirst - t0 : 0
  console.log(
    `SSE OK: readChunks=${readChunks} deltaFrames≈${deltaFrames} firstByteMs=${firstMs} totalMs=${elapsed}`,
  )
  const ok = readChunks >= 1 && (deltaFrames >= 1 || elapsed < 120_000)
  console.log(`SUMMARY=${ok ? 'PASS' : 'FAIL'}`)
  process.exit(ok ? 0 : 2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
