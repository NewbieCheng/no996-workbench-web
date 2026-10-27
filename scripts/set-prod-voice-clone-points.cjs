const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const backendEnv = resolve(
  'F:/Dev/Desktop-Projects/不加班智能团后端/.worktrees/v1-backend/.env',
);
const env = {};
for (const line of readFileSync(backendEnv, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (!m) continue;
  env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}
const base = 'https://worker.no996ai.cn';
const points = process.env.VOICE_CLONE_POINTS || '9900';

async function jsonFetch(url, init = {}) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = {};
  }
  return { status: res.status, body };
}

function parseImageCaptchaSvg(svg) {
  const texts = [];
  const re = /<text[^>]*x="([^"]+)"[^>]*>([^<]*)<\/text>/gi;
  let m;
  while ((m = re.exec(svg)) !== null) {
    texts.push({ x: Number(m[1]), ch: m[2].trim() });
  }
  texts.sort((a, b) => a.x - b.x);
  return texts.map((t) => t.ch).join('');
}

async function adminLogin() {
  const captcha = await jsonFetch(`${base}/api/v1/auth/captcha?type=image`);
  const loginBody = {
    email: env.SEED_SUPER_ADMIN_EMAIL,
    password: env.SEED_SUPER_ADMIN_PASSWORD,
    mode: 1,
    session_channel: 'app',
  };
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
  if (!token) throw new Error(`login failed: ${login.status}`);
  return token;
}

(async () => {
  const token = await adminLogin();
  const put = await jsonFetch(`${base}/api/v1/admin/tools/settings`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: [{ key: 'voice_clone_points', value: points }] }),
  });
  if (put.status !== 200) {
    console.error('PUT failed', put.status, put.body);
    process.exit(1);
  }
  const row = (put.body?.data?.settings ?? []).find((s) => s.key === 'voice_clone_points');
  console.log(`voice_clone_points=${row?.value ?? points}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
