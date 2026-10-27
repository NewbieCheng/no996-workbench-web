const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, '.verify')
fs.mkdirSync(outDir, { recursive: true })
const output = path.join(outDir, 'ip-video-check.txt')
const started = Date.now()
let text = ''
let failures = 0
function log(value) { text += value + '\n'; fs.writeFileSync(output, text); }
function run(name, args, timeout = 90000) {
  log(`BEGIN ${name}`)
  const child = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true })
  log(child.stdout || ''); log(child.stderr || '')
  const status = child.error ? -1 : child.status
  log(`END ${name} EXIT=${status}${child.error ? ' ERROR=' + child.error.message : ''}`)
  if (status !== 0) failures++
  return status === 0
}
function keys(value, prefix = '') { return Object.entries(value).flatMap(([key, item]) => item && typeof item === 'object' ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`]).sort() }
log('IP_VIDEO_VALIDATION_START')
try {
  const zh = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/zh-CN/ipVideo.json'), 'utf8'))
  const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en-US/ipVideo.json'), 'utf8'))
  const left = keys(zh); const right = keys(en)
  if (JSON.stringify(left) !== JSON.stringify(right)) { failures++; log(`I18N_PARITY_FAILED zh=${left.filter(k => !right.includes(k))} en=${right.filter(k => !left.includes(k))}`) }
  else log(`I18N_PARITY_OK KEYS=${left.length}`)
  if (!process.argv.includes('--compile-only')) run('ip-video-unit-tests', ['--experimental-strip-types', '--test', 'src/features/ip-video/templates.test.mjs', 'src/features/ip-video/lib/video-renderer.test.mjs'], 20000)
  if (run('typescript-public-contracts', ['node_modules/typescript/bin/tsc', '-b', '--pretty', 'false'], 90000)) run('production-build', ['node_modules/vite/bin/vite.js', 'build'], 90000)
  if (process.argv[2] && !process.argv[2].startsWith('--')) {
    log('BEGIN scoped-ui-detector')
    const child = spawnSync(process.argv[2], ['detect', '--json', 'src/features/ip-video/IPVideoPage.tsx', 'src/features/ip-video/components/TemplateGallery.tsx', 'src/features/ip-video/components/SubtitlePreview.tsx', 'src/features/ip-video/ip-video.css'], { cwd: root, encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024, windowsHide: true })
    log(child.stdout || ''); log(child.stderr || ''); log(`END scoped-ui-detector EXIT=${child.status}${child.error ? ' ERROR=' + child.error.message : ''}`)
    if (child.error || child.status !== 0) failures++
  }
} catch (error) { failures++; log('VALIDATION_EXCEPTION ' + error.stack) }
log(`EMITTED_LINES=${text.split('\n').length} FAILURES=${failures} ELAPSED_MS=${Date.now() - started}`)
log('IP_VIDEO_VALIDATION_DONE')
console.log(`IP_VIDEO_CHECK_REPORT=${output}\nFAILURES=${failures}\nIP_VIDEO_VALIDATION_DONE`)
process.exitCode = failures ? 1 : 0
