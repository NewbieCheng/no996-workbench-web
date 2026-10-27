/**
 * 把公共包 `packages/video-editor/public/` 暴露到站点根下。
 *
 * 为什么需要：
 *  - 移植的 151 个镜头用 `staticFile('textures/live/x.png')` 引纹理；
 *  - 音效/BGM 共 149+5 个文件、约 32MB，必须按需 fetch、不进主包。
 *
 * 开发期用中间件直接读盘（不复制，省磁盘也不拖慢启动）；
 * 构建期在 closeBundle 里复制进 dist，保持产物自包含。
 *
 * 映射：
 *   /demos/*          → packages/video-editor/public/demos/*
 *   /video-editor/*   → packages/video-editor/public/*
 */

import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MIME = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
}

function mimeOf(file) {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/** 防止 `..` 穿越到包外。 */
function resolveSafe(rootDir, relativePath) {
  const normalized = path.normalize(relativePath).replace(/^([/\\])+/, '')
  const full = path.join(rootDir, normalized)
  if (!full.startsWith(rootDir)) return null
  return full
}

function copyDir(from, to) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dest = path.join(to, entry.name)
    if (entry.isDirectory()) copyDir(src, dest)
    else copyFileSync(src, dest)
  }
}

export function videoEditorAssets() {
  const packagePublic = fileURLToPath(new URL('../packages/video-editor/public', import.meta.url))

  /** @type {import('vite').Plugin} */
  const plugin = {
    name: 'no996-video-editor-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        let relative = null

        // 纹理实体在 public/demos/ 下，URL 直接是 /demos/...，去掉前缀后要补回 demos/
        if (url.startsWith('/demos/')) relative = `demos/${url.slice('/demos/'.length)}`
        else if (url.startsWith('/video-editor/')) relative = url.slice('/video-editor/'.length)
        if (relative === null) return next()

        let decoded
        try {
          decoded = decodeURIComponent(relative)
        } catch {
          res.statusCode = 400
          return res.end('bad path')
        }

        const file = resolveSafe(packagePublic, decoded)
        if (!file || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404
          return res.end('not found')
        }

        res.setHeader('Content-Type', mimeOf(file))
        res.setHeader('Cache-Control', 'no-cache')
        createReadStream(file).pipe(res)
      })
    },
    // writeBundle 在产物写盘之后触发；closeBundle 时 dist 可能还没生成
    writeBundle() {
      // 只在构建产物目录存在时复制
      const dist = fileURLToPath(new URL('../dist', import.meta.url))
      if (!existsSync(dist)) return
      const demos = path.join(packagePublic, 'demos')
      if (existsSync(demos)) copyDir(demos, path.join(dist, 'demos'))
      const audioOut = path.join(dist, 'video-editor')
      for (const folder of ['sfx', 'bgm']) {
        const src = path.join(packagePublic, folder)
        if (existsSync(src)) copyDir(src, path.join(audioOut, folder))
      }
    },
  }

  return plugin
}
