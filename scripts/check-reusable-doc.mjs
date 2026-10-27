// 机械核对 docs/reusable-assets.md 里提到的路径与导出名是否真实存在。
// 目的：杜绝「文档说有、代码里没有」。
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const DOC = process.env.DOC || 'docs/reusable-assets.md'
const raw = readFileSync(DOC, 'utf8')

/*
 * 文档里会举例说明「哪些是错的」（负面测试用的假路径/假名字）。
 * 这类行按约定写成 HTML 注释 `<!-- doc-check:ignore 原因 -->`，核对时跳过 ——
 * 否则核对器会把自己的反例当成真实声明，报出假阳性。
 * 只有真正写成 HTML 注释才会生效，正文里提这个名字不受影响。
 */
const IGNORE_MARK = 'doc-check:ignore'
const IGNORE_RE = /<!--\s*doc-check:ignore[\s\S]*?-->/
const skippedLines = []
const md = raw
  .split(/\r?\n/)
  .filter((line) => {
    if (IGNORE_RE.test(line)) { skippedLines.push(line.trim().slice(0, 60)); return false }
    return true
  })
  .join('\n')

/* ---------- 0. 先收集全仓源码文件（路径核对要用） ---------- */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

// packages/video-editor/src 也要参与：可复用清单里登记了视频工厂的运行时、
// 光栅化管线与音频混音器，不扫这个目录就核不到它们的标识名。
const SCAN_DIRS = ['src', 'packages/ui/src', 'packages/video-editor/src', 'scripts', 'docs']
const ALL_SOURCE_FILES = SCAN_DIRS.filter((d) => existsSync(join(ROOT, d))).flatMap((d) => walk(join(ROOT, d)))
// 仓库根目录下的顶层文件（AGENTS.md / README.md / API_CONTRACTS.md …）也要能被裸文件名解析到，
// 否则文档里引用它们会被误报成「路径不存在」。只取顶层，不递归（避免走进 node_modules）。
for (const name of readdirSync(ROOT)) {
  const full = join(ROOT, name)
  if (statSync(full).isFile()) ALL_SOURCE_FILES.push(full)
}

/* ---------- 1. 收集文档里出现的「路径」 ---------- */
const paths = new Set()
// 反引号里、看起来像文件/目录路径的 token
for (const m of md.matchAll(/`([A-Za-z0-9_@./-]+\.(?:tsx?|mjs|css|md|json))`/g)) paths.add(m[1])
for (const m of md.matchAll(/`(src\/[A-Za-z0-9_@./-]+\/)`/g)) paths.add(m[1])
for (const m of md.matchAll(/`(packages\/[A-Za-z0-9_@./-]+)`/g)) paths.add(m[1])
// 表格里裸写的路径
for (const m of md.matchAll(/\|\s*`?((?:src|packages|docs)\/[A-Za-z0-9_@./-]+)`?\s*\|/g)) paths.add(m[1])

const pathBad = []
const resolved = []
const ambiguous = []
for (const p of [...paths].sort()) {
  const clean = p.replace(/\/$/, '')
  if (clean.includes('/')) {
    // 带路径：必须字面存在
    if (!existsSync(join(ROOT, clean))) pathBad.push(p)
  } else {
    // 裸文件名（文档表格里省略了所在目录）：仓库里得确实有这么一个文件。
    // 若全仓有多个同名文件，报歧义 —— 否则「核对通过」会掩盖「读者不知道该看哪个」。
    const hits = ALL_SOURCE_FILES.filter((f) => f.endsWith('\\' + clean) || f.endsWith('/' + clean))
    if (!hits.length) pathBad.push(p)
    else if (hits.length > 1) ambiguous.push({ name: clean, hits })
    else resolved.push(`${clean} → ${relative(ROOT, hits[0]).replace(/\\/g, '/')}`)
  }
}

/* ---------- 2. 收集文档里声称的「导出名」 ---------- */
// 形如： function fooBar(   /   const FOO   /   type FooBar   /   class FooBar
const claimed = new Set()
for (const m of md.matchAll(/\b(?:function|const|class|interface)\s+([A-Za-z_][A-Za-z0-9_]*)/g)) claimed.add(m[1])
for (const m of md.matchAll(/\btype\s+([A-Z][A-Za-z0-9_]*)/g)) claimed.add(m[1])
for (const m of md.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)\(/g)) claimed.add(m[1])

