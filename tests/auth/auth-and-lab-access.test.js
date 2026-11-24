// Contract tests for docs/contract/auth-and-lab-access.md (revision 1).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SignJWT, jwtVerify } from 'jose';
import { createApp } from '../../src/app.js';
import { InMemoryLabRepository } from '../../src/modules/labs/repository/labs.repository.memory.js';
import { InMemorySubmissionRepository } from '../../src/modules/submissions/repository/submissions.repository.memory.js';
import { InMemoryUserRepository } from '../../src/modules/auth/repository/users.repository.memory.js';
import { hashPassword } from '../../src/modules/auth/service/passwords.js';

const SECRET = 'test-secret-not-a-real-one-0123456789';
const PROBLEM_BASE = 'https://leettkob.dev/problems/';
const NOW = new Date('2026-11-24T10:00:00.000Z');
const FUTURE = new Date('2026-12-31T00:00:00.000Z');

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
  assert.equal(res.status, status);
  assert.match(res.headers['content-type'], /^application\/problem\+json/);
  assert.equal(res.body.type, PROBLEM_BASE + slug);
  assert.equal(res.body.status, status);
  assert.equal(typeof res.body.title, 'string');
  assert.equal(typeof res.body.detail, 'string');
  assert.equal(typeof res.body.instance, 'string');
}

