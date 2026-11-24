// Contract tests for docs/contract/post-labs-submissions.md on PostgreSQL.
import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';
import { createPool } from '../../src/shared/db.js';

const SECRET = 'test-secret-not-a-real-one-0123456789';
const PROBLEM_BASE = 'https://leettkob.dev/problems/';
const START = new Date('2026-11-01T10:00:00.000Z');

const hasDb = Boolean(process.env.DATABASE_URL);

/** @param {Record<string, unknown>} claims @param {{ secret?: string, exp?: string | number }} [opts] */
function token(claims, opts = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(opts.exp ?? '1h')
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

const BODY = { language: 'cpp', source: 'int main() { return 0; }\n' };

/**
 * @param {import('express').Express} app
 * @param {{ lab?: string, sub?: string, role?: string, key?: string | null, body?: unknown, auth?: string | null }} [o]
 */
async function submit(app, o = {}) {
  let req = request(app).post(`/labs/${o.lab ?? 'lab-open'}/submissions`);
  const auth =
    o.auth !== undefined
      ? o.auth
      : `Bearer ${await token({ sub: o.sub ?? 's1', role: o.role ?? 'student' })}`;
  if (auth !== null) req = req.set('Authorization', auth);
  const key = o.key === undefined ? 'key-1' : o.key;
  if (key !== null) req = req.set('Idempotency-Key', key);
  return req.send(/** @type {object} */ (o.body ?? BODY));
}

/**
 * @param {import('supertest').Response} res
 * @param {number} status
 * @param {string} slug
 * @param {string} title
 */
function assertProblem(res, status, slug, title) {
  assert.equal(res.status, status);
  assert.match(res.headers['content-type'], /^application\/problem\+json/);
  assert.equal(res.body.type, PROBLEM_BASE + slug);
  assert.equal(res.body.title, title);
  assert.equal(res.body.status, status);
  assert.equal(typeof res.body.detail, 'string');
  assert.match(res.body.instance, /^\/labs\/[^/]+\/submissions$/);
}

describe(
  'POST /labs/:labId/submissions (PostgreSQL implementation)',
  { skip: !hasDb },
  () => {
    /** @type {import('pg').Pool} */
    let pool;
    /** @type {Date} */
    let now;
    /** @type {import('express').Express} */
    let app;

    before(async () => {
      if (!hasDb) return;
      pool = createPool(process.env.DATABASE_URL);
    });

    after(async () => {
      if (pool) {
        await pool.end();
      }
    });

    beforeEach(async () => {
      now = START;
      app = createApp({
        jwtSecret: SECRET,
        pool,
        now: () => now,
      });

      // Reset database tables
      await pool.query(
        'TRUNCATE TABLE submissions, class_enrollments, labs, classes, users CASCADE;',
      );

      // Seed test users
      await pool.query(`
      INSERT INTO users (id, email, password_hash, role) VALUES
      ('s1', 's1@test.local', 'hash', 'student'),
      ('s2', 's2@test.local', 'hash', 'student'),
      ('s3', 's3@test.local', 'hash', 'student'),
      ('ta1', 'ta1@test.local', 'hash', 'ta'),
      ('admin1', 'admin1@test.local', 'hash', 'admin');
    `);

      // Seed test classes
      await pool.query(`
      INSERT INTO classes (id, name) VALUES
      ('c1', 'Class 1'),
      ('c2', 'Class 2');
    `);

      // Seed class enrollments
      await pool.query(`
      INSERT INTO class_enrollments (class_id, student_id) VALUES
      ('c1', 's1'),
      ('c1', 's3'),
      ('c2', 's2');
    `);

      // Seed test labs
      await pool.query(`
      INSERT INTO labs (id, class_id, title, statement, tests, constraints, deadline) VALUES
      ('lab-open', 'c1', 'Open Lab', 'Sort numbers', '[]'::jsonb, '[]'::jsonb, '2026-11-08T00:00:00Z'),
      ('lab-past', 'c1', 'Past Lab', 'Sort numbers', '[]'::jsonb, '[]'::jsonb, '2026-10-01T00:00:00Z'),
      ('lab-other', 'c2', 'Other Lab', 'Sort numbers', '[]'::jsonb, '[]'::jsonb, '2026-11-08T00:00:00Z');
    `);
    });

    describe('202 Accepted', () => {
      test('creates a queued submission in postgres owned by caller', async () => {
        const res = await submit(app, {
          sub: 's1',
          lab: 'lab-open',
          key: 'k1',
        });
        assert.equal(res.status, 202);
        assert.equal(res.body.labId, 'lab-open');
        assert.equal(res.body.studentId, 's1');
        assert.equal(res.body.language, 'cpp');
        assert.equal(res.body.status, 'queued');
        assert.equal(res.body.createdAt, START.toISOString());
        assert.equal(res.headers.location, `/submissions/${res.body.id}`);
        assert.equal(res.headers['idempotent-replayed'], undefined);

        // Verify row persisted in PostgreSQL
        const dbRes = await pool.query(
          'SELECT * FROM submissions WHERE id = $1',
          [res.body.id],
        );
        assert.equal(dbRes.rows.length, 1);
        assert.equal(dbRes.rows[0].student_id, 's1');
        assert.equal(dbRes.rows[0].lab_id, 'lab-open');
        assert.equal(dbRes.rows[0].idempotency_key, 'k1');
      });
    });

    describe('idempotency', () => {
      test('a retry with same key and body replays first submission from postgres', async () => {
        const first = await submit(app, { key: 'k-idem' });
        assert.equal(first.status, 202);

        now = new Date(START.getTime() + 60_000);
        const second = await submit(app, { key: 'k-idem' });
        assert.equal(second.status, 202);
        assert.equal(second.headers['idempotent-replayed'], 'true');
        assert.equal(second.body.id, first.body.id);
        assert.equal(second.body.createdAt, first.body.createdAt);

        const count = await pool.query(
          'SELECT count(*) FROM submissions WHERE idempotency_key = $1',
          ['k-idem'],
        );
        assert.equal(Number(count.rows[0].count), 1);
      });

      test('a different key creates a different submission', async () => {
        const first = await submit(app, { key: 'k-1' });
        const second = await submit(app, { key: 'k-2' });
        assert.equal(first.status, 202);
        assert.equal(second.status, 202);
        assert.notEqual(first.body.id, second.body.id);
      });

      test('same key with different body is refused with 422 and stores nothing new', async () => {
        const first = await submit(app, { key: 'k-diff', body: BODY });
        assert.equal(first.status, 202);

        const modified = {
          language: 'cpp',
          source: 'int main() { return 1; }\n',
        };
        const second = await submit(app, { key: 'k-diff', body: modified });
        assertProblem(
          second,
          422,
          'idempotency-key-reused',
          'Idempotency-Key was used with a different request',
        );
      });

      test('the key is scoped per student in postgres unique constraint', async () => {
        const s1 = await submit(app, { sub: 's1', key: 'shared-key' });
        const s3 = await submit(app, { sub: 's3', key: 'shared-key' });
        assert.equal(s1.status, 202);
        assert.equal(s3.status, 202);
        assert.notEqual(s1.body.id, s3.body.id);
        assert.equal(s1.headers['idempotent-replayed'], undefined);
        assert.equal(s3.headers['idempotent-replayed'], undefined);
      });

      test('a retry after deadline of accepted request still replays', async () => {
        const accepted = await submit(app, { key: 'k-before-deadline' });
        assert.equal(accepted.status, 202);

        // Advance time past deadline (deadline was 2026-11-08)
        now = new Date('2026-11-10T00:00:00Z');
        const retry = await submit(app, { key: 'k-before-deadline' });
        assert.equal(retry.status, 202);
        assert.equal(retry.headers['idempotent-replayed'], 'true');
        assert.equal(retry.body.id, accepted.body.id);
      });
    });

    describe('ownership & authorization', () => {
      test('unknown lab gives 404', async () => {
        const res = await submit(app, { lab: 'non-existent-lab' });
        assertProblem(res, 404, 'lab-not-found', 'Lab not found');
      });

      test('lab in another class where student is not enrolled gives 404', async () => {
        // s1 is enrolled in c1, lab-other belongs to c2
        const res = await submit(app, { sub: 's1', lab: 'lab-other' });
        assertProblem(res, 404, 'lab-not-found', 'Lab not found');
      });

      test('role ta gets 403 forbidden-role', async () => {
        const res = await submit(app, { sub: 'ta1', role: 'ta' });
        assertProblem(res, 403, 'forbidden-role', 'Only students may submit');
      });

      test('role admin gets 403 forbidden-role', async () => {
        const res = await submit(app, { sub: 'admin1', role: 'admin' });
        assertProblem(res, 403, 'forbidden-role', 'Only students may submit');
      });
    });

    describe('lab deadline state', () => {
      test('a lab past its deadline gives 409 lab-closed', async () => {
        const res = await submit(app, { lab: 'lab-past' });
        assertProblem(res, 409, 'lab-closed', 'Lab is closed for submissions');
      });
    });
  },
);
