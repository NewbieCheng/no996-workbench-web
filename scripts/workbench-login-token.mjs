/**
 * Login via local Vite proxy (8897) and print access token for browser injection.
 */
const base = (process.env.NO996_API_BASE || 'http://127.0.0.1:8897').replace(/\/$/, '');
const email = process.env.NO996_MEMBER_EMAIL;
const password = process.env.NO996_MEMBER_PASSWORD;
if (!email || !password) throw new Error('缺少联调账号：请设置 NO996_MEMBER_EMAIL / NO996_MEMBER_PASSWORD（仓库不保存凭据）。');

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

function parseTiles(svg) {
  const tiles = [];
  const groupRe = /<g data-captcha-id="([^"]+)" data-captcha-kind="([^"]+)"[^>]*>/g;
  let m;
  while ((m = groupRe.exec(svg)) !== null) {
    const slice = svg.slice(m.index, m.index + 900);
    const rect = slice.match(/width="(\d+)"[^>]*height="(\d+)"/);
    if (!rect) continue;
    tiles.push({
      id: m[1],
      kind: m[2],
      area: Number(rect[1]) * Number(rect[2]),
    });
  }
  return tiles;
}

function solveClickCaptcha(svg, prompt, iconTarget, sequence) {
  const tiles = parseTiles(svg);
  if (!tiles.length) return '';

  switch (prompt) {
    case 'click_icon':
      return tiles.find((t) => t.kind === iconTarget)?.id ?? '';
    case 'click_smallest':
    case 'click_largest':
    case 'click_second_smallest': {
      const pool = tiles.every((t) => t.kind === iconTarget)
        ? tiles
        : tiles.filter((t) => t.kind === iconTarget);
      const ranked = [...pool].sort((a, b) => a.area - b.area);
      if (prompt === 'click_smallest') return ranked[0]?.id ?? '';
      if (prompt === 'click_second_smallest') return ranked[1]?.id ?? '';
      return ranked[ranked.length - 1]?.id ?? '';
    }
    case 'click_sequence': {
      const ids = [];
      for (const kind of sequence ?? []) {
        const hit = tiles.find((t) => t.kind === kind);
        if (hit) ids.push(hit.id);
      }
      return ids.join(',');
    }
    case 'click_size_asc':
    case 'click_size_desc': {
      const pool = tiles.filter((t) => t.kind === iconTarget);
      const ranked = [...pool].sort((a, b) => a.area - b.area);
      if (prompt === 'click_size_asc') return ranked.map((t) => t.id).join(',');
      return [...ranked].reverse().map((t) => t.id).join(',');
    }
    default:
      return tiles.find((t) => t.kind === iconTarget)?.id ?? '';
  }
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

async function tryLoginOnce() {
  const click = await jsonFetch(`${base}/api/v1/auth/captcha?type=click`);
  const data = click.body?.data;
  const captchaId = data?.id;
  let captchaCode = '';
  if (data?.type === 'click' && data?.svg) {
    captchaCode = solveClickCaptcha(
      data.svg,
      data.prompt ?? '',
      data.icon_target ?? '',
      data.sequence,
    );
  } else if (data?.type === 'image' && data?.svg) {
    captchaCode = data.code || parseImageCaptchaSvg(data.svg);
  }
  if (!captchaId || !captchaCode) {
    return { ok: false, step: 'captcha', detail: { prompt: data?.prompt, target: data?.icon_target } };
  }
  const login = await jsonFetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      mode: 2,
      session_channel: 'app',
      captcha_id: captchaId,
      captcha_code: captchaCode,
    }),
  });
  const access = login.body?.data?.access_token;
  const refresh = login.body?.data?.refresh_token;
  if (!access) {
    return { ok: false, step: 'login', status: login.status, error: login.body?.error };
  }
  return { ok: true, access_token: access, refresh_token: refresh };
}

async function login() {
  for (let i = 0; i < 8; i++) {
    const result = await tryLoginOnce();
    if (result.ok) {
      console.log(JSON.stringify(result));
      return;
    }
    if (result.step === 'login' && result.error?.code !== 'AUTH_CAPTCHA_INVALID') {
      console.log(JSON.stringify(result));
      process.exit(1);
    }
  }
  console.log(JSON.stringify({ ok: false, step: 'login', error: 'AUTH_CAPTCHA_INVALID after retries' }));
  process.exit(1);
}

login().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
