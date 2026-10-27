/**
 * 收尾清理：删掉本轮的探针脚本与临时产物，保留可读的证据。
 *
 * 保留：真实复测报告、截图、原始任务快照。
 * 删除：一次性探针、调试脚本、临时 profile。
 */
import { existsSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const V = join(ROOT, '.verify')

// 一次性脚本：验证完就没有复用价值，留着只会让仓库变脏
const SCRIPTS = [
  join(V, 'probe-effort.mjs'),
  join(V, 'real3', 'probe.mjs'),
  join(V, 'real3', 'debug.mjs'),
  join(V, 'real3', 'expr-check.mjs'),
  join(V, 'real3', 'debug-before-login.png'),
  join(V, 'real3', 'debug-after-login.png'),
]

for (const f of SCRIPTS) {
  if (existsSync(f)) {
    rmSync(f, { recursive: true, force: true })
    console.log(`  删除 ${f.replace(ROOT + '\\', '')}`)
  }
}

// 临时日志（dev server 的日志不删，正在用的进程还在写）
for (const f of ['dev8913.out.log', 'dev8913.err.log']) {
  const p = join(V, f)
  if (existsSync(p)) {
    try {
      rmSync(p, { force: true })
      console.log(`  删除 .verify/${f}`)
    } catch {
      console.log(`  跳过 .verify/${f}（占用中）`)
    }
  }
}

// 临时 Chrome profile（项目外，但也是我留下的）
const PROFILE = join(process.env.TEMP || '', 'no996-real3-profile')
if (PROFILE && existsSync(PROFILE)) {
  try {
    rmSync(PROFILE, { recursive: true, force: true })
    console.log(`  删除临时 profile ${PROFILE}`)
  } catch {
    console.log(`  跳过临时 profile（Chrome 可能还在跑）`)
  }
}

console.log('\n保留的复测证据：')
const keep = join(V, 'real3')
for (const f of readdirSync(keep)) {
  const st = statSync(join(keep, f))
  if (st.isFile()) console.log(`  .verify/real3/${f}  (${(st.size / 1024).toFixed(0)} KB)`)
}
