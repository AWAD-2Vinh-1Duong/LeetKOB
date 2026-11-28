// Tests for the checker command (T18), written before the code. The command takes a dataset
// folder (problems/<id>/statement.md, constraints.json; solutions/<id>/<sNN>.cpp) and writes
// one prediction line per (solution, constraint). With MODEL_OFF=1 it runs the hard rules only,
// writes `unsure` for every semantic constraint and opens no network connection.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDataset } from '../../src/modules/grading/service/check-dataset.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CHECKER = join(ROOT, 'src/checker.js');
const DEV_SET = join(ROOT, 'eval/dev-set');

/**
 * @param {string} file
 * @param {string[]} args
 * @param {Record<string, string>} env
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function run(file, args, env) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [file, ...args],
      {
        env: { PATH: process.env.PATH ?? '', ...env },
        maxBuffer: 16 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
        resolve({ code, stdout, stderr });
      },
    );
  });
}

/** @type {string} */
let data;

before(async () => {
  data = await mkdtemp(join(tmpdir(), 'leetkob-checker-'));
  await mkdir(join(data, 'problems/sum-up'), { recursive: true });
  await mkdir(join(data, 'solutions/sum-up'), { recursive: true });
  await writeFile(
    join(data, 'problems/sum-up/statement.md'),
    'Print the sum of n integers.\n',
  );
  await writeFile(
    join(data, 'problems/sum-up/constraints.json'),
    JSON.stringify([
      {
        id: 'C1',
        text: 'Do not call a library function: `std::accumulate`.',
        deduction: 2,
      },
      {
        id: 'C2',
        text: 'Add the numbers with a loop you wrote yourself.',
        deduction: 3,
      },
    ]),
  );
  await writeFile(
    join(data, 'solutions/sum-up/s01.cpp'),
    [
      '#include <numeric>',
      '#include <vector>',
      'int total(const std::vector<int>& v) {',
      '    return std::accumulate(v.begin(), v.end(), 0);',
      '}',
    ].join('\n'),
  );
  await writeFile(
    join(data, 'solutions/sum-up/s02.cpp'),
    [
      '// a comment that says std::accumulate is banned',
      'int total(int* a, int n) { int s = 0; for (int i = 0; i < n; i++) s += a[i]; return s; }',
    ].join('\n'),
  );
});

after(async () => {
  await rm(data, { recursive: true, force: true });
});

describe('checkDataset with the model off', () => {
  /** @type {typeof fetch} */
  let realFetch;
  before(() => {
    realFetch = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error('network call with the model off');
    };
  });
  after(() => {
    globalThis.fetch = realFetch;
  });

  test('writes one line per (solution, constraint), in a stable order', async () => {
    const { predictions } = await checkDataset(data, { judge: null });
    assert.deepEqual(
      predictions.map((p) => `${p.solution} ${p.constraint}`),
      ['sum-up/s01 C1', 'sum-up/s01 C2', 'sum-up/s02 C1', 'sum-up/s02 C2'],
    );
  });

  test('a ban-list constraint is decided by the hard rules, with the original line as evidence', async () => {
    const { predictions } = await checkDataset(data, { judge: null });
    assert.deepEqual(predictions[0], {
      solution: 'sum-up/s01',
      constraint: 'C1',
      verdict: 'violation',
      evidence: [
        { line: 4, text: 'return std::accumulate(v.begin(), v.end(), 0);' },
      ],
    });
    assert.deepEqual(predictions[2], {
      solution: 'sum-up/s02',
      constraint: 'C1',
      verdict: 'pass',
      evidence: [],
    });
  });

  test('every semantic constraint is unsure and nothing is logged as a model call', async () => {
    const { predictions, calls } = await checkDataset(data, { judge: null });
    for (const p of predictions.filter((x) => x.constraint === 'C2')) {
      assert.equal(p.verdict, 'unsure');
      assert.deepEqual(p.evidence, []);
    }
    assert.deepEqual(calls, []);
  });

  test('prediction lines carry no deduction and only the four eval fields', async () => {
    const { predictions } = await checkDataset(data, { judge: null });
    for (const p of predictions) {
      assert.deepEqual(Object.keys(p).sort(), [
        'constraint',
        'evidence',
        'solution',
        'verdict',
      ]);
    }
  });
});

describe('checkDataset with a judge', () => {
  test('sends only the semantic constraints to the judge and keeps its verdicts', async () => {
    /** @type {Array<{ constraints: Array<{ id: string }> }>} */
    const asked = [];
    const judge = {
      /** @param {{ statement: string, constraints: Array<{ id: string, text: string }>, source: string }} input */
      async judge(input) {
        asked.push(input);
        return {
          verdicts: input.constraints.map((c) => ({
            constraintId: c.id,
            verdict: /** @type {const} */ ('pass'),
            evidence: [],
            decidedBy: /** @type {const} */ ('model'),
          })),
          call: {
            model: 'fake-model',
            prompt: 'p',
            response: 'r',
            outcome: /** @type {const} */ ('ok'),
            latencyMs: 1,
            requestId: 'req-1',
            inputTokens: 10,
            outputTokens: 5,
            costUsd: 0,
          },
        };
      },
    };
    const { predictions, calls } = await checkDataset(data, { judge });
    assert.equal(asked.length, 2);
    for (const input of asked)
      assert.deepEqual(
        input.constraints.map((c) => c.id),
        ['C2'],
      );
    assert.equal(predictions[1].verdict, 'pass');
    assert.equal(predictions[0].verdict, 'violation');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].solution, 'sum-up/s01');
    assert.equal(calls[0].requestId, 'req-1');
  });
});

describe('the checker command', () => {
  test('MODEL_OFF=1 writes valid JSONL to stdout and exits 0', async () => {
    const { code, stdout } = await run(CHECKER, ['--data', data], {
      MODEL_OFF: '1',
    });
    assert.equal(code, 0);
    const rows = stdout
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    assert.equal(rows.length, 4);
  });

  test('--out writes the prediction file', async () => {
    const out = join(data, 'predictions.jsonl');
    const { code } = await run(CHECKER, ['--data', data, '--out', out], {
      MODEL_OFF: '1',
    });
    assert.equal(code, 0);
    assert.equal((await readFile(out, 'utf8')).trim().split('\n').length, 4);
  });

  test('a missing --data exits non-zero with a usage message', async () => {
    const { code, stderr } = await run(CHECKER, [], { MODEL_OFF: '1' });
    assert.notEqual(code, 0);
    assert.match(stderr, /--data/);
  });

  test('on the dev set with the model off, eval.mjs accepts the file and finds 0 wrongful deductions', async () => {
    const out = join(data, 'dev-predictions.jsonl');
    const summary = join(data, 'dev-summary.json');
    const checked = await run(CHECKER, ['--data', DEV_SET, '--out', out], {
      MODEL_OFF: '1',
    });
    assert.equal(checked.code, 0, checked.stderr);
    const scored = await run(
      join(DEV_SET, 'eval.mjs'),
      ['--data', DEV_SET, '--predictions', out, '--json', summary],
      {},
    );
    assert.ok(
      scored.code === 0 || scored.code === 1,
      `eval.mjs exited ${scored.code}: ${scored.stdout}`,
    );
    const s = JSON.parse(await readFile(summary, 'utf8'));
    assert.equal(s.wrongful, 0);
  });
});
