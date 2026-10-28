/**
 * 核对：导航里每个 /workbench/<segment> 都在 workbench-surface.ts 登记了修饰类。
 * 漏登时创作页顶栏会因 .wb-page-area__scroll 默认 padding 下沉（见 AGENTS.md）。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const navSrc = readFileSync(join(ROOT, 'src/app/navigation.ts'), 'utf8')
const surfaceSrc = readFileSync(join(ROOT, 'src/app/workbench-surface.ts'), 'utf8')

const segments = new Set()
for (const m of navSrc.matchAll(/path:\s*'\/workbench\/([^']+)'/g)) {
  segments.add(m[1])
}

const registered = new Set()
const mapBlock = surfaceSrc.match(/WORKBENCH_SURFACE_BY_SEGMENT[^=]*=\s*\{([\s\S]*?)\n\}/)
if (!mapBlock) {
  console.error('FAIL: cannot find WORKBENCH_SURFACE_BY_SEGMENT in workbench-surface.ts')
  process.exit(1)
}
for (const m of mapBlock[1].matchAll(/(?:'([^']+)'|([A-Za-z0-9_-]+))\s*:/g)) {
  registered.add(m[1] || m[2])
}

const missing = [...segments].filter((s) => !registered.has(s)).sort()

if (missing.length) {
  console.error('FAIL: navigation segments missing from workbench-surface.ts:')
  for (const s of missing) console.error(`  - ${s}`)
  console.error('Add: workbench-page--fluid workbench-tool-page (or fluid-only for account/membership).')
  process.exit(1)
}

// 创作工具页应带 workbench-tool-page（account / membership / ui-kit 例外）
const fluidOnlyOk = new Set(['account', 'membership', 'ui-kit'])
const weak = []
for (const s of segments) {
  if (fluidOnlyOk.has(s)) continue
  const re = new RegExp(
    `(?:'${s}'|${s})\\s*:\\s*\`([^\`]*)\`|(?:'${s}'|${s})\\s*:\\s*'([^']*)'`,
  )
  const hit = mapBlock[1].match(re)
  const value = hit?.[1] ?? hit?.[2] ?? ''
  if (!value.includes('workbench-tool-page') && !value.includes('${TOOL_PAGE}')) {
    weak.push({ segment: s, value })
  }
}

if (weak.length) {
  console.error('FAIL: these workbench pages should include workbench-tool-page:')
  for (const w of weak) console.error(`  - ${w.segment}: "${w.value}"`)
  process.exit(1)
}

console.log(`OK: ${segments.size} navigation workbench segments covered by workbench-surface.ts`)
