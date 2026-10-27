/**
 * 从移植进来的 demo 源码生成镜头注册表。
 *
 * 抽取规则：
 *   时长   `export const XXX_DURATION = 123` / `= DUR` / `= A + B * C`（表达式会尝试求值）
 *   组件   与时长常量同名前缀的 React.FC 导出；单文件单组件时直接取
 *   摘要   文件头第一行注释
 *
 * 一个目录可能包含多个 demo（如 crash-zoom-punch 有 CrashImpactReal + CrashZoomReal），
 * 每个 .tsx 都算独立镜头，shotId 用 `category/demo~Component` 去重。
 *
 * 硬校验：任一条无法解析时长直接失败，不静默跳过。
 *
 * 用法：node scripts/generate-shot-registry.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractEditableKeys } from './lib/shot-editable-keys.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const DEMOS = path.join(ROOT, 'packages/video-editor/src/demos')
const SHOTS = path.join(DEMOS, 'shots')
const OUT = path.join(DEMOS, 'registry.generated.ts')

/**
 * 竖屏构图元数据（人工校准的结果，见 docs/shot-color-coverage-and-vertical-plan.md 的 V 阶段）。
 * 文件不存在 = 全部走默认（cover + 中心焦点）。逐镜头覆盖而不改组件源码。
 */
const VERTICAL_PATH = path.join(DEMOS, 'vertical-presets.json')
const verticalPresets = existsSync(VERTICAL_PATH)
  ? JSON.parse(readFileSync(VERTICAL_PATH, 'utf8'))
  : {}

/**
 * 固定配色登记：画面主体是整页截图 / 共享占位素材、四个配色槽位没有可落地对象的镜头。
 * 登记后检查器不再显示配色控件，改成一句"该镜头配色随素材固定"，避免出现拖了不动的假控件。
 */
const COLOR_FIXED_PATH = path.join(DEMOS, 'color-fixed.json')
const colorFixed = existsSync(COLOR_FIXED_PATH)
  ? JSON.parse(readFileSync(COLOR_FIXED_PATH, 'utf8'))
  : {}

const CATEGORY_LABELS = {
  opening: '开场与品牌',
  camera: '相机运镜',
  transition: '转场',
  typography: '字体排版',
  'ui-entrance': '界面入场',
  interaction: '交互演示',
  data: '数据图表',
  effects: '光影与强调',
  rhythm: '节奏切点',
  outro: '收尾',
}

/**
 * 少数 demo 的时长是运行期表达式（引用数组长度等），静态求值不可靠。
 * 这些值取自源码注释里的实测帧数，人工核对。
 */
const DURATION_OVERRIDES = {
  'typography/pill-slot-cycle/PillSlotCycle': 200, // INTRO12 + CYCLES*BEAT21 + FIN14 + 48 = 200
}

async function listDemoDirs() {
  const categories = await readdir(SHOTS, { withFileTypes: true })
  const dirs = []
  for (const category of categories) {
    if (!category.isDirectory() || category.name.startsWith('_')) continue
    const categoryDir = path.join(SHOTS, category.name)
    const demos = await readdir(categoryDir, { withFileTypes: true })
    for (const demo of demos) {
      if (!demo.isDirectory()) continue
      const demoDir = path.join(categoryDir, demo.name)
      const entries = await readdir(demoDir, { withFileTypes: true })
      const files = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
        // VerticalTicker 是 PageWaterfallWall 的内部依赖，不是独立镜头
        .filter((entry) => !/^VerticalTicker\.tsx$/.test(entry.name))
        .map((entry) => entry.name)
      if (files.length) dirs.push({ category: category.name, demo: demo.name, dir: demoDir, files })
    }
  }
  return dirs
}

/** 把 `A + B * C` 这类简单表达式求值，常量表由文件内 `const X = n` 提供。 */
function resolveDurationExpression(expression, constants) {
  const trimmed = expression.trim().replace(/;.*$/, '').replace(/\/\/.*$/, '').trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  if (!/^[\w\s+\-*/().]+$/.test(trimmed)) return null
  const names = [...trimmed.matchAll(/[A-Za-z_]\w*/g)].map((m) => m[0])
  for (const name of names) {
    if (!(name in constants)) return null
  }
  try {
    // 仅含数字与已解析常量的算术表达式
    const fn = new Function(...names, `"use strict"; return (${trimmed});`)
    const value = fn(...names.map((name) => constants[name]))
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null
  } catch {
    return null
  }
}

