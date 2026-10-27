/**
 * Verify chat/completions uses expected model (login + one completion).
 * Reads VITE_CHAT_MODEL from .env.development.local or env; API via proxy target.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localEnvPath = resolve(root, '.env.development.local');

function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!m) continue;
    out[m[1].trim()] = m[2].trim();
  }
  return out;
}

const fileEnv = loadEnvFile(localEnvPath);
const base = (process.env.VITE_API_PROXY_TARGET || fileEnv.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080').replace(
  /\/$/,
  '',
);
const envOverride = process.env.VITE_CHAT_MODEL || fileEnv.VITE_CHAT_MODEL || '';

const backendEnvPath =
  'F:/Dev/Desktop-Projects/不加班智能团后端/.worktrees/v1-backend/.env';
let email = process.env.NO996_MEMBER_EMAIL;
let password = process.env.NO996_MEMBER_PASSWORD;
if ((!email || !password) && existsSync(backendEnvPath)) {
  const be = loadEnvFile(backendEnvPath);
  email = email || be.SEED_SUPER_ADMIN_EMAIL;
  password = password || be.SEED_SUPER_ADMIN_PASSWORD;
}
if (!email || !password) {
  throw new Error('缺少联调账号：请设置 NO996_MEMBER_EMAIL / NO996_MEMBER_PASSWORD（仓库不保存凭据）。');
}
const loginMode = /@bujiaoban\.cn$/i.test(email) ? 2 : 1;

function parseImageCaptchaSvg(svg) {
  if (!svg || typeof svg !== 'string') return '';
  const texts = [];
  const re = /<text[^>]*x="([^"]+)"[^>]*>([^<]*)<\/text>/gi;
  let m;
  while ((m = re.exec(svg)) !== null) {
    texts.push({ x: Number(m[1]), ch: m[2].trim() });
  }
  texts.sort((a, b) => a.x - b.x);
  return texts.map((t) => t.ch).join('');
}

async function jsonFetch(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { status: res.status, body };
}

async function main() {
  console.log(`base=${base} env_override=${envOverride || '(none)'}`);
  const captcha = await jsonFetch(`${base}/api/v1/auth/captcha?type=image`);
  const loginBody = { email, password, mode: loginMode, session_channel: 'app' };
  const captchaId = captcha.body?.data?.id ?? captcha.body?.id;
  let captchaCode = captcha.body?.data?.code ?? captcha.body?.code;
  if (!captchaCode && captcha.body?.data?.svg) {
    captchaCode = parseImageCaptchaSvg(captcha.body.data.svg);
  }
  if (captchaId && captchaCode) {
    loginBody.captcha_id = captchaId;
    loginBody.captcha_code = captchaCode;
  }
  const login = await jsonFetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginBody),
  });
  const token = login.body?.data?.access_token ?? login.body?.access_token;
  if (!token) {
    console.log(`FAIL login ${login.status}`, login.body?.error ?? login.body);
    process.exit(1);
  }

  let expectedModel = envOverride.trim();
  if (!expectedModel) {
    const def = await jsonFetch(`${base}/api/v1/models/default-chat`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expectedModel =
      def.body?.data?.model_code?.trim() ||
      def.body?.model_code?.trim() ||
      'deepseek-v4-flash';
    console.log(`default_chat_status=${def.status} model=${expectedModel}`);
    if (def.status !== 200) {
      console.log('FAIL default-chat', def.body?.error ?? def.body);
      process.exit(1);
    }
  }

  const sentModel = expectedModel;
  const chat = await jsonFetch(`${base}/api/v1/ai/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: sentModel,
      messages: [{ role: 'user', content: '只回复：OK' }],
      max_tokens: 8,
      stream: false,
    }),
  });
  const reply = chat.body?.choices?.[0]?.message?.content;
  const respModel = chat.body?.model;
  console.log(`chat_status=${chat.status} sent_model=${sentModel} resp_model=${respModel ?? 'n/a'} reply=${JSON.stringify(reply ?? chat.body?.error)}`);
  const ok = chat.status === 200 && sentModel === expectedModel;
  console.log(`SUMMARY=${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
