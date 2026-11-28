// Contract tests for docs/contract/review-queue.md (revision 1), written before the code.
// Verdicts land only in the TA's review queue; a TA decision is the only thing that can
// carry a deduction, and a student never sees a proposal, a decision or a deduction.
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';
import { createWorkerContainer } from '../../src/container.js';
import { InMemoryLabRepository } from '../../src/modules/labs/repository/labs.repository.memory.js';
import { InMemorySubmissionRepository } from '../../src/modules/submissions/repository/submissions.repository.memory.js';
import { InMemoryJudgeJobsRepository } from '../../src/modules/grading/repository/judge-jobs.repository.memory.js';

const SECRET = 'test-secret-not-a-real-one-0123456789';
const PROBLEM_BASE = 'https://leettkob.dev/problems/';
const NOW = new Date('2026-11-27T10:00:00.000Z');
const DEADLINE = new Date('2026-12-31T00:00:00.000Z');

const SOURCE = [
  '#include <algorithm>',
  'int main() {',
  '  int a[3] = {3, 1, 2};',
  '  std::sort(a, a + 3);',
  '',
  '  return 0;',
  '}',
].join('\n');

/** @param {string} sub @param {string} role */
const token = (sub, role) =>
  new SignJWT({ sub, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));

/**
 * @param {import('supertest').Response} res
 * @param {number} status
 * @param {string} slug
 */
function assertProblem(res, status, slug) {
  assert.equal(res.status, status, JSON.stringify(res.body));
  assert.match(res.headers['content-type'], /^application\/problem\+json/);
  assert.equal(res.body.type, PROBLEM_BASE + slug);
  assert.equal(res.body.status, status);
  assert.equal(typeof res.body.title, 'string');
  assert.equal(typeof res.body.detail, 'string');
  assert.equal(typeof res.body.instance, 'string');
}

/** @type {import('express').Express} */
let app;
/** @type {InMemoryJudgeJobsRepository} */
let judgeJobsRepository;

beforeEach(() => {
  const labRepository = new InMemoryLabRepository({
    labs: [
      {
        id: 'lab-a',
        classId: 'class-a',
        deadline: DEADLINE,
        title: 'Merge sort',
        statement: 'Sort the array with your own merge sort.',
        tests: [],
        constraints: [
          { id: 'c1', text: 'Do not call std::sort.', deduction: 3 },
          { id: 'c2', text: 'Write the merge step yourself.', deduction: 4 },
        ],
      },
      {
        id: 'lab-b',
        classId: 'class-b',
        deadline: DEADLINE,
        constraints: [{ id: 'c1', text: 'Use recursion.', deduction: 2 }],
      },
    ],
    enrollments: [
      { studentId: 's-a', classId: 'class-a' },
      { studentId: 's-b', classId: 'class-b' },
    ],
    staff: [
      { userId: 'ta-a', classId: 'class-a' },
      { userId: 'ta-b', classId: 'class-b' },
    ],
  });
  const submissionRepository = new InMemorySubmissionRepository();
  judgeJobsRepository = new InMemoryJudgeJobsRepository({
    submissionRepository,
    labRepository,
  });
  app = createApp({
    jwtSecret: SECRET,
    now: () => NOW,
    labRepository,
    submissionRepository,
    judgeJobsRepository,
  });
});

/**
 * A student submits, then one worker run judges it with fixed proposals.
 * @param {string} lab @param {string} student
 * @param {Array<{ constraintId: string, verdict: 'pass' | 'violation' | 'unsure', evidence: Array<{ line: number, text: string }> }>} verdicts
 */
async function submitAndJudge(lab, student, verdicts) {
  const res = await request(app)
    .post(`/labs/${lab}/submissions`)
    .set('Authorization', `Bearer ${await token(student, 'student')}`)
    .set('Idempotency-Key', `key-${lab}-${student}`)
    .send({ language: 'cpp', source: SOURCE });
  assert.equal(res.status, 202, JSON.stringify(res.body));
  const { worker } = createWorkerContainer({
    judgeJobsRepository,
    now: () => NOW,
    evaluator: async () => ({ verdicts }),
  });
  assert.equal((await worker.runOnce())?.outcome, 'completed');
  return String(res.body.id);
}

/** @param {string} lab @param {string} sub @param {string} [role] */
const getQueue = async (lab, sub, role = 'ta') =>
  request(app)
    .get(`/labs/${lab}/review-queue`)
    .set('Authorization', `Bearer ${await token(sub, role)}`);

