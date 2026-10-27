import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const root = process.cwd()
const scopes = [
  'src/features/persona',
  'src/features/script-lab',
  'src/features/xiaohongshu',
  'src/features/wechat-article',
  'src/features/social-studio',
]
const output = path.join(root, 'scripts', 'i18n-ui-copy-inventory.json')
const cjk = /[\u3400-\u9fff]/u
const ignored = new Set(['node_modules', 'dist', 'lib', 'coverage', '__tests__', 'tests'])

function* sourceFiles(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) yield* sourceFiles(path.join(dir, entry.name))
    } else if (/\.(?:tsx|ts)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)) {
      yield path.join(dir, entry.name)
    }
  }
}

function hasCjk(value) {
  return typeof value === 'string' && cjk.test(value)
}

const entries = new Map()
for (const scope of scopes) {
  for (const file of sourceFiles(path.join(root, scope))) {
    const source = fs.readFileSync(file, 'utf8')
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
    const add = (node, value, type, attribute) => {
      const normalized = value.replace(/\s+/gu, ' ').trim()
      if (!normalized || !hasCjk(normalized)) return
      const position = ast.getLineAndCharacterOfPosition(node.getStart(ast))
      const relative = path.relative(root, file).replaceAll(path.sep, '/')
      const location = { file: relative, line: position.line + 1, type, attribute }
      const existing = entries.get(normalized) ?? { source: normalized, locations: [] }
      existing.locations.push(location)
      entries.set(normalized, existing)
    }
    const insideJsxExpression = (node) => {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (
          ts.isCallExpression(parent) &&
          ts.isPropertyAccessExpression(parent.expression) &&
          parent.expression.expression.getText(ast) === 'i18n' &&
          parent.expression.name.text === 't'
        ) return false
        if (ts.isJsxExpression(parent)) return true
        if (ts.isJsxElement(parent) || ts.isJsxFragment(parent) || ts.isSourceFile(parent)) return false
      }
      return false
    }
    const visit = (node) => {
      if (ts.isJsxText(node)) add(node, node.text, 'jsx-text')
      if (ts.isJsxAttribute(node)) {
        const init = node.initializer
        if (init && ts.isStringLiteral(init)) add(init, init.text, 'jsx-attribute', node.name.getText(ast))
      }
      if (insideJsxExpression(node) && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
        add(node, node.text, 'jsx-expression-literal')
      }
      ts.forEachChild(node, visit)
    }
    visit(ast)
  }
}

const inventory = [...entries.values()]
  .map((entry) => ({ ...entry, locations: entry.locations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line) }))
  .sort((a, b) => a.source.localeCompare(b.source, 'zh-CN'))

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8')
console.log(`UI_CJK_STRINGS=${inventory.length}`)
console.log(`LOCATIONS=${inventory.reduce((count, entry) => count + entry.locations.length, 0)}`)
console.log(`INVENTORY=${path.relative(root, output).replaceAll(path.sep, '/')}`)
