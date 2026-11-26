// Tests for T05: Job queue, isolated worker lifecycle, and Law Q1 (idempotent verdicts).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';
import { createWorkerContainer } from '../../src/container.js';
import { InMemoryLabRepository } from '../../src/modules/labs/repository/labs.repository.memory.js';
import { InMemorySubmissionRepository } from '../../src/modules/submissions/repository/submissions.repository.memory.js';
import { InMemoryJudgeJobsRepository } from '../../src/modules/grading/repository/judge-jobs.repository.memory.js';

const SECRET = 'test-secret-not-a-real-one-0123456789';
const NOW = new Date('2026-11-26T10:00:00.000Z');
const DEADLINE = new Date('2026-12-01T00:00:00.000Z');

/** @param {Record<string, unknown>} claims */
function token(claims) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

function buildFixture() {
  const labRepository = new InMemoryLabRepository({
    labs: [
      {
        id: 'lab-sort',
        classId: 'c1',
        deadline: DEADLINE,
        title: 'Merge sort',
        statement: 'Implement merge sort without std::sort.',
        constraints: [
          { id: 'c1', text: 'Do not use `std::sort`', deduction: 50 },
          { id: 'c2', text: 'Must run in O(n log n) time', deduction: 50 },
        ],
      },
    ],
    enrollments: [{ classId: 'c1', studentId: 's1' }],
  });
  const submissionRepository = new InMemorySubmissionRepository();
  const judgeJobsRepository = new InMemoryJudgeJobsRepository({
    submissionRepository,
    labRepository,
    usersById: new Map([
      ['s1', { id: 's1', email: 's1@student.hcmus.edu.vn' }],
    ]),
  });
  const app = createApp({
    jwtSecret: SECRET,
    labRepository,
    submissionRepository,
    judgeJobsRepository,
    now: () => NOW,
  });
  return { app, labRepository, submissionRepository, judgeJobsRepository };
}

/** @param {() => Promise<boolean>} cond @param {number} [timeoutMs] */
async function waitUntil(cond, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('Timed out waiting for condition');
}