/** @param {string} lab @param {string} verdictId @param {unknown} body @param {string} [sub] @param {string} [role] */
const decide = async (lab, verdictId, body, sub = 'ta-a', role = 'ta') =>
  request(app)
    .put(`/labs/${lab}/review-queue/${verdictId}`)
    .set('Authorization', `Bearer ${await token(sub, role)}`)
    .send(/** @type {object} */ (body));

/** @type {Array<{ constraintId: string, verdict: 'pass' | 'violation' | 'unsure', evidence: Array<{ line: number, text: string }> }>} */
const PROPOSALS = [
  {
    constraintId: 'c1',
    verdict: 'violation',
    evidence: [{ line: 4, text: '  std::sort(a, a + 3);' }],
  },
  { constraintId: 'c2', verdict: 'unsure', evidence: [] },
];

/** @returns {Promise<{ submissionId: string, items: any[] }>} */
async function judgedLab() {
  const submissionId = await submitAndJudge('lab-a', 's-a', [...PROPOSALS]);
  const res = await getQueue('lab-a', 'ta-a');
  assert.equal(res.status, 200);
  return { submissionId, items: res.body.items };
}

describe('GET /labs/:labId/review-queue', () => {
  test('lists every verdict with its proposal, evidence, constraint, deduction and source', async () => {
    const { submissionId, items } = await judgedLab();
    assert.equal(items.length, 2);
    const [c1, c2] = items;
    assert.equal(typeof c1.id, 'string');
    assert.deepEqual(
      { ...c1, id: undefined },
      {
        id: undefined,
        submissionId,
        studentId: 's-a',
        source: SOURCE,
        constraintId: 'c1',
        constraint: 'Do not call std::sort.',
        deduction: 3,
        proposal: {
          verdict: 'violation',
          evidence: [{ line: 4, text: '  std::sort(a, a + 3);' }],
        },
        decision: null,
      },
    );
    assert.equal(c2.constraintId, 'c2');
    assert.equal(c2.deduction, 4);
    assert.deepEqual(c2.proposal, { verdict: 'unsure', evidence: [] });
    assert.equal(c2.decision, null);
  });

  test("a lab's queue holds only its own submissions", async () => {
    await judgedLab();
    await submitAndJudge('lab-b', 's-b', [
      { constraintId: 'c1', verdict: 'pass', evidence: [] },
    ]);
    const b = await getQueue('lab-b', 'ta-b');
    assert.equal(b.body.items.length, 1);
    assert.equal(b.body.items[0].studentId, 's-b');
    assert.equal(b.body.items[0].deduction, 2);
  });

  test('an admin sees the queue, a TA of another class gets 404, a student 403', async () => {
    await judgedLab();
    assert.equal((await getQueue('lab-a', 'admin1', 'admin')).status, 200);
    assertProblem(await getQueue('lab-a', 'ta-b'), 404, 'lab-not-found');
    assertProblem(await getQueue('lab-a', 's-a', 'student'), 403, 'staff-only');
  });
});

