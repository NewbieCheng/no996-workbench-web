/**
 * 导出单文件提词器 HTML。
 *
 * 硬性要求：
 * - 零外部请求：不引 CDN、不引 Google Fonts，只用系统字体栈（参考原型引了 CDN，这里不带过来）
 * - 双击即可离线打开
 * - 支持播放/暂停、速度、字号、空格键、Esc 退出编辑态
 */
import type { ScriptConfig, ScriptSegment } from '../agent/types'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export type BuildTeleprompterOptions = {
  config: ScriptConfig
  segments: ScriptSegment[]
  spokenOf: (seg: ScriptSegment) => string
  /** 生成时间文案（由调用方传入，便于展示本地时间） */
  generatedAt: string
}

/** 生成完整的单文件 HTML 字符串 */
export function buildTeleprompterHtml(options: BuildTeleprompterOptions): string {
  const { config, segments, spokenOf, generatedAt } = options
  const isVideo = config.mode === 'video'
  const asideLabel = isVideo ? '画面' : '互动'
  const title = `${config.product} · ${isVideo ? '视频脚本' : '直播脚本'}提词器`

  const blocks = segments
    .map((seg) => {
      const spoken = escapeHtml(spokenOf(seg))
      const aside = escapeHtml((isVideo ? seg.visual : seg.action) ?? '')
      return `    <section class="blk">
      <div class="stamp">${formatTimecode(seg.startSec)} – ${formatTimecode(seg.endSec)}</div>
      <h2>${escapeHtml(seg.name)}</h2>
      <p class="spoken">${spoken}</p>
      ${aside ? `<p class="aside"><strong>${asideLabel}</strong>${aside}</p>` : ''}
    </section>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)}</title>
<style>
  /* 系统字体栈：不请求任何网络字体 */
  :root {
    --acc: #2dd4bf;
    --ink: #f2f5fa;
    --mute: #8d96b8;
    --bg: #05060a;
    --size: 40px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: 'Alibaba PuHuiTi', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei',
      'Noto Sans SC', system-ui, -apple-system, 'Segoe UI', sans-serif;
    display: grid;
    grid-template-rows: auto 1fr auto;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
    padding: 10px 16px;
    border-bottom: 1px solid #1e2333;
    background: rgba(5, 6, 10, 0.92);
    position: sticky;
    top: 0;
    z-index: 2;
  }
  .title { font-size: 13px; font-weight: 700; margin-right: auto; }
  .ctl { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--mute); }
  input[type='range'] { width: 104px; accent-color: var(--acc); }
  button {
    padding: 6px 14px;
    border: 1px solid #2a3150;
    border-radius: 8px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  button:hover { border-color: var(--acc); color: var(--acc); }
  button.primary { background: var(--acc); border-color: var(--acc); color: #05211d; font-weight: 700; }
  main { overflow-y: auto; padding: 7vh 6vw 40vh; scroll-behavior: smooth; }
  .wrap { max-width: 880px; margin: 0 auto; }
  .blk { margin: 0 0 34px; }
  .stamp { font-size: 12px; color: var(--mute); font-variant-numeric: tabular-nums; }
  h2 { font-size: calc(var(--size) * 0.44); margin: 4px 0 8px; font-weight: 700; letter-spacing: 0.01em; }
  .spoken { font-size: var(--size); line-height: 1.72; margin: 0; white-space: pre-wrap; }
  .aside {
    margin: 10px 0 0;
    font-size: calc(var(--size) * 0.34);
    color: var(--mute);
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .aside strong { color: var(--acc); margin-right: 6px; font-weight: 600; }
  footer {
    padding: 9px 16px;
    border-top: 1px solid #1e2333;
    font-size: 11px;
    color: #6d7699;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
  }
  @media (prefers-reduced-motion: reduce) { main { scroll-behavior: auto; } }
</style>
</head>
<body>
<header>
  <span class="title">${escapeHtml(title)}</span>
  <div class="ctl"><label for="speed">速度</label><input id="speed" type="range" min="1" max="8" step="1" value="2" /></div>
  <div class="ctl"><label for="size">字号</label><input id="size" type="range" min="24" max="64" step="2" value="40" /></div>
  <button id="toggle" class="primary">开始提词</button>
  <button id="top">回到开头</button>
</header>
<main id="stage">
  <div class="wrap">
${blocks}
  </div>
</main>
<footer>
  <span>生成时间：${escapeHtml(generatedAt)}</span>
  <span>本文件为单文件离线提词器，不含任何外部请求。预估数据仅作创作参考。</span>
</footer>
<script>
  (function () {
    var stage = document.getElementById('stage');
    var toggle = document.getElementById('toggle');
    var speedEl = document.getElementById('speed');
    var sizeEl = document.getElementById('size');
    var topBtn = document.getElementById('top');
    var timer = null;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      toggle.textContent = '开始提词';
    }
    function step() {
      // 速度 1-8 对应每 30ms 前进 1-8px（对齐参考原型的手感）
      stage.scrollTop += Number(speedEl.value);
    }
    function start() {
      if (reduce) {
        // 减少动效时不自动滚动，避免强制运动
        toggle.textContent = '已停用自动滚动';
        return;
      }
      stop();
      timer = setInterval(step, 30);
      toggle.textContent = '暂停';
    }
    function toggleRun() {
      if (timer) { stop(); return; }
      if (reduce) { toggle.textContent = '已停用自动滚动'; return; }
      start();
    }

    toggle.addEventListener('click', toggleRun);
    topBtn.addEventListener('click', function () { stage.scrollTop = 0; });
    sizeEl.addEventListener('input', function () {
      document.documentElement.style.setProperty('--size', sizeEl.value + 'px');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === ' ' && e.target === document.body) { e.preventDefault(); toggleRun(); }
      if (e.key === 'Escape') { stop(); }
      if (e.key === 'Home') { stage.scrollTop = 0; }
    });
  })();
</script>
</body>
</html>
`
}

/** 导出文件名 */
export function teleprompterFilename(config: ScriptConfig): string {
  const safe = (config.product || '未命名').replace(/[\\/:*?"<>|]/g, '').slice(0, 40)
  return `${safe}-${config.mode === 'live' ? '直播' : '视频'}提词器.html`
}