function parseFile(file) {
  const source = readFileSync(file, 'utf8')

  // 简单数值常量表（用于表达式求值）
  const constants = {}
  for (const match of source.matchAll(/^const\s+([A-Za-z_]\w*)\s*=\s*(\d+)\s*;/gm)) {
    constants[match[1]] = Number(match[2])
  }

  // 时长
  let durationInFrames = null
  const durationMatch = source.match(
    /(?:export\s+)?const\s+(\w*(?:DURATION|DUR)\w*)\s*=\s*([^;\n]+)/,
  )
  if (durationMatch) {
    durationInFrames = resolveDurationExpression(durationMatch[2], constants)
  }

  const overrideKey = path
    .relative(SHOTS, file)
    .replace(/\\/g, '/')
    .replace(/\.tsx$/, '')
  if (DURATION_OVERRIDES[overrideKey]) durationInFrames = DURATION_OVERRIDES[overrideKey]

  // 组件
  const exported = [...source.matchAll(/export\s+const\s+([A-Z]\w*)\s*:\s*React\.FC/g)].map((m) => m[1])
  let component = null
  if (durationMatch) {
    const prefix = durationMatch[1].replace(/(?:_?DURATION|_?DUR)$/, '')
    if (prefix) {
      const normalized = prefix.replace(/_/g, '').toLowerCase()
      component = exported.find((name) => name.toLowerCase().replace(/_/g, '') === normalized) ?? null
    }
  }
  if (!component && exported.length === 1) component = exported[0]
  if (!component) {
    const defaultExport = source.match(/export\s+default\s+([A-Z]\w*)/)
    if (defaultExport) component = defaultExport[1]
  }
  if (!component) [component] = exported

  const summary =
    source
      .split('\n')
      .filter((line) => line.trim().startsWith('//'))
      .map((line) => line.replace(/^\s*\/\/\s?/, '').trim())
      .find((line) => line.length > 4 && !/^origin/i.test(line)) ?? ''

  // 用了 CameraMotionBlur 的镜头标注为近似档
  const fidelity = /CameraMotionBlur/.test(source) ? 'approx' : 'high'

  // 真实可编辑键：组件里确实调用了 useShotProp('key') 的键（唯一口径见 lib/shot-editable-keys.mjs）
  const editableKeys = extractEditableKeys(source)

  // 配色接入方式：palette = 自带色板只开放 4 个槽位；look = 整套色盘；undefined = 未接配色
  const colorMode = /usePalette\s*\(/.test(source) ? 'palette' : /useLook\s*\(/.test(source) ? 'look' : undefined

  return { durationInFrames, component, summary, fidelity, editableKeys, colorMode }
}

async function main() {
  const dirs = await listDemoDirs()
  const entries = []
  const problems = []

  for (const { category, demo, dir, files } of dirs) {
    for (const fileName of files) {
      const file = path.join(dir, fileName)
      const parsed = parseFile(file)
      if (!parsed.durationInFrames || !parsed.component) {
        problems.push(
          `${category}/${demo}/${fileName}: ${!parsed.durationInFrames ? '无法解析时长' : ''}` +
            `${!parsed.component ? ' 无法解析组件' : ''}`,
        )
        continue
      }
      const shotId = files.length > 1 ? `${category}/${demo}~${parsed.component}` : `${category}/${demo}`
      entries.push({
        shotId,
        category,
        categoryLabel: CATEGORY_LABELS[category] ?? category,
        name: demo,
        component: parsed.component,
        durationInFrames: parsed.durationInFrames,
        summary: parsed.summary,
        fidelity: parsed.fidelity,
        editableKeys: parsed.editableKeys,
        colorMode: colorFixed[shotId] ? undefined : parsed.colorMode,
        colorFixedReason: colorFixed[shotId]?.reason,
        vertical: verticalPresets[shotId],
        importPath: (() => {
          const rel = path.relative(DEMOS, file).replace(/\\/g, '/').replace(/\.tsx$/, '')
          return rel.startsWith('.') ? rel : `./${rel}`
        })(),
      })
    }
  }

  entries.sort((a, b) => a.shotId.localeCompare(b.shotId))

  if (problems.length) {
    console.error(`有 ${problems.length} 个 demo 无法登记（不允许静默跳过）：`)
    for (const problem of problems) console.error('  ' + problem)
    process.exit(1)
  }

  const body = entries
    .map(
      (entry) =>
        `  {\n` +
        `    shotId: ${JSON.stringify(entry.shotId)},\n` +
        `    category: ${JSON.stringify(entry.category)},\n` +
        `    categoryLabel: ${JSON.stringify(entry.categoryLabel)},\n` +
        `    name: ${JSON.stringify(entry.name)},\n` +
        `    durationInFrames: ${entry.durationInFrames},\n` +
        `    summary: ${JSON.stringify(entry.summary)},\n` +
        `    fidelity: ${JSON.stringify(entry.fidelity)},\n` +
        `    editableKeys: ${JSON.stringify(entry.editableKeys)},\n` +
        (entry.colorMode ? `    colorMode: ${JSON.stringify(entry.colorMode)},\n` : '') +
        (entry.colorFixedReason
          ? `    colorFixed: true,\n    colorFixedReason: ${JSON.stringify(entry.colorFixedReason)},\n`
          : '') +
        (entry.vertical ? `    vertical: ${JSON.stringify(entry.vertical)},\n` : '') +
        `    importPath: ${JSON.stringify(entry.importPath)},\n` +
        `    load: () => import(${JSON.stringify(entry.importPath)}).then((m) => m.${entry.component}),\n` +
        `  },`,
    )
    .join('\n')

  const categoryRows = Object.keys(CATEGORY_LABELS)
    .map((id) => {
      const count = entries.filter((entry) => entry.category === id).length
      return count
        ? `  { id: ${JSON.stringify(id)}, label: ${JSON.stringify(CATEGORY_LABELS[id])}, count: ${count} },`
        : null
    })
    .filter(Boolean)
    .join('\n')

  const output = `/**
 * 镜头注册表 —— 由 scripts/generate-shot-registry.mjs 生成，禁止手改。
 * 源：video-shotcraft @ 43bd349，共 ${entries.length} 个镜头。
 */

import type { ComponentType } from 'react'

export type ShotFidelity = 'high' | 'approx'

export type ShotDefinition = {
  shotId: string
  category: string
  categoryLabel: string
  name: string
  durationInFrames: number
  summary: string
  fidelity: ShotFidelity
  /** 组件源码中真实调用 useShotProp('key') 的键（升序）。空数组 = 演示固定场景，无参数入口。 */
  editableKeys: readonly string[]
  /** 配色接入方式：'look' = 整套色盘；'palette' = 自带色板只开放 4 个槽位；缺省 = 未接配色。 */
  colorMode?: 'look' | 'palette'
  /** 配色随素材固定：画面主体是整页截图/共享占位素材，没有可落地的配色槽位（详见 colorFixedReason）。 */
  colorFixed?: boolean
  colorFixedReason?: string
  /** 竖屏构图：cover = 按焦点裁切；fit = 等比缩小留黑；reflow = 镜头自带竖屏重排。缺省 = cover + 中心。 */
  vertical?: { mode: 'cover' | 'fit' | 'reflow'; focusX: number; focusY: number }
  /** 组件源码位置（相对 demos/，无扩展名），供工具侧静态分析与测试读取。 */
  importPath: string
  load: () => Promise<ComponentType<Record<string, unknown>>>
}

export const SHOT_CATALOG: readonly ShotDefinition[] = [
${body}
]

export const SHOT_COUNT = ${entries.length}

export const SHOT_CATEGORIES: readonly { id: string; label: string; count: number }[] = [
${categoryRows}
]

export function findShot(shotId: string): ShotDefinition | undefined {
  return SHOT_CATALOG.find((shot) => shot.shotId === shotId)
}
`

  writeFileSync(OUT, output, 'utf8')
  console.log(`已生成 ${entries.length} 个镜头 → ${path.relative(ROOT, OUT)}`)
  verifyHardcodedPools(entries)
}


/**
 * 交叉校验：写死的 shotId 列表如果引用了不存在的镜头，
 * 界面上会静默变成「这个镜头没了」。这里把两处池子都核对一遍。
 */
function verifyHardcodedPools(entries) {
  const sources = [
    'src/features/video-factory/lib/map-shots.ts',
    'src/features/video-factory/lib/demo-document.ts',
  ]
  const known = new Set(entries.map((entry) => entry.shotId))
  const problems = []
  for (const relative of sources) {
    const full = path.join(ROOT, relative)
    if (!existsSync(full)) continue
    const text = readFileSync(full, 'utf8')
    const matches = text.matchAll(
      /'((?:opening|typography|ui-entrance|data|outro|effects|camera|transition|rhythm|interaction)\/[^']+)'/g,
    )
    for (const match of matches) {
      if (!known.has(match[1])) problems.push(`${relative} → ${match[1]}`)
    }
  }
  if (problems.length) {
    console.error(`有 ${problems.length} 个硬编码 shotId 在注册表里不存在（界面上会静默失效）：`)
    for (const problem of problems) console.error('  ' + problem)
    process.exit(1)
  }
}
main().catch((error) => {
  console.error(error)
  process.exit(1)
})
