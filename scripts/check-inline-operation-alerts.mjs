/**
 * 防止「操作/API 失败」回退为社交工作室 prep 内联红字。
 * 表单字段校验、任务抽屉等路径见 docs/reusable-assets.md「操作反馈」白名单。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SCAN_ROOTS = [
  'src/features/social-studio',
  'src/components/agent/WorkflowRunCard.tsx',
  'src/components/agent/InputWizard.tsx',
  'src/features/titles/TitlesPage.tsx',
  'src/features/script-lab/components/ScriptForm.tsx',
  'src/features/extension/capture/ExtensionCapturePanel.tsx',
  'src/features/social-publish/PublishToPlatformBar.tsx',
]

const FORBIDDEN = [
  { id: 'ssc-generate-zone__error', re: /ssc-generate-zone__error/ },
  { id: 'prep-actions-alert', re: /ssc-actions[\s\S]{0,400}role=["']alert["']/ },
  {
    id: 'prep-destructive-alert',
    re: /text-destructive[\s\S]{0,120}role=["']alert["']|role=["']alert["'][\s\S]{0,120}text-destructive/,
  },
  { id: 'wf-card__error', re: /wf-card__error/ },
  { id: 'wf-wizard__error', re: /wf-wizard__error/ },
  { id: 'titles-error-alert', re: /titles-error-alert/ },
]

function collectFiles(entry) {
  const abs = join(ROOT, entry)
  const st = statSync(abs)
  if (st.isFile()) return [abs]
  const out = []
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === 'dist') continue
    out.push(...collectFiles(join(entry, name)))
  }
  return out
}

const files = SCAN_ROOTS.flatMap((r) => collectFiles(r)).filter((f) => /\.(tsx|ts|css)$/.test(f))

const violations = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file).replaceAll('\\', '/')
  for (const rule of FORBIDDEN) {
    if (rule.re.test(text)) {
      violations.push(`${rel}: matched ${rule.id}`)
    }
  }
}

if (violations.length) {
  console.error('check-inline-operation-alerts failed:\n' + violations.join('\n'))
  process.exit(1)
}

console.log(`check-inline-operation-alerts ok (${files.length} files)`)
