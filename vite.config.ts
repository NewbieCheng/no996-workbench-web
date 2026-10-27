import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { videoEditorAssets } from './scripts/vite-plugin-video-editor-assets.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080'
  const base = env.VITE_BASE_PATH || process.env.VITE_BASE_PATH || '/'
  return {
  base,
  plugins: [react(), tailwindcss(), videoEditorAssets()],
  // IP 口播的离线编码 worker 是 type:'module'，且经 shot-backdrop 间接引入了
  // 镜头注册表（含动态 import）。默认的 iife 格式不支持代码拆分，构建会直接失败。
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: ['mammoth', 'jszip'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@no996/ui': fileURLToPath(new URL('./packages/ui/src', import.meta.url)),
      '@no996/video-editor': fileURLToPath(new URL('./packages/video-editor/src', import.meta.url)),
      // @import 'tailwindcss' in src/index.css resolves from src/; pin to repo root node_modules.
      tailwindcss: fileURLToPath(new URL('./node_modules/tailwindcss', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 8897,
    strictPort: true,
    watch: {
      ignored: [
        '**/.*/**',
        '**/.verify/**',
        '**/*.tmp*',
        '**/.*.tmpdir/**',
        '**/tmp/**',
        '**/.tmp/**',
        '**/scripts/**',
        '**/docs/**',
      ],
    },
    proxy: {
      '/api/v1/ai/audio/speech': {
        target: apiTarget,
        changeOrigin: true,
        timeout: 600_000,
      },
      '/api/v1/ai/chat/completions': {
        target: apiTarget,
        changeOrigin: true,
        timeout: 600_000,
      },
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/v1': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/media': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 8897,
    strictPort: true,
    proxy: {
      '/api/v1/ai/audio/speech': {
        target: apiTarget,
        changeOrigin: true,
        timeout: 600_000,
      },
      '/api/v1/ai/chat/completions': {
        target: apiTarget,
        changeOrigin: true,
        timeout: 600_000,
      },
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/v1': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/media': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
}
})
