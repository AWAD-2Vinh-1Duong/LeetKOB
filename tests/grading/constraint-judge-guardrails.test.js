// Tests for the first two model guardrails (PA#3 criterion 5), written before the code.
// Every test uses a fake model and no network: anything the model says that fails the
// schema, and any call that runs out of time, becomes `unsure`. The model never sets a deduction.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ConstraintJudge } from '../../src/modules/grading/service/constraint-judge.js';

const SOURCE = [
  '#include <iostream>',
  'int fact(int n) { return n <= 1 ? 1 : n * fact(n - 1); }',
  'int main() {',
  '  int n; std::cin >> n;',
  '  std::cout << fact(n) << "\\n";',
  '}',
].join('\n');

const CONSTRAINTS = [
  {
    id: 'C1',
    text: 'Compute the result with a recursive function you wrote yourself.',
  },
  {
    id: 'C2',
    text: 'Keep every intermediate value in a local variable, never a global one.',
  },
];

const INPUT = {
  statement: 'Print n! for 0 <= n <= 12.',
  constraints: CONSTRAINTS,
  source: SOURCE,
};

/** A fake model whose reply is fixed text. */
const replying = (/** @type {string} */ text) => ({
  name: 'fake-model',
  async complete() {
    return { text };
  },
});

const ok = (/** @type {unknown} */ body) => replying(JSON.stringify(body));

/**
 * @param {import('../../src/modules/grading/service/constraint-judge.js').JudgeModel} model
 * @param {number} [timeoutMs]
 */
const judge = (model, timeoutMs = 1000) =>
  new ConstraintJudge({ model, timeoutMs }).judge(INPUT);

/** @param {Array<Record<string, unknown>>} verdicts @param {string} id */
const byId = (verdicts, id) => verdicts.find((v) => v.constraintId === id);

/** @param {{ verdicts: Array<Record<string, unknown>> }} result */
function assertAllUnsure(result) {
  assert.deepEqual(result.verdicts.map((v) => v.constraintId).sort(), [
    'C1',
    'C2',
  ]);
  for (const v of result.verdicts) {
    assert.equal(v.verdict, 'unsure');
    assert.deepEqual(v.evidence, []);
    assert.equal(v.decidedBy, 'guardrail');
    assert.equal(typeof v.reason, 'string');
  }
}

// No test may reach the network: a real fetch would fail the run.
/** @type {typeof fetch} */
let realFetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('network call in a guardrail test');
  };
});
after(() => {
  globalThis.fetch = realFetch;
});

describe('a reply that passes the schema', () => {
  test('keeps the verdicts and takes evidence text from the original source line', async () => {
    const result = await judge(
      ok({
        verdicts: [
          { constraint: 'C1', verdict: 'pass', evidence: [] },
          {
            constraint: 'C2',
            verdict: 'violation',
            evidence: [{ line: 4, text: 'int n; std::cin >> n;' }],
          },
        ],
      }),
    );
    assert.deepEqual(byId(result.verdicts, 'C1'), {
      constraintId: 'C1',
      verdict: 'pass',
      evidence: [],
      decidedBy: 'model',
    });
    assert.deepEqual(byId(result.verdicts, 'C2'), {
      constraintId: 'C2',
      verdict: 'violation',
      evidence: [{ line: 4, text: 'int n; std::cin >> n;' }],
      decidedBy: 'model',
    });
  });

  test('accepts unsure from the model as it is', async () => {
    const result = await judge(
      ok({
        verdicts: [
          { constraint: 'C1', verdict: 'unsure', evidence: [] },
          { constraint: 'C2', verdict: 'pass', evidence: [] },
        ],
      }),
    );
    assert.equal(byId(result.verdicts, 'C1')?.verdict, 'unsure');
    assert.equal(byId(result.verdicts, 'C2')?.verdict, 'pass');
  });

  test('never returns a deduction', async () => {
    const result = await judge(
      ok({
        verdicts: [
          { constraint: 'C1', verdict: 'pass', evidence: [] },
          { constraint: 'C2', verdict: 'pass', evidence: [] },
        ],
      }),
    );
    for (const v of result.verdicts) assert.equal('deduction' in v, false);
  });
});

