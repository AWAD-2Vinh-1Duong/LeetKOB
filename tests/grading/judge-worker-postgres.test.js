// PostgreSQL tests for T05: atomic job enqueue, FOR UPDATE SKIP LOCKED, and Law Q1.
import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';
import { createWorkerContainer } from '../../src/container.js';
import { createPool } from '../../src/shared/db.js';

const SECRET = 'test-secret-not-a-real-one-0123456789';
const NOW = new Date('2026-11-26T10:00:00.000Z');
const hasDb = Boolean(process.env.DATABASE_URL);

/** @param {Record<string, unknown>} claims */
function token(claims) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

/** @param {() => Promise<boolean>} cond @param {number} [timeoutMs] */
async function waitUntil(cond, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error('Timed out waiting for condition');
}

describe(
  'Judge job queue & isolated worker (PostgreSQL, Law Q1)',
  { skip: !hasDb },
  () => {
    /** @type {import('pg').Pool} */
    let pool;
    /** @type {import('express').Express} */
    let app;

    before(() => {
      if (!hasDb) return;
      pool = createPool(process.env.DATABASE_URL);
    });

    after(async () => {
      if (pool) await pool.end();
    });

    beforeEach(async () => {
      app = createApp({
        jwtSecret: SECRET,
        pool,
        now: () => NOW,
      });

      await pool.query(
        'TRUNCATE TABLE llm_call_logs, verdicts, judge_jobs, submissions, class_enrollments, class_staff, labs, classes, users CASCADE;',
      );

      await pool.query(`
        INSERT INTO users (id, email, password_hash, role) VALUES
        ('s1', 's1@student.hcmus.edu.vn', 'hash', 'student');
      `);
      await pool.query(`
        INSERT INTO classes (id, name) VALUES ('c1', 'CS101');
      `);
      await pool.query(`
        INSERT INTO class_enrollments (class_id, student_id) VALUES ('c1', 's1');
      `);
      await pool.query(
        `INSERT INTO labs (id, class_id, title, statement, tests, constraints, deadline)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
        [
          'lab-sort',
          'c1',
          'Merge Sort',
          'Implement merge sort without std::sort.',
          JSON.stringify([{ input: '2\n2 1\n', expectedOutput: '1 2\n' }]),
          JSON.stringify([
            { id: 'c1', text: 'Do not use `std::sort`', deduction: 50 },
            { id: 'c2', text: 'Must run in O(n log n) time', deduction: 50 },
          ]),
          '2026-12-01T00:00:00.000Z',
        ],
      );
    });

    test('Law Q1 on PostgreSQL: stop worker -> submit -> start worker -> 1 unique set of verdicts', async () => {
      let judgeCalls = 0;
      const { worker, judgeJobsRepository } = createWorkerContainer({
        pool,
        pollIntervalMs: 20,
        now: () => NOW,
        judge: {
          async judge({ constraints }) {
            judgeCalls += 1;
            return {
              verdicts: constraints.map((c) => ({
                constraintId: c.id,
                verdict: 'pass',
                evidence: [],
                decidedBy: 'model',
              })),
              call: {
                model: 'fake-model',
                prompt: 'p',
                response: '{}',
                outcome: 'ok',
                latencyMs: 5,
                requestId: 'req-q1',
                inputTokens: 10,
                outputTokens: 5,
                costUsd: 0,
              },
            };
          },
        },
      });

      // 1. Worker stopped.
      await worker.stop();

      // 2. Submit via HTTP API (202 Accepted) + idempotent retry.
      const auth = `Bearer ${await token({ sub: 's1', role: 'student' })}`;
      const payload = {
        language: 'cpp',
        source:
          '#include <algorithm>\nint main(){ int a[2]; std::sort(a, a+2); }\n',
      };
      const res1 = await request(app)
        .post('/labs/lab-sort/submissions')
        .set('Authorization', auth)
        .set('Idempotency-Key', 'pg-q1-key')
        .send(payload);
      assert.equal(res1.status, 202);
      assert.equal(res1.body.status, 'queued');
      const submissionId = res1.body.id;

      const res2 = await request(app)
        .post('/labs/lab-sort/submissions')
        .set('Authorization', auth)
        .set('Idempotency-Key', 'pg-q1-key')
        .send(payload);
      assert.equal(res2.status, 202);
      assert.equal(res2.body.id, submissionId);

      // Verify exactly 1 queued job in judge_jobs table.
      const jobsBefore =
        await judgeJobsRepository.findJobsBySubmission(submissionId);
      assert.equal(jobsBefore.length, 1);
      assert.equal(jobsBefore[0].status, 'queued');

      // 3. Start worker -> processes job once.
      worker.start();
      await waitUntil(async () => {
        const jobs =
          await judgeJobsRepository.findJobsBySubmission(submissionId);
        return jobs[0]?.status === 'completed';
      });

      // 4. Restart worker -> must NOT create duplicate verdicts.
      await worker.stop();
      worker.start();
      await new Promise((r) => setTimeout(r, 50));
      await worker.stop();

      assert.equal(judgeCalls, 1);

      const subRow = await pool.query(
        'SELECT status FROM submissions WHERE id = $1',
        [submissionId],
      );
      assert.equal(subRow.rows[0].status, 'judged');

      const verdicts =
        await judgeJobsRepository.findVerdictsBySubmission(submissionId);
      assert.equal(verdicts.length, 2);
      assert.equal(verdicts[0].constraintId, 'c1');
      assert.equal(verdicts[0].verdict, 'violation');
      assert.equal(verdicts[1].constraintId, 'c2');
      assert.equal(verdicts[1].verdict, 'pass');
      for (const v of verdicts) {
        assert.equal(v.isReviewed, false);
        assert.equal(v.deduction, 0);
      }

      // 5. Even if completeJob is called again (crash-recovery replay), verdicts stay unique.
      await judgeJobsRepository.completeJob(
        jobsBefore[0].id,
        submissionId,
        [
          { constraintId: 'c1', verdict: 'violation', evidence: [] },
          { constraintId: 'c2', verdict: 'pass', evidence: [] },
        ],
        NOW,
      );
      const verdictsAfterReplay =
        await judgeJobsRepository.findVerdictsBySubmission(submissionId);
      assert.equal(verdictsAfterReplay.length, 2);
    });

    test('FOR UPDATE SKIP LOCKED: two concurrent workers claiming 1 queued job only grant it to one', async () => {
      const auth = `Bearer ${await token({ sub: 's1', role: 'student' })}`;
      const res = await request(app)
        .post('/labs/lab-sort/submissions')
        .set('Authorization', auth)
        .set('Idempotency-Key', 'pg-skip-locked-key')
        .send({ language: 'cpp', source: 'int main() { return 0; }\n' });
      assert.equal(res.status, 202);

      const { judgeJobsRepository: repoA } = createWorkerContainer({ pool });
      const { judgeJobsRepository: repoB } = createWorkerContainer({ pool });

      const [jobA, jobB] = await Promise.all([
        repoA.claimNext('worker-A', NOW),
        repoB.claimNext('worker-B', NOW),
      ]);

      const claimed = [jobA, jobB].filter(Boolean);
      assert.equal(claimed.length, 1);
      assert.equal(claimed[0]?.status, 'running');
      assert.equal(claimed[0]?.attempts, 1);
    });
  },
);
