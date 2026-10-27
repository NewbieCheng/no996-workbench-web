import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const root = process.cwd()
const inventoryPath = path.join(root, 'scripts/i18n-ui-copy-inventory.json')
const localeRoot = path.join(root, 'src/i18n/locales')
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'))

function flatten(value, prefix = '', out = []) {
  for (const [key, item] of Object.entries(value ?? {})) {
    const next = prefix ? `${prefix}.${key}` : key
    if (typeof item === 'string') out.push([next, item])
    else if (item && typeof item === 'object' && !Array.isArray(item)) flatten(item, next, out)
  }
  return out
}

function readCatalogs() {
  const catalogs = new Map()
  const zhRoot = path.join(localeRoot, 'zh-CN')
  const enRoot = path.join(localeRoot, 'en-US')
  for (const file of fs.readdirSync(zhRoot).filter((name) => name.endsWith('.json'))) {
    const namespace = file.slice(0, -5)
    const zh = flatten(JSON.parse(fs.readFileSync(path.join(zhRoot, file), 'utf8')))
    const enPath = path.join(enRoot, file)
    if (!fs.existsSync(enPath)) continue
    const enByKey = new Map(flatten(JSON.parse(fs.readFileSync(enPath, 'utf8'))))
    for (const [key, source] of zh) {
      const en = enByKey.get(key)
      if (typeof en !== 'string' || en === source) continue
      const choices = catalogs.get(source) ?? []
      choices.push({ namespace, key, en })
      catalogs.set(source, choices)
    }
  }
  return catalogs
}

function translationFor(source, catalogs, manual) {
  const existing = catalogs.get(source)?.[0]
  if (existing) return { namespace: existing.namespace, key: existing.key, en: existing.en }
  const en = manual[source]
  if (!en) return null
  return { namespace: 'uiCopy', key: source, en }
}

const catalogs = readCatalogs()
const manual = JSON.parse(fs.readFileSync(path.join(root, 'scripts/i18n-ui-copy-en.json'), 'utf8'))
const translations = new Map(inventory.map((entry) => [entry.source, translationFor(entry.source, catalogs, manual)]))
const missing = [...translations].filter(([, value]) => !value).map(([source]) => source)
if (missing.length) {
  console.error(`UNMAPPED=${missing.join(' | ')}`)
  process.exitCode = 1
} else if (process.argv[2] !== 'apply') {
  console.log(`READY=${translations.size}`)
  console.log('Run with "apply" to update locale files and JSX nodes.')
} else {
  const zhUiCopyPath = path.join(localeRoot, 'zh-CN/uiCopy.json')
  const enUiCopyPath = path.join(localeRoot, 'en-US/uiCopy.json')
  const uiCopyZh = fs.existsSync(zhUiCopyPath) ? JSON.parse(fs.readFileSync(zhUiCopyPath, 'utf8')) : {}
  const uiCopyEn = fs.existsSync(enUiCopyPath) ? JSON.parse(fs.readFileSync(enUiCopyPath, 'utf8')) : {}
  for (const [source, value] of translations) {
    if (value.namespace !== 'uiCopy') continue
    uiCopyZh[source] = source
    uiCopyEn[source] = value.en
  }
  fs.writeFileSync(zhUiCopyPath, `${JSON.stringify(uiCopyZh, null, 2)}\n`, 'utf8')
  fs.writeFileSync(enUiCopyPath, `${JSON.stringify(uiCopyEn, null, 2)}\n`, 'utf8')

  const fileNames = [...new Set(inventory.flatMap((entry) => entry.locations.map((location) => location.file)))]
  let replacements = 0
  for (const relative of fileNames) {
    const file = path.join(root, relative)
    const sourceText = fs.readFileSync(file, 'utf8')
    const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const ast = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, scriptKind)
    const edits = []
    const makeCall = (source) => {
      const entry = translations.get(source)
      const key = `${entry.namespace}:${entry.key}`
      const options = entry.namespace === 'uiCopy' ? ', { keySeparator: false }' : ''
      return `i18n.t(${JSON.stringify(key)}${options})`
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
      if (ts.isJsxText(node)) {
        const normalized = node.text.replace(/\s+/gu, ' ').trim()
        if (translations.has(normalized)) {
          const leading = node.text.match(/^\s*/u)?.[0] ?? ''
          const trailing = node.text.match(/\s*$/u)?.[0] ?? ''
          edits.push({ start: node.getStart(ast), end: node.end, text: `${leading}{${makeCall(normalized)}}${trailing}` })
        }
      } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const value = node.initializer.text.trim()
        if (translations.has(value)) {
          edits.push({ start: node.initializer.getStart(ast), end: node.initializer.end, text: `{${makeCall(value)}}` })
        }
      } else if (insideJsxExpression(node) && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
        const value = node.text.trim()
        if (translations.has(value)) {
          edits.push({ start: node.getStart(ast), end: node.end, text: makeCall(value) })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(ast)
    if (!edits.length) continue

    let updated = sourceText
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      updated = `${updated.slice(0, edit.start)}${edit.text}${updated.slice(edit.end)}`
      replacements += 1
    }
    if (!/from\s+['"]@\/i18n['"]/.test(updated)) {
      const lastImport = ast.statements.filter(ts.isImportDeclaration).at(-1)
      if (lastImport) {
        updated = `${updated.slice(0, lastImport.end)}\nimport i18n from '@/i18n'${updated.slice(lastImport.end)}`
      } else {
        updated = `import i18n from '@/i18n'\n${updated}`
      }
    }
    fs.writeFileSync(file, updated, 'utf8')
  }
  console.log(`TRANSLATIONS=${translations.size}`)
  console.log(`CODE_REPLACEMENTS=${replacements}`)
  console.log(`FILES_UPDATED=${fileNames.length}`)
}
