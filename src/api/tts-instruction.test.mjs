import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

test('createSpeech forwards trimmed instruction in JSON body', () => {
  const content = readFileSync(resolve(dir, 'tts.ts'), 'utf8');
  assert.match(content, /instruction\?: string/);
  assert.match(content, /body\.instruction = params\.instruction\.trim\(\)/);
});

test('voice tts executor passes instruction to createSpeech', () => {
  const content = readFileSync(
    resolve(dir, '../services/workbench-tasks/executors/voice-tts.ts'),
    'utf8',
  );
  assert.match(content, /instruction:\s*payload\.instruction/);
});
