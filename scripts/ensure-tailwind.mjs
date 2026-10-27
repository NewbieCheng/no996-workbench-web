import { access } from 'node:fs/promises'
import { join } from 'node:path'

const pkg = join(process.cwd(), 'node_modules', 'tailwindcss', 'package.json')
try {
  await access(pkg)
} catch {
  console.error(
    '[workbench-web] 缺少 tailwindcss，请在项目根目录执行：npm install\n',
  )
  process.exit(1)
}
