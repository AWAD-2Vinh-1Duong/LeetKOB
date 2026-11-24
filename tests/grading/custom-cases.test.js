// Our own eval cases (T17) in eval/custom-cases, in the dev-set layout. These tests keep the
// folder usable by eval.mjs: every (solution, constraint) pair labelled once, at least five
// tagged solutions with a trap and an injection, and no wrongful deduction with the model off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDataset } from '../../src/modules/grading/service/check-dataset.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CUSTOM = join(ROOT, 'eval/custom-cases');
const EVAL = join(ROOT, 'eval/dev-set/eval.mjs');

/** @returns {Promise<Array<{ solution: string, constraint: string, label: string, evidence: number[], tags: string[] }>>} */
async function labels() {
  const text = await readFile(join(CUSTOM, 'labels.jsonl'), 'utf8');
  return text
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
}

test('every (solution, constraint) pair has exactly one label', async () => {
  const rows = await labels();
  /** @type {string[]} */
  const expected = [];
  for (const problem of (await readdir(join(CUSTOM, 'problems'))).sort()) {
    /** @type {Array<{ id: string }>} */
    const constraints = JSON.parse(
      await readFile(
        join(CUSTOM, 'problems', problem, 'constraints.json'),
        'utf8',
      ),
    );
    const files = (await readdir(join(CUSTOM, 'solutions', problem))).filter(
      (f) => f.endsWith('.cpp'),
    );
    for (const f of files.sort()) {
      for (const c of constraints)
        expected.push(`${problem}/${f.slice(0, -4)} ${c.id}`);
    }
  }
  assert.deepEqual(
    rows.map((r) => `${r.solution} ${r.constraint}`).sort(),
    expected.sort(),
  );
});

test('at least five tagged solutions, with a trap and an injection', async () => {
  const rows = await labels();
  const tagged = new Set(
    rows.filter((r) => r.tags.length > 0).map((r) => r.solution),
  );
  assert.ok(tagged.size >= 5, `only ${tagged.size} tagged solutions`);
  const tags = new Set(rows.flatMap((r) => r.tags));
  assert.ok(tags.has('trap'));
  assert.ok(tags.has('injection'));
});

test('a violation label points at lines that exist in its solution', async () => {
  for (const r of (await labels()).filter((x) => x.label === 'violation')) {
    const src = await readFile(
      join(CUSTOM, 'solutions', `${r.solution}.cpp`),
      'utf8',
    );
    const lines = src.split('\n');
    assert.ok(
      r.evidence.length > 0,
      `${r.solution} ${r.constraint} has no evidence`,
    );
    for (const n of r.evidence)
      assert.ok((lines[n - 1] ?? '').trim() !== '', `${r.solution}:${n}`);
  }
});

test('eval.mjs accepts the folder and the model-off checker makes no wrongful deduction', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'leetkob-custom-'));
  try {
    const { predictions } = await checkDataset(CUSTOM, { judge: null });
    const preds = join(dir, 'p.jsonl');
    const summary = join(dir, 's.json');
    await writeFile(
      preds,
      predictions.map((p) => JSON.stringify(p)).join('\n') + '\n',
    );
    const code = await new Promise((resolve) => {
      execFile(
        process.execPath,
        [EVAL, '--data', CUSTOM, '--predictions', preds, '--json', summary],
        (err) => resolve(err ? err.code : 0),
      );
    });
    assert.ok(code === 0 || code === 1, `eval.mjs exited ${code}`);
    assert.equal(JSON.parse(await readFile(summary, 'utf8')).wrongful, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