describe('schema guardrail: anything that fails becomes unsure', () => {
  /** @type {Array<[string, string]>} */
  const wholeReplyCases = [
    ['malformed JSON', '{"verdicts": [{"constraint": "C1", '],
    [
      'JSON wrapped in a markdown fence',
      '```json\n{"verdicts":[{"constraint":"C1","verdict":"pass","evidence":[]},{"constraint":"C2","verdict":"pass","evidence":[]}]}\n```',
    ],
    [
      'text around the JSON',
      'Here is my answer: {"verdicts":[{"constraint":"C1","verdict":"pass","evidence":[]},{"constraint":"C2","verdict":"pass","evidence":[]}]}',
    ],
    ['an empty reply', ''],
    ['a JSON array instead of an object', '[]'],
    ['an object without verdicts', '{"result":"pass"}'],
    [
      'a verdict outside pass, violation, unsure',
      JSON.stringify({
        verdicts: [
          { constraint: 'C1', verdict: 'fail', evidence: [] },
          { constraint: 'C2', verdict: 'pass', evidence: [] },
        ],
      }),
    ],
    [
      'an extra field that sets a deduction',
      JSON.stringify({
        verdicts: [
          {
            constraint: 'C1',
            verdict: 'violation',
            evidence: [{ line: 2, text: 'x' }],
            deduction: 3,
          },
          { constraint: 'C2', verdict: 'pass', evidence: [] },
        ],
      }),
    ],
    [
      'an extra top-level field',
      JSON.stringify({
        verdicts: [
          { constraint: 'C1', verdict: 'pass', evidence: [] },
          { constraint: 'C2', verdict: 'pass', evidence: [] },
        ],
        score: 10,
      }),
    ],
    [
      'evidence that is not { line, text }',
      JSON.stringify({
        verdicts: [
          { constraint: 'C1', verdict: 'violation', evidence: [2] },
          { constraint: 'C2', verdict: 'pass', evidence: [] },
        ],
      }),
    ],
    [
      'a constraint that was not asked for',
      JSON.stringify({
        verdicts: [
          { constraint: 'C1', verdict: 'pass', evidence: [] },
          { constraint: 'C2', verdict: 'pass', evidence: [] },
          {
            constraint: 'C9',
            verdict: 'violation',
            evidence: [{ line: 1, text: 'x' }],
          },
        ],
      }),
    ],
  ];
  for (const [name, text] of wholeReplyCases) {
    test(`${name} makes every constraint unsure`, async () => {
      assertAllUnsure(await judge(replying(text)));
    });
  }

  test('a missing constraint becomes unsure, the others are kept', async () => {
    const result = await judge(
      ok({ verdicts: [{ constraint: 'C1', verdict: 'pass', evidence: [] }] }),
    );
    assert.equal(byId(result.verdicts, 'C1')?.verdict, 'pass');
    const c2 = /** @type {Record<string, unknown>} */ (
      byId(result.verdicts, 'C2')
    );
    assert.equal(c2.verdict, 'unsure');
    assert.equal(c2.decidedBy, 'guardrail');
    assert.equal(typeof c2.reason, 'string');
  });

  test('a constraint answered twice becomes unsure', async () => {
    const result = await judge(
      ok({
        verdicts: [
          { constraint: 'C1', verdict: 'pass', evidence: [] },
          {
            constraint: 'C1',
            verdict: 'violation',
            evidence: [{ line: 2, text: 'x' }],
          },
          { constraint: 'C2', verdict: 'pass', evidence: [] },
        ],
      }),
    );
    assert.equal(byId(result.verdicts, 'C1')?.verdict, 'unsure');
    assert.equal(byId(result.verdicts, 'C2')?.verdict, 'pass');
    assert.equal(result.verdicts.length, 2);
  });

  test('a violation without evidence becomes unsure', async () => {
    const result = await judge(
      ok({
        verdicts: [
          { constraint: 'C1', verdict: 'violation', evidence: [] },
          { constraint: 'C2', verdict: 'pass', evidence: [] },
        ],
      }),
    );
    assert.equal(byId(result.verdicts, 'C1')?.verdict, 'unsure');
    assert.equal(byId(result.verdicts, 'C2')?.verdict, 'pass');
  });

  test('a violation citing a line the code does not have becomes unsure', async () => {
    const result = await judge(
      ok({
        verdicts: [
          {
            constraint: 'C1',
            verdict: 'violation',
            evidence: [{ line: 99, text: 'x' }],
          },
          { constraint: 'C2', verdict: 'pass', evidence: [] },
        ],
      }),
    );
    assert.equal(byId(result.verdicts, 'C1')?.verdict, 'unsure');
  });

  test('a model error (rate limit, network) makes every constraint unsure', async () => {
    const failing = {
      name: 'fake-model',
      async complete() {
        throw new Error('429 Resource exhausted');
      },
    };
    assertAllUnsure(await judge(failing));
  });
});

describe('timeout guardrail', () => {
  test('a model that never answers makes every constraint unsure, and the call is aborted', async () => {
    /** @type {AbortSignal | undefined} */
    let seen;
    const hanging = {
      name: 'fake-model',
      /** @param {{ prompt: string, signal: AbortSignal }} req */
      complete(req) {
        seen = req.signal;
        return new Promise(() => {});
      },
    };
    const started = Date.now();
    const result = await judge(hanging, 50);
    assert.ok(
      Date.now() - started < 1000,
      'judge waited far longer than its timeout',
    );
    assertAllUnsure(result);
    assert.equal(seen?.aborted, true);
  });

  test('a model that honours the abort signal also ends as unsure', async () => {
    const slow = {
      name: 'fake-model',
      /** @param {{ prompt: string, signal: AbortSignal }} req */
      complete(req) {
        return new Promise((_resolve, reject) => {
          req.signal.addEventListener('abort', () => reject(req.signal.reason));
        });
      },
    };
    assertAllUnsure(await judge(slow, 50));
  });

  test('a reply that arrives in time is used', async () => {
    const quick = {
      name: 'fake-model',
      async complete() {
        await new Promise((r) => setTimeout(r, 5));
        return {
          text: JSON.stringify({
            verdicts: [
              { constraint: 'C1', verdict: 'pass', evidence: [] },
              { constraint: 'C2', verdict: 'pass', evidence: [] },
            ],
          }),
        };
      },
    };
    const result = await judge(quick, 500);
    assert.equal(byId(result.verdicts, 'C1')?.decidedBy, 'model');
  });
});

describe('no call when there is nothing to judge', () => {
  test('an empty constraint list never calls the model', async () => {
    let calls = 0;
    const counting = {
      name: 'fake-model',
      async complete() {
        calls += 1;
        return { text: '{}' };
      },
    };
    const result = await new ConstraintJudge({
      model: counting,
      timeoutMs: 100,
    }).judge({
      ...INPUT,
      constraints: [],
    });
    assert.deepEqual(result.verdicts, []);
    assert.equal(calls, 0);
  });
});
