/**
 * Long-text TTS smoke test (defaults to 4400 chars).
 * Measures synthesis latency, verifies HTTP 200 + non-empty audio URL,
 * and ensures requests exceeding 120s no longer time out.
 *
 * Usage:
 *   node scripts/tts-speech-long-smoke.mjs [--chars 4400] [--base http://127.0.0.1:8897] [--voice longanlingxin]
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

const targetChars = parseInt(getArg('--chars', '4400'), 10);
const base = (getArg('--base', process.env.NO996_API_BASE || 'http://127.0.0.1:8897')).replace(/\/$/, '');
const voice = getArg('--voice', 'longanlingxin');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const loginScript = resolve(scriptDir, 'workbench-login-token.mjs');

console.log(`[smoke] targetChars=${targetChars} base=${base} voice=${voice}`);
console.log('[smoke] Logging in to obtain access token...');

const raw = execSync(`node "${loginScript}"`, {
  encoding: 'utf8',
  env: { ...process.env, NO996_API_BASE: base },
}).trim();

let login;
try {
  login = JSON.parse(raw);
} catch {
  console.error(`[smoke] Failed to parse login output: ${raw}`);
  process.exit(1);
}

if (!login?.ok || !login.access_token) {
  console.error('[smoke] Login failed:', raw);
  process.exit(1);
}

const token = login.access_token;
console.log('[smoke] Login OK. Preparing text payload...');

const sampleParagraph =
  '在数字化转型的大潮中，效率与专业度成为了决定企业和个人竞争力的核心要素。我们所构建的智能体系，不仅旨在帮大家解放繁琐重复的手工流程，更致力于提供一个深度可控、质量可信赖的内容生产闭环。无论是长音频配音、剧本打磨，还是全流程自动化产出，核心都在于让创作者专注于最有价值的思考与创意表达。';

let text = '';
let repeat = 0;
while (text.length < targetChars) {
  repeat++;
  text += `【第${repeat}段】` + sampleParagraph;
}
text = text.slice(0, targetChars);

console.log(`[smoke] Generated payload of exact length: ${text.length} chars.`);
console.log('[smoke] Sending POST /api/v1/ai/audio/speech with 620s client timeout...');

const start = Date.now();
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 620_000);

try {
  const resp = await fetch(`${base}/api/v1/ai/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: 'qwen-audio-3.0-tts-plus',
      input: text,
      voice,
      response_format: 'wav',
    }),
    signal: controller.signal,
  });

  clearTimeout(timer);
  const elapsedMs = Date.now() - start;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  console.log(`[smoke] Response status=${resp.status} (${resp.statusText}) elapsed=${elapsedSec}s (${elapsedMs}ms)`);

  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await resp.json();
    console.log('[smoke] Response body:', JSON.stringify(data, null, 2));

    if (resp.ok && data?.url) {
      console.log(`[smoke] SUCCESS! Audio synthesized in ${elapsedSec}s. URL=${data.url}`);
      process.exit(0);
    } else {
      console.error(`[smoke] FAILED with response:`, data);
      process.exit(2);
    }
  } else {
    const buf = await resp.arrayBuffer();
    console.log(`[smoke] Received binary stream: ${buf.byteLength} bytes.`);
    if (resp.ok && buf.byteLength > 0) {
      console.log(`[smoke] SUCCESS! Audio binary synthesized in ${elapsedSec}s.`);
      process.exit(0);
    } else {
      console.error(`[smoke] FAILED with status ${resp.status}`);
      process.exit(2);
    }
  }
} catch (err) {
  clearTimeout(timer);
  const elapsedMs = Date.now() - start;
  console.error(`[smoke] Request ERROR after ${(elapsedMs / 1000).toFixed(1)}s:`, err.message || err);
  process.exit(3);
}
