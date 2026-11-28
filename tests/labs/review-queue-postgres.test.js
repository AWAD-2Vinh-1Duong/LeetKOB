// docs/contract/review-queue.md (revision 1) on PostgreSQL: the queue reads stored verdicts,
// a TA decision is saved next to the proposal, a re-run of the job does not erase it, and the
// student still sees only the submission's status. Skipped without DATABASE_URL.
import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';
import { createWorkerContainer } from '../../src/container.js';
import { createPool } from '../../src/shared/db.js';

const SECRET = 'test-secret-not-a-real-one-0123456789';
const NOW = new Date('2026-11-27T10:00:00.000Z');
const hasDb = Boolean(process.env.DATABASE_URL);
const SOURCE =
  '#include <algorithm>\nint main() {\n  std::sort(a, a + 3);\n}\n';

/** @param {string} sub @param {string} role */
const token = (sub, role) =>
  new SignJWT({ sub, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));

describe('review queue (PostgreSQL)', { skip: !hasDb }, () => {
  /** @type {import('pg').Pool} */
  let pool;
  /** @type {import('express').Express} */
  let app;

  before(() => {
    pool = createPool(String(process.env.DATABASE_URL));
  });

  after(async () => {
    if (pool) await pool.end();
  });

  beforeEach(async () => {
    app = createApp({ jwtSecret: SECRET, pool, now: () => NOW });
    await pool.query(
      'TRUNCATE TABLE llm_call_logs, verdicts, judge_jobs, submissions, class_enrollments, class_staff, labs, classes, users CASCADE;',
    );
    await pool.query(`
      INSERT INTO users (id, email, password_hash, role) VALUES
        ('s-a', 's-a@t.local', 'hash', 'student'),
        ('ta-a', 'ta-a@t.local', 'hash', 'ta'),
        ('ta-b', 'ta-b@t.local', 'hash', 'ta');
      INSERT INTO classes (id, name) VALUES ('class-a', 'A'), ('class-b', 'B');
      INSERT INTO class_enrollments (class_id, student_id) VALUES ('class-a', 's-a');
      INSERT INTO class_staff (class_id, user_id) VALUES ('class-a', 'ta-a'), ('class-b', 'ta-b');
    `);
    await pool.query(
      `INSERT INTO labs (id, class_id, title, statement, tests, constraints, deadline)
       VALUES ('lab-a', 'class-a', 'Merge sort', 'Sort it.', '[]'::jsonb, $1::jsonb, '2026-12-31T00:00:00Z')`,
      [
        JSON.stringify([
          { id: 'c1', text: 'Do not call std::sort.', deduction: 3 },
          { id: 'c2', text: 'Write the merge step yourself.', deduction: 4 },
        ]),
      ],
    );
  });

  test('queue, decision, re-run and the student view', async () => {
    const studentAuth = `Bearer ${await token('s-a', 'student')}`;
    const taAuth = `Bearer ${await token('ta-a', 'ta')}`;
    const sub = await request(app)
      .post('/labs/lab-a/submissions')
      .set('Authorization', studentAuth)
      .set('Idempotency-Key', 'pg-review-1')
      .send({ language: 'cpp', source: SOURCE });
    assert.equal(sub.status, 202);

    const verdicts = [
      {
        constraintId: 'c1',
        verdict: /** @type {const} */ ('violation'),
        evidence: [{ line: 3, text: '  std::sort(a, a + 3);' }],
      },
      {
        constraintId: 'c2',
        verdict: /** @type {const} */ ('unsure'),
        evidence: [],
      },
    ];
    const { worker, judgeJobsRepository } = createWorkerContainer({
      pool,
      now: () => NOW,
      evaluator: async () => ({ verdicts }),
    });
    assert.equal((await worker.runOnce())?.outcome, 'completed');

    const queue = await request(app)
      .get('/labs/lab-a/review-queue')
      .set('Authorization', taAuth);
    assert.equal(queue.status, 200);
    assert.equal(queue.body.items.length, 2);
    const [c1, c2] = queue.body.items;
    assert.equal(c1.submissionId, sub.body.id);
    assert.equal(c1.studentId, 's-a');
    assert.equal(c1.source, SOURCE);
    assert.equal(c1.constraint, 'Do not call std::sort.');
    assert.equal(c1.deduction, 3);
    assert.deepEqual(c1.proposal, {
      verdict: 'violation',
      evidence: [{ line: 3, text: '  std::sort(a, a + 3);' }],
    });
    assert.equal(c1.decision, null);
    assert.equal(c2.deduction, 4);

    const decided = await request(app)
      .put(`/labs/lab-a/review-queue/${c2.id}`)
      .set('Authorization', taAuth)
      .send({ verdict: 'violation', evidenceLines: [3] });
    assert.equal(decided.status, 200, JSON.stringify(decided.body));
    assert.deepEqual(decided.body.decision, {
      verdict: 'violation',
      evidence: [{ line: 3, text: '  std::sort(a, a + 3);' }],
      deduction: 4,
      reviewedBy: 'ta-a',
      reviewedAt: NOW.toISOString(),
    });
    assert.deepEqual(decided.body.proposal, {
      verdict: 'unsure',
      evidence: [],
    });

    // The worker writing the same verdicts again must not erase the TA's decision.
    const [job] = await judgeJobsRepository.findJobsBySubmission(sub.body.id);
    await judgeJobsRepository.completeJob(job.id, sub.body.id, verdicts, NOW);
    const reread = await request(app)
      .get('/labs/lab-a/review-queue')
      .set('Authorization', taAuth);
    assert.deepEqual(reread.body.items[1], decided.body);

    // A TA of another class cannot reach the verdict.
    const other = await request(app)
      .put(`/labs/lab-a/review-queue/${c2.id}`)
      .set('Authorization', `Bearer ${await token('ta-b', 'ta')}`)
      .send({ verdict: 'pass' });
    assert.equal(other.status, 404);
    assert.equal(
      other.body.type,
      'https://leettkob.dev/problems/lab-not-found',
    );

    const seen = await request(app)
      .get(`/submissions/${sub.body.id}`)
      .set('Authorization', studentAuth);
    assert.equal(seen.status, 200);
    assert.deepEqual(Object.keys(seen.body).sort(), [
      'createdAt',
      'id',
      'labId',
      'language',
      'status',
      'studentId',
    ]);
    assert.equal(JSON.stringify(seen.body).includes('deduction'), false);
  });
});
