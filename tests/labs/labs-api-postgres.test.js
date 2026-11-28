// The lab and submission status flow on PostgreSQL, with no row inserted by hand
// for the lab: it is created through the API. Skipped without DATABASE_URL.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';
import { createPool } from '../../src/shared/db.js';

const SECRET = 'test-secret-not-a-real-one-0123456789';
const hasDb = Boolean(process.env.DATABASE_URL);

/** @param {string} sub @param {string} role */
const token = async (sub, role) =>
  `Bearer ${await new SignJWT({ sub, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET))}`;

const LAB = {
  classId: 'class-a',
  title: 'Merge sort by hand',
  statement: 'Sort n integers.',
  tests: [{ input: '3\n3 1 2\n', expectedOutput: '1 2 3\n' }],
  constraints: [
    { text: 'Do not use `std::sort`.', deduction: 3 },
    { text: 'The merge step must be iterative.', deduction: 2 },
  ],
  deadline: '2099-12-31T16:59:00+07:00',
};

describe(
  'labs and submission status (PostgreSQL implementation)',
  { skip: !hasDb },
  () => {
    /** @type {import('pg').Pool} */
    let pool;
    /** @type {import('express').Express} */
    let app;

    before(async () => {
      pool = createPool(process.env.DATABASE_URL);
      app = createApp({ jwtSecret: SECRET, pool });
      await pool.query(
        'TRUNCATE TABLE class_staff, submissions, class_enrollments, labs, classes, users CASCADE;',
      );
      await pool.query(
        `INSERT INTO users (id, email, password_hash, role) VALUES
         ('admin1', 'admin@t.local', 'x', 'admin'),
         ('ta-a', 'ta-a@t.local', 'x', 'ta'),
         ('ta-b', 'ta-b@t.local', 'x', 'ta'),
         ('s-a', 's-a@t.local', 'x', 'student'),
         ('s-a2', 's-a2@t.local', 'x', 'student'),
         ('s-b', 's-b@t.local', 'x', 'student')`,
      );
      await pool.query(
        `INSERT INTO classes (id, name) VALUES ('class-a', 'A'), ('class-b', 'B')`,
      );
      await pool.query(
        `INSERT INTO class_staff (class_id, user_id) VALUES ('class-a', 'ta-a'), ('class-b', 'ta-b')`,
      );
      await pool.query(
        `INSERT INTO class_enrollments (class_id, student_id) VALUES
         ('class-a', 's-a'), ('class-a', 's-a2'), ('class-b', 's-b')`,
      );
    });

    after(async () => {
      await pool?.end();
    });

    /** @param {unknown} body @param {string} sub @param {string} role */
    const create = async (body, sub, role) =>
      request(app)
        .post('/labs')
        .set('Authorization', await token(sub, role))
        .send(/** @type {object} */ (body));

    /** @param {string} path @param {string} sub @param {string} role */
    const get = async (path, sub, role) =>
      request(app)
        .get(path)
        .set('Authorization', await token(sub, role));

    test('a TA creates a lab, it is stored and read back with its constraints', async () => {
      const res = await create(LAB, 'ta-a', 'ta');
      assert.equal(res.status, 201);
      assert.deepEqual(
        res.body.constraints.map((/** @type {{ id: string }} */ c) => c.id),
        ['c1', 'c2'],
      );
      const back = await get(`/labs/${res.body.id}`, 'ta-a', 'ta');
      assert.equal(back.status, 200);
      assert.deepEqual(back.body.tests, LAB.tests);
      assert.equal(back.body.constraints[0].deduction, 3);
    });

    test('a student sees the lab without its tests', async () => {
      const res = await create(LAB, 'ta-a', 'ta');
      const back = await get(`/labs/${res.body.id}`, 's-a', 'student');
      assert.equal(back.status, 200);
      assert.equal('tests' in back.body, false);
    });

    test('a TA of another class and a student get the 404 and 403 of the contract', async () => {
      const other = await create(LAB, 'ta-b', 'ta');
      assert.equal(other.status, 404);
      assert.equal(
        other.body.type,
        'https://leettkob.dev/problems/class-not-found',
      );
      const student = await create(LAB, 's-a', 'student');
      assert.equal(student.status, 403);
    });

    test('submit to the new lab, then follow the Location', async () => {
      const lab = await create(LAB, 'ta-a', 'ta');
      const made = await request(app)
        .post(`/labs/${lab.body.id}/submissions`)
        .set('Authorization', await token('s-a', 'student'))
        .set('Idempotency-Key', 'k1')
        .send({ language: 'cpp', source: 'int main() {}\n' });
      assert.equal(made.status, 202);
      const status = await get(made.headers.location, 's-a', 'student');
      assert.equal(status.status, 200);
      assert.equal(status.body.status, 'queued');
      assert.equal(
        (await get(made.headers.location, 'ta-a', 'ta')).status,
        200,
      );
      assert.equal(
        (await get(made.headers.location, 's-a2', 'student')).status,
        404,
      );
      assert.equal(
        (await get(made.headers.location, 'ta-b', 'ta')).status,
        404,
      );
    });
  },
);