describe('auth and class access', () => {
  /** @type {import('express').Express} */
  let app;

  before(async () => {
    /** @type {Array<{ id: string, email: string, role: 'admin' | 'ta' | 'student' }>} */
    const users = [
      { id: 'admin1', email: 'admin@t.local', role: 'admin' },
      { id: 'ta-a', email: 'ta-a@t.local', role: 'ta' },
      { id: 'ta-b', email: 'ta-b@t.local', role: 'ta' },
      { id: 'ta-both', email: 'ta-both@t.local', role: 'ta' },
      { id: 's-a', email: 's-a@t.local', role: 'student' },
      { id: 's-b', email: 's-b@t.local', role: 'student' },
    ];
    const passwordHash = await hashPassword('correct-password');
    app = createApp({
      jwtSecret: SECRET,
      now: () => NOW,
      userRepository: new InMemoryUserRepository({
        users: users.map((u) => ({ ...u, passwordHash })),
      }),
      labRepository: new InMemoryLabRepository({
        labs: [
          { id: 'lab-a', classId: 'class-a', deadline: FUTURE },
          { id: 'lab-b', classId: 'class-b', deadline: FUTURE },
        ],
        enrollments: [
          { studentId: 's-a', classId: 'class-a' },
          { studentId: 's-b', classId: 'class-b' },
        ],
        staff: [
          { userId: 'ta-a', classId: 'class-a' },
          { userId: 'ta-b', classId: 'class-b' },
          { userId: 'ta-both', classId: 'class-a' },
          { userId: 'ta-both', classId: 'class-b' },
        ],
      }),
      submissionRepository: new InMemorySubmissionRepository(),
    });
  });

  describe('POST /auth/login', () => {
    /** @param {unknown} body */
    const login = (body) =>
      request(app)
        .post('/auth/login')
        .send(/** @type {object} */ (body));

    test('200 returns a bearer token with sub, role and exp', async () => {
      const res = await login({
        email: 'ta-a@t.local',
        password: 'correct-password',
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.tokenType, 'Bearer');
      assert.equal(res.body.expiresIn, 3600);
      const { payload } = await jwtVerify(
        res.body.token,
        new TextEncoder().encode(SECRET),
        { algorithms: ['HS256'] },
      );
      assert.equal(payload.sub, 'ta-a');
      assert.equal(payload.role, 'ta');
      assert.equal(typeof payload.exp, 'number');
    });

    test('the token from login opens the submissions endpoint', async () => {
      const res = await login({
        email: 's-a@t.local',
        password: 'correct-password',
      });
      const sub = await request(app)
        .post('/labs/lab-a/submissions')
        .set('Authorization', `Bearer ${res.body.token}`)
        .set('Idempotency-Key', 'login-flow-1')
        .send({ language: 'cpp', source: 'int main() {}\n' });
      assert.equal(sub.status, 202);
    });

    test('a wrong password gives 401 invalid-credentials', async () => {
      const res = await login({ email: 'ta-a@t.local', password: 'wrong' });
      assertProblem(res, 401, 'invalid-credentials');
    });

    test('an unknown email gives the same response as a wrong password', async () => {
      const wrong = await login({ email: 'ta-a@t.local', password: 'wrong' });
      const unknown = await login({
        email: 'nobody@t.local',
        password: 'wrong',
      });
      assertProblem(unknown, 401, 'invalid-credentials');
      assert.equal(unknown.body.detail, wrong.body.detail);
      assert.equal(unknown.body.title, wrong.body.title);
    });

    test('the response never contains the password or its hash', async () => {
      const res = await login({
        email: 'ta-a@t.local',
        password: 'hunter2-not-echoed',
      });
      assert.ok(!JSON.stringify(res.body).includes('scrypt'));
      assert.ok(!JSON.stringify(res.body).includes('hunter2-not-echoed'));
    });

    for (const [name, body] of /** @type {[string, unknown][]} */ ([
      ['missing password', { email: 'ta-a@t.local' }],
      ['missing email', { password: 'x' }],
      ['non-string password', { email: 'ta-a@t.local', password: 123 }],
      [
        'unknown field',
        { email: 'ta-a@t.local', password: 'x', role: 'admin' },
      ],
      ['array body', []],
    ])) {
      test(`${name} gives 400 validation-error`, async () => {
        assertProblem(await login(body), 400, 'validation-error');
      });
    }

    test('malformed JSON gives 400 validation-error', async () => {
      const res = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email":');
      assertProblem(res, 400, 'validation-error');
    });
  });

  describe('GET /labs/:labId', () => {
    /** @param {string} lab @param {string | null} [sub] @param {string} [role] */
    const get = async (lab, sub = null, role = 'student') => {
      let req = request(app).get(`/labs/${lab}`);
      if (sub)
        req = req.set('Authorization', `Bearer ${await token(sub, role)}`);
      return req;
    };

    test('an enrolled student sees the lab', async () => {
      const res = await get('lab-a', 's-a');
      assert.equal(res.status, 200);
      assert.equal(res.body.id, 'lab-a');
      assert.equal(res.body.classId, 'class-a');
    });

    test('the TA of the class sees the lab', async () => {
      assert.equal((await get('lab-a', 'ta-a', 'ta')).status, 200);
    });

    test('an admin sees every lab', async () => {
      assert.equal((await get('lab-a', 'admin1', 'admin')).status, 200);
      assert.equal((await get('lab-b', 'admin1', 'admin')).status, 200);
    });

    test('a TA of two classes sees both labs', async () => {
      assert.equal((await get('lab-a', 'ta-both', 'ta')).status, 200);
      assert.equal((await get('lab-b', 'ta-both', 'ta')).status, 200);
    });

    test('a TA of another class gets 404 lab-not-found', async () => {
      assertProblem(await get('lab-a', 'ta-b', 'ta'), 404, 'lab-not-found');
      assertProblem(await get('lab-b', 'ta-a', 'ta'), 404, 'lab-not-found');
    });

    test('a student of another class gets 404 lab-not-found', async () => {
      assertProblem(await get('lab-a', 's-b'), 404, 'lab-not-found');
    });

    test('another class and a missing lab look the same', async () => {
      const other = await get('lab-a', 'ta-b', 'ta');
      const nope = await get('no-such-lab', 'ta-b', 'ta');
      assertProblem(nope, 404, 'lab-not-found');
      assert.equal(nope.body.title, other.body.title);
      assert.equal(nope.status, other.status);
      assert.equal(nope.body.type, other.body.type);
    });

    test('no token gives 401 unauthenticated', async () => {
      assertProblem(await get('lab-a'), 401, 'unauthenticated');
    });
  });

  describe('GET /labs/:labId/review-queue', () => {
    /** @param {string} lab @param {string | null} [sub] @param {string} [role] */
    const queue = async (lab, sub = null, role = 'ta') => {
      let req = request(app).get(`/labs/${lab}/review-queue`);
      if (sub)
        req = req.set('Authorization', `Bearer ${await token(sub, role)}`);
      return req;
    };

    test('the TA of the class opens the queue', async () => {
      const res = await queue('lab-a', 'ta-a');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { items: [] });
    });

    test('an admin opens any queue', async () => {
      assert.equal((await queue('lab-b', 'admin1', 'admin')).status, 200);
    });

    test('a TA of another class gets 404 lab-not-found', async () => {
      assertProblem(await queue('lab-a', 'ta-b'), 404, 'lab-not-found');
      assertProblem(await queue('lab-b', 'ta-a'), 404, 'lab-not-found');
    });

    test('an enrolled student gets 403 staff-only', async () => {
      assertProblem(await queue('lab-a', 's-a', 'student'), 403, 'staff-only');
    });

    test('a student of another class gets 404, not 403', async () => {
      assertProblem(
        await queue('lab-a', 's-b', 'student'),
        404,
        'lab-not-found',
      );
    });

    test('no token gives 401 unauthenticated', async () => {
      assertProblem(await queue('lab-a'), 401, 'unauthenticated');
    });
  });
});
