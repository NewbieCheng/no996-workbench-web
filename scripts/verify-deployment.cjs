const fs = require('node:fs');
const path = require('node:path');
const domain = 'https://agent.no996ai.cn';
const routes = ['/', '/login', '/workbench', ...['persona','titles','video-script','live-script','xiaohongshu','wechat-article','voice','digital-human','extension','account'].map(x => `/workbench/${x}`), '/titles', '/account'];
const results = [];
async function check(route, expected = 200) {
  const response = await fetch(domain + route, { signal: AbortSignal.timeout(8000), redirect: 'manual' });
  const body = await response.text();
  const item = { route, status: response.status, type: response.headers.get('content-type'), valid: response.status === expected };
  if (expected === 200 && !route.startsWith('/assets/') && !route.startsWith('/brand/')) item.valid &&= body.includes('<div id="root">');
  results.push(item);
  if (!item.valid) throw new Error(`Unexpected response: ${route}`);
  return body;
}
(async () => {
  const html = await check('/');
  for (let i = 1; i < routes.length; i += 4) await Promise.all(routes.slice(i, i + 4).map(route => check(route)));
  const assets = [...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)].map(x => x[1]);
  for (const asset of assets) {
    const body = await check(asset);
    if (body.startsWith('<!doctype')) throw new Error('HTML returned for asset');
  }
  await check('/brand/logo-symbol-color.svg');
  await check('/assets/not-a-real-file.js', 404);
  {
    const response = await fetch(domain + '/api/v1/auth/captcha?type=click', {
      signal: AbortSignal.timeout(8000),
      redirect: 'manual',
    });
    const item = {
      route: '/api/v1/auth/captcha?type=click',
      status: response.status,
      type: response.headers.get('content-type'),
      valid: response.status === 200,
    };
    results.push(item);
    if (!item.valid) throw new Error(`Unexpected response: ${item.route}`);
  }
  const redirect = await fetch('http://agent.no996ai.cn/login', { redirect: 'manual', signal: AbortSignal.timeout(8000) });
  results.push({ route: 'http:/login', status: redirect.status, location: redirect.headers.get('location'), valid: redirect.status === 301 && redirect.headers.get('location') === domain + '/login' });
  if (!results.at(-1).valid) throw new Error('HTTP redirect mismatch');
  fs.writeFileSync(path.join(__dirname, '../deploy/verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  for (const item of results) console.log(`${item.status} ${item.route} VALID=${item.valid}`);
  console.log(`CHECKS=${results.length}\nPUBLIC_VERIFICATION_COMPLETE`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
