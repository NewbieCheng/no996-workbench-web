/**
 * Local smoke: backend :8080 and Vite proxy :8897.
 * Reads SEED_SUPER_ADMIN_* from backend .env (no stdout of secrets).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backendEnvPath = resolve(
  'F:/Dev/Desktop-Projects/不加班智能团后端/.worktrees/v1-backend/.env',
);

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!m) continue;
    out[m[1].trim()] = m[2].trim();
  }
  return out;
}

const env = loadEnv(backendEnvPath);
const email = env.SEED_SUPER_ADMIN_EMAIL;
const password = env.SEED_SUPER_ADMIN_PASSWORD;

const lines = [];
function log(msg) {
  lines.push(msg);
}

async function jsonFetch(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

async function main() {
  log('EMITTED=0');
  log('--- health (8080 direct) ---');
  const live = await jsonFetch('http://127.0.0.1:8080/health/live');
  log(`live: ${live.status} ${JSON.stringify(live.body?.data ?? live.body)}`);
  const ready = await jsonFetch('http://127.0.0.1:8080/health/ready');
  log(`ready: ${ready.status} ${JSON.stringify(ready.body?.data ?? ready.body)}`);

  if (!email || !password) {
    log('SKIP login: SEED_SUPER_ADMIN_EMAIL/PASSWORD missing in backend .env');
    log('SENTINEL=done');
    console.log(lines.join('\n'));
    process.exit(1);
  }

  log('--- captcha (8080) ---');
  const captcha = await jsonFetch('http://127.0.0.1:8080/api/v1/auth/captcha?type=image');
  const captchaId = captcha.body?.data?.id ?? captcha.body?.id;
  const captchaCode = captcha.body?.data?.code ?? captcha.body?.code;
  log(`captcha: ${captcha.status} id=${captchaId ? 'yes' : 'no'} code=${captchaCode ? 'yes' : 'no'}`);

  log('--- login (8080) ---');
  const loginBody = {
    email,
    password,
    mode: 1,
    session_channel: 'app',
  };
  if (captchaId && captchaCode) {
    loginBody.captcha_id = captchaId;
    loginBody.captcha_code = captchaCode;
  }
  const login = await jsonFetch('http://127.0.0.1:8080/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginBody),
  });
  const token = login.body?.data?.access_token ?? login.body?.access_token;
  log(`login: ${login.status} token=${token ? 'yes' : 'no'}`);
  if (!token) {
    log(`login error: ${JSON.stringify(login.body?.error ?? login.body)}`);
    log('SENTINEL=done');
    console.log(lines.join('\n'));
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  log('--- models (8080) ---');
  const models = await jsonFetch('http://127.0.0.1:8080/api/v1/models?page=1&page_size=50', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const modelItems = models.body?.data?.items ?? models.body?.items;
  const chatCandidates = Array.isArray(modelItems)
    ? modelItems.filter((m) => {
        const tt = String(m.task_type ?? m.modality ?? '').toLowerCase();
        if (tt === 'chat' || tt === '1' || tt === 'text') return true;
        const code = String(m.model_code ?? m.code ?? '');
        return /deepseek|qwen-|glm-|doubao|mimo/i.test(code) && !/tts|voice|video|image|wanx|cosy/i.test(code);
      })
    : [];
  const chatModels = chatCandidates
    .map((m) => m.model_code ?? m.code ?? m.model)
    .filter((code) => typeof code === 'string' && code.length > 0);
  const preferred = ['deepseek-v4-flash', 'deepseek-flash', 'deepseek-v3', 'qwen-plus', 'glm-4-flash', 'qwen-turbo'];
  let chatModel =
    preferred.find((p) => chatModels.includes(p)) ??
    chatModels.find((c) => /deepseek|qwen|glm|doubao|mimo/i.test(c)) ??
    chatModels[0];
  log(`models: ${models.status} count=${chatModels.length} pick=${chatModel ?? 'none'}`);
  if (chatModels.length) log(`models sample: ${chatModels.slice(0, 6).join(', ')}`);

  if (!chatModel) {
    log('SKIP chat: no model_code in catalog (run seed with SEED_DEMO_DATA=1 or add models in console)');
    log('SENTINEL=done');
    console.log(lines.join('\n'));
    process.exit(2);
  }

  log('--- chat completions (8080) ---');
  const chat = await jsonFetch('http://127.0.0.1:8080/api/v1/ai/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      model: chatModel,
      messages: [{ role: 'user', content: '用三个字回复：收到' }],
      max_tokens: 32,
      stream: false,
    }),
  });
  const reply = chat.body?.choices?.[0]?.message?.content;
  log(`chat: ${chat.status} reply=${JSON.stringify(reply ?? chat.body?.error ?? chat.body?.message ?? 'empty')}`);

  log('--- chat via Vite proxy (8897) ---');
  const proxied = await jsonFetch('http://127.0.0.1:8897/api/v1/ai/chat/completions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      model: chatModel,
      messages: [{ role: 'user', content: '只回复：OK' }],
      max_tokens: 16,
      stream: false,
    }),
  });
  const proxiedReply = proxied.body?.choices?.[0]?.message?.content;
  log(`proxy chat: ${proxied.status} reply=${JSON.stringify(proxiedReply ?? proxied.body?.error ?? 'empty')}`);

  log('--- account balance (8080) ---');
  const bal = await jsonFetch('http://127.0.0.1:8080/api/v1/account/balance', {
    headers: { Authorization: `Bearer ${token}` },
  });
  log(`balance: ${bal.status} points=${bal.body?.data?.points_balance ?? 'n/a'}`);

  log('--- voice list (8080 /v1) ---');
  const voices = await jsonFetch('http://127.0.0.1:8080/v1/audio/voices', {
    headers: { Authorization: `Bearer ${token}` },
  });
  log(`voices: ${voices.status} total=${voices.body?.meta?.total ?? voices.body?.data?.length ?? 'n/a'}`);

  log('--- frontend root (8897) ---');
  const fe = await fetch('http://127.0.0.1:8897/');
  log(`workbench: ${fe.status} ${fe.ok ? 'ok' : 'fail'}`);

  log('--- web_search (8080 /v1) ---');
  const search = await jsonFetch('http://127.0.0.1:8080/v1/tools/web_search', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ queries: ['不加班智能团'] }),
  });
  const srcCount = search.body?.data?.sources?.length;
  log(`web_search: ${search.status} sources=${srcCount ?? search.body?.error?.code ?? 'n/a'}`);

  const routingOk =
    live.status === 200 &&
    ready.status === 200 &&
    login.status === 200 &&
    bal.status === 200 &&
    voices.status === 200;
  const chatOk = chat.status === 200 && proxied.status === 200;
  const chatCode = chat.body?.code ?? chat.body?.error?.code ?? '';
  const chatInfra =
    chat.status === 503 &&
    (chatCode === 'no_available_key' || String(chat.body?.message ?? '').includes('upstream key'));
  const searchInfra = search.status === 503;
  if (routingOk && chatInfra) {
    log('SUMMARY=ROUTING_OK_UPSTREAM_KEYS_MISSING');
    log('hint: 在控制台 Key 池添加供应商 Key，或设置 SEED_XIAOMI_API_KEY 后重新 seed');
  } else if (routingOk && chatOk) {
    log('SUMMARY=PASS');
  } else {
    log(`SUMMARY=PARTIAL_OR_FAIL chat=${chat.status} proxy=${proxied.status} search=${search.status}`);
  }
  const ok = routingOk && (chatOk || (chatInfra && searchInfra));
  log('SENTINEL=done');
  console.log(lines.join('\n'));
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
