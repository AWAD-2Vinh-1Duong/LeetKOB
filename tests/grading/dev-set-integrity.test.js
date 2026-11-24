// Guards the AGENTS.md rule: the official dev set is never edited to make a check pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const DEV_SET = new URL('../../eval/dev-set/', import.meta.url);

/** @param {string} name */
async function sha256(name) {
  return createHash('sha256')
    .update(await readFile(new URL(name, DEV_SET)))
    .digest('hex');
}

test('eval.mjs matches the published SHA-256', async () => {
  assert.ok((await sha256('eval.mjs')).startsWith('c836edd8713521bb'));
});

test('labels.jsonl matches the published SHA-256', async () => {
  assert.ok((await sha256('labels.jsonl')).startsWith('262cda7b0ef5612e'));
});
