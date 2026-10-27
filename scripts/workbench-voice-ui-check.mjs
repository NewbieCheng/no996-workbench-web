/**
 * Login + list voices via 8897 proxy; optional voice id to assert.
 * Usage: node scripts/workbench-voice-ui-check.mjs [voiceId]
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const voiceIdWant = process.argv[2] || 'vc_c50449200c5e548f335eee97a664e1a2';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const loginScript = resolve(scriptDir, 'workbench-login-token.mjs');

const raw = execSync(`node "${loginScript}"`, { encoding: 'utf8' }).trim();
const login = JSON.parse(raw);
if (!login.ok) {
  console.log(`LOGIN_FAIL ${raw}`);
  process.exit(1);
}

const token = login.access_token;
const list = await fetch('http://127.0.0.1:8897/v1/audio/voices', {
  headers: { Authorization: `Bearer ${token}` },
});
const body = await list.json();
const rows = body?.data ?? [];
const hit = rows.find((v) => v.voice_id === voiceIdWant);
console.log(`EMITTED=1 voices_total=${rows.length}`);
if (hit) {
  console.log(
    `VOICE_FOUND id=${hit.voice_id} name=${hit.display_name} ready=${hit.ready_for_synthesis} status=${hit.provider_status}`,
  );
  console.log(`TOKEN_JSON=${JSON.stringify({ access: token, refresh: login.refresh_token })}`);
  process.exit(0);
}
console.log('VOICE_NOT_FOUND');
for (const v of rows.slice(0, 8)) {
  console.log(`- ${v.voice_id} ${v.display_name} ${v.provider_status}`);
}
process.exit(2);
