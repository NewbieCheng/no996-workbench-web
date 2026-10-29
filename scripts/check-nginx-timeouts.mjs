/**
 * 机械核对工作台 agent nginx 与后端 worker nginx 超时配置（计划：生图/api 180s，视频 1800s，speech 600s）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const workbenchRoot = path.resolve(here, '..')
const backendRoot = path.resolve(workbenchRoot, '..', '不加班智能团后端')

const agentConf = path.join(workbenchRoot, 'deploy', 'nginx-agent.conf')
const workerConf = path.join(backendRoot, 'deploy', 'bare-metal', 'nginx', 'worker.no996ai.cn.conf')

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`)
  return fs.readFileSync(file, 'utf8')
}

function assertMatch(label, text, re, hint) {
  if (!re.test(text)) {
    console.error(`FAIL ${label}: ${hint}`)
    process.exitCode = 1
    return false
  }
  console.log(`OK   ${label}`)
  return true
}

const agent = read(agentConf)
const worker = read(workerConf)

assertMatch(
  'agent speech 600s',
  agent,
  /location = \/api\/v1\/ai\/audio\/speech[\s\S]*?proxy_read_timeout 600s/,
  'speech location must keep 600s',
)
assertMatch(
  'agent chat 600s',
  agent,
  /location = \/api\/v1\/ai\/chat\/completions[\s\S]*?proxy_read_timeout 600s/,
  'chat location must keep 600s',
)
assertMatch(
  'agent /api/ 180s',
  agent,
  /location \/api\/ \{[\s\S]*?proxy_read_timeout 180s/,
  '/api/ catch-all must be 180s',
)
assertMatch(
  'agent videos 1800s',
  agent,
  /location \/api\/v1\/ai\/videos\/ \{[\s\S]*?proxy_read_timeout 1800s/,
  'videos path must be 1800s',
)

assertMatch(
  'worker default 180s',
  worker,
  /proxy_read_timeout 180s/,
  'worker server default must be 180s',
)
assertMatch(
  'worker speech 600s',
  worker,
  /location = \/api\/v1\/ai\/audio\/speech[\s\S]*?proxy_read_timeout 600s/,
  'worker speech must keep 600s',
)
assertMatch(
  'worker videos 1800s',
  worker,
  /location \/api\/v1\/ai\/videos\/ \{[\s\S]*?proxy_read_timeout 1800s/,
  'worker videos path must be 1800s',
)

if (process.exitCode) {
  console.error('nginx timeout check failed')
  process.exit(1)
}
console.log('nginx timeout check passed')
