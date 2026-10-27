/**
 * 生成音效与 BGM 清单。
 *
 * 扫描 public/sfx/<category>/*.mp3 与 public/bgm/*.mp3，产出 TypeScript 清单，
 * 供面板与时间轴按需 fetch（不进主包）。
 *
 * 用法：node scripts/generate-audio-manifest.mjs
 */

import { readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const PUBLIC = path.join(ROOT, 'packages/video-editor/public')
const OUT = path.join(ROOT, 'packages/video-editor/src/media/audio-manifest.generated.ts')

const CATEGORY_LABELS = {
  transition: '转场',
  impact: '冲击',
  riser: '升起',
  camera: '镜头',
  ui: '界面',
  text: '文字',
  paper: '纸张',
  film: '胶片',
  light: '光效',
  data: '数据',
  scifi: '科幻',
  mech: '机械',
  glass: '玻璃',
  fluid: '流体',
  crowd: '人群',
  counter: '计数',
}

function listSfx() {
  const dir = path.join(PUBLIC, 'sfx')
  let categories
  try {
    categories = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  } catch {
    return []
  }
  const items = []
  for (const category of categories) {
    const categoryDir = path.join(dir, category.name)
    const files = readdirSync(categoryDir).filter((name) => /\.mp3$/i.test(name))
    for (const file of files.sort()) {
      const bytes = statSync(path.join(categoryDir, file)).size
      items.push({
        id: `${category.name}/${file.replace(/\.mp3$/i, '')}`,
        category: category.name,
        categoryLabel: CATEGORY_LABELS[category.name] ?? category.name,
        label: file.replace(/\.mp3$/i, ''),
        path: `sfx/${category.name}/${file}`,
        bytes,
      })
    }
  }
  return items
}

function listBgm() {
  const dir = path.join(PUBLIC, 'bgm')
  let files
  try {
    files = readdirSync(dir).filter((name) => /\.mp3$/i.test(name))
  } catch {
    return []
  }
  return files.sort().map((file) => ({
    id: `bgm/${file.replace(/\.mp3$/i, '')}`,
    label: file.replace(/\.mp3$/i, ''),
    path: `bgm/${file}`,
    bytes: statSync(path.join(dir, file)).size,
  }))
}

const sfx = listSfx()
const bgm = listBgm()

const categories = [...new Set(sfx.map((item) => item.category))].map((id) => ({
  id,
  label: CATEGORY_LABELS[id] ?? id,
  count: sfx.filter((item) => item.category === id).length,
}))

const body = `/**
 * 音效与 BGM 清单 —— 由 scripts/generate-audio-manifest.mjs 生成，禁止手改。
 * 共 ${sfx.length} 个音效（${categories.length} 类）、${bgm.length} 首 BGM。
 * 资源位于 packages/video-editor/public/，按需 fetch，不进主包。
 */

export type SfxDefinition = {
  id: string
  category: string
  categoryLabel: string
  label: string
  /** 相对 public 根的路径 */
  path: string
  bytes: number
}

export type BgmDefinition = {
  id: string
  label: string
  path: string
  bytes: number
}

export const SFX_CATALOG: readonly SfxDefinition[] = ${JSON.stringify(sfx, null, 2)}

export const BGM_CATALOG: readonly BgmDefinition[] = ${JSON.stringify(bgm, null, 2)}

export const SFX_COUNT = ${sfx.length}
export const BGM_COUNT = ${bgm.length}

export const SFX_CATEGORIES: readonly { id: string; label: string; count: number }[] =
  ${JSON.stringify(categories, null, 2)}

export function findSfx(id: string): SfxDefinition | undefined {
  return SFX_CATALOG.find((item) => item.id === id)
}

/** 解析成浏览器可加载的 URL（配合 Vite 的 BASE_URL）。 */
export function audioAssetUrl(relativePath: string): string {
  const base =
    typeof import.meta !== 'undefined' && typeof import.meta.env?.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/'
  const prefix = base.endsWith('/') ? base : \`\${base}/\`
  // 音效与 BGM 作为公共包资源，由 video-editor 的 public 目录提供；
  // 宿主若未配置该目录，会 404 —— 此时面板会如实提示，不伪造播放。
  return \`\${prefix}video-editor/\${relativePath.replace(/^\\/+/, '')}\`
}
`

writeFileSync(OUT, body, 'utf8')
console.log(`已生成：${sfx.length} 个音效（${categories.length} 类）、${bgm.length} 首 BGM`)
console.log(`→ ${path.relative(ROOT, OUT)}`)