describe('PUT /labs/:labId/review-queue/:verdictId', () => {
  test('a violation decision takes the lines from the source and the deduction from the constraint', async () => {
    const { items } = await judgedLab();
    const res = await decide('lab-a', items[1].id, {
      verdict: 'violation',
      evidenceLines: [4, 1, 4],
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.decision, {
      verdict: 'violation',
      evidence: [
        { line: 4, text: '  std::sort(a, a + 3);' },
        { line: 1, text: '#include <algorithm>' },
      ],
      deduction: 4,
      reviewedBy: 'ta-a',
      reviewedAt: NOW.toISOString(),
    });
    assert.deepEqual(res.body.proposal, { verdict: 'unsure', evidence: [] });

    const again = (await getQueue('lab-a', 'ta-a')).body.items[1];
    assert.deepEqual(again, res.body);
  });

  test('a pass decision gives deduction 0 and keeps the proposal', async () => {
    const { items } = await judgedLab();
    const res = await decide('lab-a', items[0].id, { verdict: 'pass' });
    assert.equal(res.status, 200);
    assert.equal(res.body.decision.verdict, 'pass');
    assert.deepEqual(res.body.decision.evidence, []);
    assert.equal(res.body.decision.deduction, 0);
    assert.equal(res.body.proposal.verdict, 'violation');
  });

  test('sending a decision again replaces the previous one', async () => {
    const { items } = await judgedLab();
    await decide('lab-a', items[0].id, { verdict: 'pass' });
    const res = await decide('lab-a', items[0].id, {
      verdict: 'violation',
      evidenceLines: [4],
    });
    assert.equal(res.body.decision.verdict, 'violation');
    assert.equal(res.body.decision.deduction, 3);
  });

  test('an admin may decide', async () => {
    const { items } = await judgedLab();
    const res = await decide(
      'lab-a',
      items[0].id,
      { verdict: 'pass' },
      'admin1',
      'admin',
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.decision.reviewedBy, 'admin1');
  });

  test('a bad body is 400 validation-error', async () => {
    const { items } = await judgedLab();
    const id = items[0].id;
    for (const body of [
      { verdict: 'violation' },
      { verdict: 'violation', evidenceLines: [] },
      { verdict: 'unsure' },
      { verdict: 'pass', evidenceLines: [4] },
      { verdict: 'pass', deduction: 10 },
      { verdict: 'violation', evidenceLines: [1.5] },
      {},
    ]) {
      assertProblem(await decide('lab-a', id, body), 400, 'validation-error');
    }
  });

  test('a line outside the source or a blank line is 422 evidence-not-in-source', async () => {
    const { items } = await judgedLab();
    for (const line of [0, 5, 8]) {
      assertProblem(
        await decide('lab-a', items[0].id, {
          verdict: 'violation',
          evidenceLines: [line],
        }),
        422,
        'evidence-not-in-source',
      );
    }
  });

  test('a verdict of another lab, or no verdict, is 404 verdict-not-found', async () => {
    const { items } = await judgedLab();
    await submitAndJudge('lab-b', 's-b', [
      { constraintId: 'c1', verdict: 'pass', evidence: [] },
    ]);
    const otherLabVerdict = (await getQueue('lab-b', 'ta-b')).body.items[0].id;
    // ta-b may open lab-b, but the verdict of lab-a is not in it.
    assertProblem(
      await decide('lab-b', items[0].id, { verdict: 'pass' }, 'ta-b'),
      404,
      'verdict-not-found',
    );
    assertProblem(
      await decide('lab-a', otherLabVerdict, { verdict: 'pass' }),
      404,
      'verdict-not-found',
    );
    assertProblem(
      await decide('lab-a', 'no-such-verdict', { verdict: 'pass' }),
      404,
      'verdict-not-found',
    );
  });

  test('access: 401 without a token, 404 for a TA of another class, 403 for a student', async () => {
    const { items } = await judgedLab();
    const res = await request(app)
      .put(`/labs/lab-a/review-queue/${items[0].id}`)
      .send({ verdict: 'pass' });
    assertProblem(res, 401, 'unauthenticated');
    assertProblem(
      await decide('lab-a', items[0].id, { verdict: 'pass' }, 'ta-b'),
      404,
      'lab-not-found',
    );
    // The role check comes before the body: a student with a bad body still gets 403.
    assertProblem(
      await decide('lab-a', items[0].id, { verdict: 'nope' }, 's-a', 'student'),
      403,
      'staff-only',
    );
  });
});

describe('the human gate: a student never sees a verdict or a deduction', () => {
  test('before and after the TA decides, the submission shows only its status', async () => {
    const { submissionId, items } = await judgedLab();
    const studentAuth = `Bearer ${await token('s-a', 'student')}`;
    /** @returns {Promise<import('supertest').Response>} */
    const asStudent = () =>
      request(app)
        .get(`/submissions/${submissionId}`)
        .set('Authorization', studentAuth);

    const before = await asStudent();
    assert.equal(before.status, 200);
    assert.deepEqual(Object.keys(before.body).sort(), [
      'createdAt',
      'id',
      'labId',
      'language',
      'status',
      'studentId',
    ]);
    assert.equal(before.body.status, 'judged');

    const decided = await decide('lab-a', items[0].id, {
      verdict: 'violation',
      evidenceLines: [4],
    });
    assert.equal(decided.body.decision.deduction, 3);

    const after = await asStudent();
    assert.deepEqual(after.body, before.body);
    const text = JSON.stringify(after.body);
    for (const word of ['violation', 'deduction', 'evidence', 'std::sort']) {
      assert.equal(text.includes(word), false, word);
    }
  });
});
