/**
 * 运行端到端流程校验：用 esbuild 把 entry.ts 打包成单文件后执行。
 *
 * 用法：node scripts/agent-flow-check/run.mjs
 * 只依赖本项目已安装的 esbuild，不联网、不连后端、不启动浏览器。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const entry = join(here, 'entry.ts');
const stubs = join(here, 'stubs');

const esbuildBin = join(root, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe');
const esbuildJs = join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

function run(command, args) {
  return spawnSync(command, args, { cwd: root, stdio: 'inherit' });
}

const outDir = mkdtempSync(join(tmpdir(), 'agent-flow-check-'));
const outFile = join(outDir, 'bundle.mjs');

try {
  const bundleArgs = [
    entry,
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${outFile}`,
    '--log-level=warning',
    '--alias:@=./src',
    // 与 vite.config.ts / tsconfig.app.json 的别名保持一致：校验脚本要能直接断言
    // 页面真正用的公共件（否则「测的是另一份实现」）。
    `--alias:@no996/ui=${resolve(root, 'packages', 'ui', 'src')}`,
    `--alias:@no996/video-editor=${resolve(root, 'packages', 'video-editor', 'src')}`,
    `--alias:@/i18n=${join(stubs, 'i18n.ts')}`,
    `--alias:@/auth/jwt=${join(stubs, 'jwt.ts')}`,
    `--alias:axios=${join(stubs, 'axios.ts')}`,
    '--define:import.meta.env={"VITE_PERSONA_USE_REMOTE":"0"}',
  ];

  // 优先用已安装的原生二进制，其次回退到 JS 入口
  const bundle = existsSync(esbuildBin)
    ? run(esbuildBin, bundleArgs)
    : run(process.execPath, [esbuildJs, ...bundleArgs]);

  if (bundle.status !== 0) {
    console.error('打包失败');
    process.exit(1);
  }

  const result = run(process.execPath, [outFile]);
  process.exit(result.status ?? 1);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