describe('Judge job queue & isolated worker (In-Memory, Law Q1)', () => {
  test('POST /labs/:labId/submissions enqueues 1 job and idempotent retry does not duplicate it', async () => {
    const { app, judgeJobsRepository } = buildFixture();
    const auth = `Bearer ${await token({ sub: 's1', role: 'student' })}`;
    const body = {
      language: 'cpp',
      source:
        '#include <algorithm>\nint main(){ int a[2]; std::sort(a, a+2); }\n',
    };

    const res1 = await request(app)
      .post('/labs/lab-sort/submissions')
      .set('Authorization', auth)
      .set('Idempotency-Key', 'idem-q1-1')
      .send(body);
    assert.equal(res1.status, 202);
    assert.equal(res1.body.status, 'queued');

    const res2 = await request(app)
      .post('/labs/lab-sort/submissions')
      .set('Authorization', auth)
      .set('Idempotency-Key', 'idem-q1-1')
      .send(body);
    assert.equal(res2.status, 202);
    assert.equal(res2.body.id, res1.body.id);

    const jobs = await judgeJobsRepository.findJobsBySubmission(res1.body.id);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].status, 'queued');
  });

  test('Law Q1: stop worker -> submit -> start worker -> graded once with 1 unique set of unreviewed verdicts', async () => {
    const { app, submissionRepository, judgeJobsRepository } = buildFixture();
    let evaluateCalls = 0;

    const { worker } = createWorkerContainer({
      judgeJobsRepository,
      pollIntervalMs: 15,
      now: () => NOW,
      judge: {
        async judge({ constraints }) {
          evaluateCalls += 1;
          return {
            verdicts: constraints.map((c) => ({
              constraintId: c.id,
              verdict: 'pass',
              evidence: [],
              decidedBy: 'model',
            })),
            call: null,
          };
        },
      },
    });

    // 1. Worker is stopped before submission arrives.
    await worker.stop();

    const auth = `Bearer ${await token({ sub: 's1', role: 'student' })}`;
    const res = await request(app)
      .post('/labs/lab-sort/submissions')
      .set('Authorization', auth)
      .set('Idempotency-Key', 'idem-q1-stop-start')
      .send({
        language: 'cpp',
        source:
          '#include <algorithm>\nint main(){ int a[2]; std::sort(a, a+2); }\n',
      });
    assert.equal(res.status, 202);
    const submissionId = res.body.id;

    // Submission stays queued while worker is stopped.
    const jobsBefore =
      await judgeJobsRepository.findJobsBySubmission(submissionId);
    assert.equal(jobsBefore.length, 1);
    assert.equal(jobsBefore[0].status, 'queued');
    assert.equal(evaluateCalls, 0);

    // 2. Start worker and wait for completion.
    worker.start();
    await waitUntil(async () => {
      const jobs = await judgeJobsRepository.findJobsBySubmission(submissionId);
      return jobs[0]?.status === 'completed';
    });

    // 3. Stop and restart worker again: must NOT re-grade or duplicate verdicts.
    await worker.stop();
    worker.start();
    await new Promise((r) => setTimeout(r, 40));
    await worker.stop();

    assert.equal(evaluateCalls, 1);
    const sub = await submissionRepository.findById(submissionId);
    assert.equal(sub?.status, 'judged');

    const verdicts =
      await judgeJobsRepository.findVerdictsBySubmission(submissionId);
    assert.equal(verdicts.length, 2);

    const byConstraint = new Map(verdicts.map((v) => [v.constraintId, v]));
    assert.equal(byConstraint.get('c1')?.verdict, 'violation');
    assert.equal(byConstraint.get('c2')?.verdict, 'pass');
    // Zero-Tolerance Human Gate: never reviewed, deduction stays 0 until TA review.
    for (const v of verdicts) {
      assert.equal(v.isReviewed, false);
      assert.equal(v.deduction, 0);
    }
  });

  test('saving verdicts twice for the same submission is idempotent (no duplicate verdicts)', async () => {
    const { app, judgeJobsRepository } = buildFixture();
    const auth = `Bearer ${await token({ sub: 's1', role: 'student' })}`;
    const res = await request(app)
      .post('/labs/lab-sort/submissions')
      .set('Authorization', auth)
      .set('Idempotency-Key', 'idem-q1-dup-save')
      .send({ language: 'cpp', source: 'int main() { return 0; }\n' });

    const submissionId = res.body.id;
    const jobs = await judgeJobsRepository.findJobsBySubmission(submissionId);
    const jobId = jobs[0].id;

    const verdictsInput = [
      {
        constraintId: 'c1',
        verdict: /** @type {const} */ ('pass'),
        evidence: [],
      },
      {
        constraintId: 'c2',
        verdict: /** @type {const} */ ('unsure'),
        evidence: [],
      },
    ];
    await judgeJobsRepository.completeJob(
      jobId,
      submissionId,
      verdictsInput,
      NOW,
    );
    await judgeJobsRepository.completeJob(
      jobId,
      submissionId,
      verdictsInput,
      NOW,
    );

    const stored =
      await judgeJobsRepository.findVerdictsBySubmission(submissionId);
    assert.equal(stored.length, 2);
  });

  test('two workers claiming concurrently never claim the same job twice', async () => {
    const { app, judgeJobsRepository } = buildFixture();
    const auth = `Bearer ${await token({ sub: 's1', role: 'student' })}`;
    await request(app)
      .post('/labs/lab-sort/submissions')
      .set('Authorization', auth)
      .set('Idempotency-Key', 'idem-q1-concurrent')
      .send({ language: 'cpp', source: 'int main() { return 0; }\n' });

    const [claimA, claimB] = await Promise.all([
      judgeJobsRepository.claimNext('worker-A', NOW),
      judgeJobsRepository.claimNext('worker-B', NOW),
    ]);
    const claimed = [claimA, claimB].filter(Boolean);
    assert.equal(claimed.length, 1);
  });

  test('transient evaluation error re-queues job up to maxAttempts then marks failed', async () => {
    const { app, submissionRepository, judgeJobsRepository } = buildFixture();
    const auth = `Bearer ${await token({ sub: 's1', role: 'student' })}`;
    const res = await request(app)
      .post('/labs/lab-sort/submissions')
      .set('Authorization', auth)
      .set('Idempotency-Key', 'idem-q1-retry')
      .send({ language: 'cpp', source: 'int main() { return 0; }\n' });
    const submissionId = res.body.id;

    const { worker } = createWorkerContainer({
      judgeJobsRepository,
      now: () => NOW,
      evaluator: async () => {
        throw new Error('simulated transient crash');
      },
    });

    // Attempt 1 -> re-queued
    const r1 = await worker.runOnce();
    assert.equal(r1?.outcome, 'failed');
    let jobs = await judgeJobsRepository.findJobsBySubmission(submissionId);
    assert.equal(jobs[0].status, 'queued');
    assert.equal(jobs[0].attempts, 1);

    // Attempt 2 -> re-queued
    const r2 = await worker.runOnce();
    assert.equal(r2?.outcome, 'failed');
    jobs = await judgeJobsRepository.findJobsBySubmission(submissionId);
    assert.equal(jobs[0].status, 'queued');
    assert.equal(jobs[0].attempts, 2);

    // Attempt 3 (maxAttempts=3) -> permanently failed
    const r3 = await worker.runOnce();
    assert.equal(r3?.outcome, 'failed');
    jobs = await judgeJobsRepository.findJobsBySubmission(submissionId);
    assert.equal(jobs[0].status, 'failed');
    assert.equal(jobs[0].attempts, 3);
    assert.equal(
      (await submissionRepository.findById(submissionId))?.status,
      'failed',
    );

    // No longer claimable
    assert.equal(await worker.runOnce(), null);
  });
});
