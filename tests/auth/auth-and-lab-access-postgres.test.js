// The same access rules as auth-and-lab-access.test.js, on PostgreSQL.
// Skipped when DATABASE_URL is not set.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';
import { createPool } from '../../src/shared/db.js';
import { hashPassword } from '../../src/modules/auth/service/passwords.js';

const SECRET = 'test-secret-not-a-real-one-0123456789';
const hasDb = Boolean(process.env.DATABASE_URL);

/** @param {string} sub @param {string} role */
const token = (sub, role) =>
  new SignJWT({ sub, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));

describe(
  'auth and class access (PostgreSQL implementation)',
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
      const hash = await hashPassword('correct-password');
      await pool.query(
        `INSERT INTO users (id, email, password_hash, role) VALUES
         ('admin1', 'admin@t.local', $1, 'admin'),
         ('ta-a', 'ta-a@t.local', $1, 'ta'),
         ('ta-b', 'ta-b@t.local', $1, 'ta'),
         ('s-a', 's-a@t.local', $1, 'student'),
         ('s-b', 's-b@t.local', $1, 'student')`,
        [hash],
      );
      await pool.query(
        `INSERT INTO classes (id, name) VALUES ('class-a', 'A'), ('class-b', 'B')`,
      );
      await pool.query(
        `INSERT INTO class_staff (class_id, user_id) VALUES ('class-a', 'ta-a'), ('class-b', 'ta-b')`,
      );
      await pool.query(
        `INSERT INTO class_enrollments (class_id, student_id) VALUES ('class-a', 's-a'), ('class-b', 's-b')`,
      );
      await pool.query(
        `INSERT INTO labs (id, class_id, title, statement, deadline) VALUES
         ('lab-a', 'class-a', 'A', 'x', '2026-12-31T00:00:00Z'),
         ('lab-b', 'class-b', 'B', 'x', '2026-12-31T00:00:00Z')`,
      );
    });

    after(async () => {
      await pool?.end();
    });

    test('login with the stored scrypt hash returns a token', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'ta-a@t.local', password: 'correct-password' });
      assert.equal(res.status, 200);
      assert.equal(typeof res.body.token, 'string');
    });

    test('a wrong password and an unknown email both give 401 invalid-credentials', async () => {
      for (const email of ['ta-a@t.local', 'nobody@t.local']) {
        const res = await request(app)
          .post('/auth/login')
          .send({ email, password: 'wrong-one' });
        assert.equal(res.status, 401);
        assert.equal(
          res.body.type,
          'https://leettkob.dev/problems/invalid-credentials',
        );
      }
    });

    /** @param {string} path @param {string} sub @param {string} role */
    const get = async (path, sub, role) =>
      request(app)
        .get(path)
        .set('Authorization', `Bearer ${await token(sub, role)}`);

    test('the TA of the class and an admin see the lab', async () => {
      assert.equal((await get('/labs/lab-a', 'ta-a', 'ta')).status, 200);
      assert.equal((await get('/labs/lab-b', 'admin1', 'admin')).status, 200);
    });

    test('an enrolled student sees the lab', async () => {
      assert.equal((await get('/labs/lab-a', 's-a', 'student')).status, 200);
    });

    test('a TA of another class gets 404 lab-not-found on the lab and the queue', async () => {
      for (const path of ['/labs/lab-a', '/labs/lab-a/review-queue']) {
        const res = await get(path, 'ta-b', 'ta');
        assert.equal(res.status, 404);
        assert.equal(
          res.body.type,
          'https://leettkob.dev/problems/lab-not-found',
        );
      }
    });

    test('a student of another class gets 404, an enrolled student gets 403 on the queue', async () => {
      assert.equal(
        (await get('/labs/lab-a/review-queue', 's-b', 'student')).status,
        404,
      );
      const res = await get('/labs/lab-a/review-queue', 's-a', 'student');
      assert.equal(res.status, 403);
      assert.equal(res.body.type, 'https://leettkob.dev/problems/staff-only');
    });
  },
);