// 不参与核对的：局部/示例/第三方/React API/伪代码里的标识
const IGNORE = new Set([
  'require', 'fetch', 'console', 'log', 'import', 'if', 'for', 'return', 'function',
  'join', 'resolve', 'readFileSync', 'existsSync', 'map', 'filter', 'find', 'some', 'every',
  'useState', 'useEffect', 'useMemo', 'useRef', 'useCallback', 'forEach', 'slice', 'replace', 'test',
  'push', 'pop', 'get', 'set', 'has', 'add', 'then', 'catch', 'stringify', 'parse',
])

/* ---------- 3. 把源码里「声明出来」的名字汇总 ----------
   覆盖四类，缺一类就会误报：
   a) 顶层导出（function / const / class / type / interface）
   b) 类方法（runModel、runTool…）—— 必须做花括号配对，不能只看行首
   c) 函数类型的类型成员（AgentSink.publish、enqueueVoiceTts、patchMeta…）
   d) `export { a, b as c }` 重导出
*/
const files = ALL_SOURCE_FILES.filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
const declared = new Set()
const RE_EXPORT = /^export\s+(?:async\s+)?(?:function|const|class|interface|type|abstract\s+class|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/gm
const RE_EXPORT_LIST = /^export\s+(?:type\s+)?\{([^}]+)\}/gm
const RE_MEMBER_FN = /^\s*(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\??\s*:\s*/gm
const RE_METHOD = /^\s{2,}(?:public\s+|private\s+|protected\s+|readonly\s+|static\s+|async\s+)*([A-Za-z_][A-Za-z0-9_]*)\s*(?:<[^>{}]*>)?\s*\(/gm

for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(RE_EXPORT)) declared.add(m[1])
  for (const m of src.matchAll(RE_EXPORT_LIST)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name) declared.add(name)
    }
  }
  for (const m of src.matchAll(RE_MEMBER_FN)) declared.add(m[1])
  for (const m of src.matchAll(RE_METHOD)) declared.add(m[1])
}

// 文档里声称的标识，必须能在上面任一来源里找到
const missing = [...claimed].filter((c) => !IGNORE.has(c) && !declared.has(c)).sort()

/* ---------- 4. 报告 ---------- */
console.log('════════ 文档路径核对 ════════')
if (skippedLines.length) {
  console.log(`  （已按 ${IGNORE_MARK} 跳过 ${skippedLines.length} 行反例说明）`)
}
console.log(`  文档中出现的路径 : ${paths.size}`)
if (pathBad.length) {
  console.log(`  ❌ 不存在 (${pathBad.length}):`)
  pathBad.forEach((p) => console.log('     ' + p))
} else {
  console.log('  ✅ 全部存在')
}
if (ambiguous.length) {
  console.log(`  ⚠ 省略目录的裸文件名有歧义 (${ambiguous.length})，请改成全路径:`)
  ambiguous.forEach(({ name, hits }) => {
    console.log(`     ${name}`)
    hits.forEach((h) => console.log('        ' + relative(ROOT, h).replace(/\\/g, '/')))
  })
}
if (resolved.length) {
  console.log(`  （另有 ${resolved.length} 个省略目录的裸文件名，按文件名全仓唯一解析）:`)
  resolved.forEach((r) => console.log('     ' + r))
}

console.log('')
console.log('════════ 标识名核对 ════════')
console.log(`  文档中声称的标识 : ${claimed.size}`)
console.log(`  源码声明的名字   : ${declared.size}（含顶层导出 / 类方法 / 类型成员）`)
if (missing.length) {
  console.log(`  ❌ 文档提到但源码里找不到 (${missing.length}):`)
  missing.forEach((n) => console.log('     ' + n))
} else {
  console.log('  ✅ 全部能在源码中找到')
}

console.log('')
const bad = pathBad.length + missing.length + ambiguous.length
console.log(bad ? '结论：不一致，需要修文档或修代码' : '结论：文档与源码一致')
process.exit(bad ? 1 : 0)
