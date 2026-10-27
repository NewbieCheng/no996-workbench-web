import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

test('src/api/tts.ts defines SPEECH_REQUEST_TIMEOUT_MS as 600_000', () => {
  const content = readFileSync(resolve(dir, 'tts.ts'), 'utf8');
  assert.match(content, /export const SPEECH_REQUEST_TIMEOUT_MS = 600_000;/);
  assert.match(content, /timeout:\s*SPEECH_REQUEST_TIMEOUT_MS/);
});

test('src/api/errors.ts maps timeout errors to helpful prompt', () => {
  const content = readFileSync(resolve(dir, 'errors.ts'), 'utf8');
  assert.match(content, /timeout of \\d\+ms exceeded/);
  assert.match(content, /放宽至 10 分钟/);
  assert.match(content, /status === 504/);
});
