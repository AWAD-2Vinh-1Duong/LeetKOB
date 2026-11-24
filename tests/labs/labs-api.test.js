// Contract tests for docs/contract/labs-and-submission-status.md (revision 1).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';
import {
  InMemoryLabRepository,
  InMemorySubmissionRepository,
} from '../../src/repositories/in-memory.js';

const SECRET = 'test-secret-not-a-real-one-0123456789';
const PROBLEM_BASE = 'https://leettkob.dev/problems/';
const NOW = new Date('2026-11-24T10:00:00.000Z');

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
}

const GOOD_LAB = {
  classId: 'class-a',
  title: 'Merge sort by hand',
  statement: 'Sort n integers. Print them in ascending order.',
  tests: [
    { input: '3\n3 1 2\n', expectedOutput: '1 2 3\n' },
    { input: '1\n5\n', expectedOutput: '5\n' },
  ],
  constraints: [
    { text: 'Do not use `std::sort`.', deduction: 3 },
    { text: 'The merge step must be iterative.', deduction: 2 },
  ],
  deadline: '2026-12-31T16:59:00+07:00',
};

describe('labs and submission status', () => {
  /** @type {import('express').Express} */
  let app;

  beforeEach(() => {
    app = createApp({
      jwtSecret: SECRET,
      now: () => NOW,
      labRepository: new InMemoryLabRepository({
        classes: ['class-a', 'class-b'],
        labs: [],
        enrollments: [
          { studentId: 's-a', classId: 'class-a' },
          { studentId: 's-a2', classId: 'class-a' },
          { studentId: 's-b', classId: 'class-b' },
        ],
        staff: [
          { userId: 'ta-a', classId: 'class-a' },
          { userId: 'ta-b', classId: 'class-b' },
        ],
      }),
      submissionRepository: new InMemorySubmissionRepository(),
    });
  });

  /** @param {unknown} body @param {string | null} [sub] @param {string} [role] */
  const createLab = async (body, sub = 'ta-a', role = 'ta') => {
    let req = request(app).post('/labs');
    if (sub) req = req.set('Authorization', `Bearer ${await token(sub, role)}`);
    return req.send(/** @type {object} */ (body));
  };

  /** @param {string} path @param {string | null} sub @param {string} role */
  const get = async (path, sub, role) => {
    let req = request(app).get(path);
    if (sub) req = req.set('Authorization', `Bearer ${await token(sub, role)}`);
    return req;
  };

  describe('POST /labs', () => {
    test('201: a TA creates a lab in their own class', async () => {
      const res = await createLab(GOOD_LAB);
      assert.equal(res.status, 201);
      assert.equal(typeof res.body.id, 'string');
      assert.equal(res.headers.location, `/labs/${res.body.id}`);
      assert.equal(res.body.classId, 'class-a');
      assert.equal(res.body.title, GOOD_LAB.title);
      assert.equal(res.body.statement, GOOD_LAB.statement);
      assert.deepEqual(res.body.tests, GOOD_LAB.tests);
      assert.equal(res.body.deadline, '2026-12-31T09:59:00.000Z');
    });

    test('the server numbers the constraints c1, c2 and keeps the TA deductions', async () => {
      const res = await createLab(GOOD_LAB);
      assert.deepEqual(res.body.constraints, [
        { id: 'c1', text: 'Do not use `std::sort`.', deduction: 3 },
        { id: 'c2', text: 'The merge step must be iterative.', deduction: 2 },
      ]);
    });

    test('201: an admin creates a lab in any existing class', async () => {
      const res = await createLab(
        { ...GOOD_LAB, classId: 'class-b' },
        'admin1',
        'admin',
      );
      assert.equal(res.status, 201);
    });

    test('a lab without constraints is allowed', async () => {
      const res = await createLab({ ...GOOD_LAB, constraints: [] });
      assert.equal(res.status, 201);
      assert.deepEqual(res.body.constraints, []);
    });

    test('the lab can be read back with no seed in between', async () => {
      const created = await createLab(GOOD_LAB);
      const res = await get(`/labs/${created.body.id}`, 'ta-a', 'ta');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.tests, GOOD_LAB.tests);
      assert.equal(res.body.constraints.length, 2);
    });

    test('a student gets 403 staff-only', async () => {
      assertProblem(
        await createLab(GOOD_LAB, 's-a', 'student'),
        403,
        'staff-only',
      );
    });

    test('a TA of another class gets 404 class-not-found', async () => {
      assertProblem(
        await createLab({ ...GOOD_LAB, classId: 'class-b' }),
        404,
        'class-not-found',
      );
    });

    test('a class that does not exist looks the same to a TA', async () => {
      const missing = await createLab({ ...GOOD_LAB, classId: 'nope' });
      const other = await createLab({ ...GOOD_LAB, classId: 'class-b' });
      assertProblem(missing, 404, 'class-not-found');
      assert.equal(missing.body.title, other.body.title);
    });

    test('an admin gets 404 class-not-found for a missing class', async () => {
      assertProblem(
        await createLab({ ...GOOD_LAB, classId: 'nope' }, 'admin1', 'admin'),
        404,
        'class-not-found',
      );
    });

    test('no token gives 401', async () => {
      assertProblem(await createLab(GOOD_LAB, null), 401, 'unauthenticated');
    });

    /** @type {[string, Record<string, unknown>][]} */
    const bad = [
      ['missing title', { title: undefined }],
      ['empty title', { title: '' }],
      ['missing statement', { statement: undefined }],
      ['no tests', { tests: [] }],
      ['a test without expectedOutput', { tests: [{ input: '1' }] }],
      ['a constraint without text', { constraints: [{ deduction: 1 }] }],
      [
        'a negative deduction',
        { constraints: [{ text: 'Do not use `qsort`.', deduction: -1 }] },
      ],
      [
        'a deduction above 100',
        { constraints: [{ text: 'Do not use `qsort`.', deduction: 101 }] },
      ],
      [
        'a deduction that is not a number',
        { constraints: [{ text: 'Do not use `qsort`.', deduction: '3' }] },
      ],
      ['a deadline that is not a date', { deadline: 'tomorrow' }],
      ['a deadline without an offset', { deadline: '2026-12-31T23:59:00' }],
      ['an unknown field', { published: true }],
    ];
    for (const [name, patch] of bad) {
      test(`${name} gives 400 validation-error`, async () => {
        const res = await createLab({ ...GOOD_LAB, ...patch });
        assertProblem(res, 400, 'validation-error');
        assert.ok(Array.isArray(res.body.errors));
        assert.ok(res.body.errors.length > 0);
      });
    }

    test('malformed JSON gives 400 validation-error', async () => {
      const res = await request(app)
        .post('/labs')
        .set('Authorization', `Bearer ${await token('ta-a', 'ta')}`)
        .set('Content-Type', 'application/json')
        .send('{"title":');
      assertProblem(res, 400, 'validation-error');
    });
  });

  describe('GET /labs/:labId by role', () => {
    test('a student sees the statement and constraints but not the tests', async () => {
      const created = await createLab(GOOD_LAB);
      const res = await get(`/labs/${created.body.id}`, 's-a', 'student');
      assert.equal(res.status, 200);
      assert.equal(res.body.statement, GOOD_LAB.statement);
      assert.equal(res.body.constraints.length, 2);
      assert.equal('tests' in res.body, false);
    });

    test('a student of another class does not see the lab', async () => {
      const created = await createLab(GOOD_LAB);
      assertProblem(
        await get(`/labs/${created.body.id}`, 's-b', 'student'),
        404,
        'lab-not-found',
      );
    });

    test('a TA of another class does not see the lab', async () => {
      const created = await createLab(GOOD_LAB);
      assertProblem(
        await get(`/labs/${created.body.id}`, 'ta-b', 'ta'),
        404,
        'lab-not-found',
      );
    });
  });

  describe('submitting to a lab created through the API', () => {
    /** @param {string} labId @param {string} sub @param {string} key */
    const submit = async (labId, sub, key) =>
      request(app)
        .post(`/labs/${labId}/submissions`)
        .set('Authorization', `Bearer ${await token(sub, 'student')}`)
        .set('Idempotency-Key', key)
        .send({ language: 'cpp', source: 'int main() { return 0; }\n' });

    test('an enrolled student submits and gets 202 queued', async () => {
      const lab = await createLab(GOOD_LAB);
      const res = await submit(lab.body.id, 's-a', 'k1');
      assert.equal(res.status, 202);
      assert.equal(res.body.status, 'queued');
    });

    test('a student of another class gets 404 lab-not-found', async () => {
      const lab = await createLab(GOOD_LAB);
      assertProblem(
        await submit(lab.body.id, 's-b', 'k1'),
        404,
        'lab-not-found',
      );
    });
  });

  describe('GET /submissions/:id', () => {
    /** @returns {Promise<string>} */
    async function makeSubmission() {
      const lab = await createLab(GOOD_LAB);
      const res = await request(app)
        .post(`/labs/${lab.body.id}/submissions`)
        .set('Authorization', `Bearer ${await token('s-a', 'student')}`)
        .set('Idempotency-Key', 'k1')
        .send({ language: 'cpp', source: 'int main() { return 0; }\n' });
      return res.body.id;
    }

    test('the Location of a submission can be followed', async () => {
      const lab = await createLab(GOOD_LAB);
      const made = await request(app)
        .post(`/labs/${lab.body.id}/submissions`)
        .set('Authorization', `Bearer ${await token('s-a', 'student')}`)
        .set('Idempotency-Key', 'k1')
        .send({ language: 'cpp', source: 'int main() {}\n' });
      const res = await get(made.headers.location, 's-a', 'student');
      assert.equal(res.status, 200);
      assert.equal(res.body.id, made.body.id);
    });

    test('the owner sees the status and nothing else', async () => {
      const id = await makeSubmission();
      const res = await get(`/submissions/${id}`, 's-a', 'student');
      assert.equal(res.status, 200);
      assert.deepEqual(Object.keys(res.body).sort(), [
        'createdAt',
        'id',
        'labId',
        'language',
        'status',
        'studentId',
      ]);
      assert.equal(res.body.status, 'queued');
    });

    test('no verdict, deduction or source reaches the response', async () => {
      const id = await makeSubmission();
      const text = JSON.stringify(
        (await get(`/submissions/${id}`, 's-a', 'student')).body,
      );
      for (const word of ['verdict', 'deduction', 'source', 'evidence']) {
        assert.ok(!text.includes(word), word);
      }
    });

    test('the TA of the lab class and an admin can read it', async () => {
      const id = await makeSubmission();
      assert.equal((await get(`/submissions/${id}`, 'ta-a', 'ta')).status, 200);
      assert.equal(
        (await get(`/submissions/${id}`, 'admin1', 'admin')).status,
        200,
      );
    });

    test('another student of the same class gets 404', async () => {
      const id = await makeSubmission();
      assertProblem(
        await get(`/submissions/${id}`, 's-a2', 'student'),
        404,
        'submission-not-found',
      );
    });

    test('a TA of another class gets 404', async () => {
      const id = await makeSubmission();
      assertProblem(
        await get(`/submissions/${id}`, 'ta-b', 'ta'),
        404,
        'submission-not-found',
      );
    });

    test('an unknown id gets 404 submission-not-found', async () => {
      assertProblem(
        await get('/submissions/nope', 's-a', 'student'),
        404,
        'submission-not-found',
      );
    });

    test('no token gives 401', async () => {
      const id = await makeSubmission();
      assertProblem(
        await get(`/submissions/${id}`, null, 'student'),
        401,
        'unauthenticated',
      );
    });
  });
});
