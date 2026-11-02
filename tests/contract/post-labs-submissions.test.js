// Contract tests for docs/contract/post-labs-submissions.md (revision 1).
import { test, describe } from 'node:test';
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
const START = new Date('2026-11-01T10:00:00.000Z');

/** @param {Record<string, unknown>} claims @param {{ secret?: string, exp?: string | number }} [opts] */
function token(claims, opts = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(opts.exp ?? '1h')
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

function setup() {
  let now = START;
  const app = createApp({
    jwtSecret: SECRET,
    labRepository: new InMemoryLabRepository({
      labs: [
        {
          id: 'lab-open',
          classId: 'c1',
          deadline: new Date('2026-11-08T00:00:00Z'),
        },
        {
          id: 'lab-past',
          classId: 'c1',
          deadline: new Date('2026-10-01T00:00:00Z'),
        },
        {
          id: 'lab-other',
          classId: 'c2',
          deadline: new Date('2026-11-08T00:00:00Z'),
        },
      ],
      enrollments: [
        { studentId: 's1', classId: 'c1' },
        { studentId: 's3', classId: 'c1' },
        { studentId: 's2', classId: 'c2' },
      ],
    }),
    submissionRepository: new InMemorySubmissionRepository(),
    now: () => now,
  });
  return {
    app,
    /** @param {Date} d */
    setNow: (d) => {
      now = d;
    },
  };
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

describe('202 Accepted', () => {
  test('creates a queued submission owned by the caller', async () => {
    const { app } = setup();
    const res = await submit(app);
    assert.equal(res.status, 202);
    assert.match(res.body.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual(
      { ...res.body, id: undefined },
      {
        id: undefined,
        labId: 'lab-open',
        studentId: 's1',
        language: 'cpp',
        status: 'queued',
        createdAt: START.toISOString(),
      },
    );
    assert.equal(res.headers.location, `/submissions/${res.body.id}`);
    assert.equal(res.headers['idempotent-replayed'], undefined);
  });
});

describe('idempotency', () => {
  test('a retry with the same key and body replays the first submission', async () => {
    const { app, setNow } = setup();
    const first = await submit(app);
    setNow(new Date('2026-11-01T10:05:00Z'));
    const retry = await submit(app);
    assert.equal(retry.status, 202);
    assert.deepEqual(retry.body, first.body);
    assert.equal(retry.headers['idempotent-replayed'], 'true');
    assert.equal(retry.headers.location, first.headers.location);
  });

  test('a different key creates a different submission', async () => {
    const { app } = setup();
    const a = await submit(app, { key: 'key-a' });
    const b = await submit(app, { key: 'key-b' });
    assert.notEqual(a.body.id, b.body.id);
  });

  test('the same key with a different body is refused and stores nothing', async () => {
    const { app } = setup();
    const first = await submit(app);
    const res = await submit(app, {
      body: { language: 'cpp', source: 'int main() {}\n' },
    });
    assertProblem(
      res,
      422,
      'idempotency-key-reused',
      'Idempotency-Key was used with a different request',
    );
    const again = await submit(app);
    assert.equal(again.body.id, first.body.id);
  });

  test('the key is scoped per student', async () => {
    const { app } = setup();
    const a = await submit(app, { sub: 's1' });
    const b = await submit(app, { sub: 's3' });
    assert.equal(b.status, 202);
    assert.equal(b.headers['idempotent-replayed'], undefined);
    assert.notEqual(a.body.id, b.body.id);
    assert.equal(b.body.studentId, 's3');
  });

  test('a failed request leaves the key free', async () => {
    const { app } = setup();
    const bad = await submit(app, { body: { language: 'cpp', source: '' } });
    assert.equal(bad.status, 400);
    const ok = await submit(app);
    assert.equal(ok.status, 202);
    assert.equal(ok.headers['idempotent-replayed'], undefined);
  });

  test('a retry after the deadline of an accepted request still replays', async () => {
    const { app, setNow } = setup();
    const first = await submit(app);
    setNow(new Date('2026-11-09T00:00:00Z'));
    const retry = await submit(app);
    assert.equal(retry.status, 202);
    assert.equal(retry.body.id, first.body.id);
  });

  for (const [name, key] of [
    ['missing', null],
    ['empty', ''],
    ['longer than 255 characters', 'k'.repeat(256)],
    ['non-printable ASCII', 'kéy'],
  ]) {
    test(`Idempotency-Key ${name} gives 400 idempotency-key-missing`, async () => {
      const { app } = setup();
      const res = await submit(app, { key });
      assertProblem(
        res,
        400,
        'idempotency-key-missing',
        'Idempotency-Key header is required',
      );
    });
  }
});

describe('who may call it', () => {
  test('no token gives 401', async () => {
    const { app } = setup();
    assertProblem(
      await submit(app, { auth: null }),
      401,
      'unauthenticated',
      'Authentication required',
    );
  });

  test('a token signed with another secret gives 401', async () => {
    const { app } = setup();
    const bad = await token(
      { sub: 's1', role: 'student' },
      { secret: 'another-secret-0123456789abcdef' },
    );
    assertProblem(
      await submit(app, { auth: `Bearer ${bad}` }),
      401,
      'unauthenticated',
      'Authentication required',
    );
  });

  test('an expired token gives 401', async () => {
    const { app } = setup();
    const old = await token({ sub: 's1', role: 'student' }, { exp: 1_000_000 });
    assertProblem(
      await submit(app, { auth: `Bearer ${old}` }),
      401,
      'unauthenticated',
      'Authentication required',
    );
  });

  test('a token without a valid role claim gives 401', async () => {
    const { app } = setup();
    const t = await token({ sub: 's1', role: 'root' });
    assertProblem(
      await submit(app, { auth: `Bearer ${t}` }),
      401,
      'unauthenticated',
      'Authentication required',
    );
  });

  for (const role of ['ta', 'admin']) {
    test(`role ${role} gives 403 forbidden-role`, async () => {
      const { app } = setup();
      assertProblem(
        await submit(app, { role }),
        403,
        'forbidden-role',
        'Only students may submit',
      );
    });
  }

  test('401 wins over a missing Idempotency-Key', async () => {
    const { app } = setup();
    assertProblem(
      await submit(app, { auth: null, key: null }),
      401,
      'unauthenticated',
      'Authentication required',
    );
  });
});

describe('ownership', () => {
  test('an unknown lab gives 404 lab-not-found', async () => {
    const { app } = setup();
    assertProblem(
      await submit(app, { lab: 'lab-nope' }),
      404,
      'lab-not-found',
      'Lab not found',
    );
  });

  test("a lab in another student's class gives the same 404", async () => {
    const { app } = setup();
    const res = await submit(app, { lab: 'lab-other', sub: 's1' });
    assertProblem(res, 404, 'lab-not-found', 'Lab not found');
    const own = await submit(app, { lab: 'lab-other', sub: 's2' });
    assert.equal(own.status, 202);
  });
});

describe('lab state', () => {
  test('a lab past its deadline gives 409 lab-closed', async () => {
    const { app } = setup();
    assertProblem(
      await submit(app, { lab: 'lab-past' }),
      409,
      'lab-closed',
      'Lab is closed for submissions',
    );
  });
});

describe('body rules', () => {
  /** @type {Array<[string, unknown]>} */
  const cases = [
    ['missing source', { language: 'cpp' }],
    ['missing language', { source: 'x' }],
    ['language other than cpp', { language: 'python', source: 'x' }],
    ['empty source', { language: 'cpp', source: '' }],
    [
      'source over 65536 UTF-8 bytes',
      { language: 'cpp', source: 'é'.repeat(32_769) },
    ],
    ['unknown field', { ...BODY, studentId: 's3' }],
    ['array body', [BODY]],
  ];
  for (const [name, body] of cases) {
    test(`${name} gives 400 validation-error with errors[]`, async () => {
      const { app } = setup();
      const res = await submit(app, { body });
      assertProblem(res, 400, 'validation-error', 'Request body is invalid');
      assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
      for (const e of res.body.errors) {
        assert.equal(typeof e.path, 'string');
        assert.equal(typeof e.message, 'string');
      }
    });
  }

  test('source of exactly 65536 UTF-8 bytes is accepted', async () => {
    const { app } = setup();
    const res = await submit(app, {
      body: { language: 'cpp', source: 'é'.repeat(32_768) },
    });
    assert.equal(res.status, 202);
  });

  test('malformed JSON gives 400 validation-error', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/labs/lab-open/submissions')
      .set(
        'Authorization',
        `Bearer ${await token({ sub: 's1', role: 'student' })}`,
      )
      .set('Idempotency-Key', 'key-1')
      .set('Content-Type', 'application/json')
      .send('{"language": "cpp",');
    assertProblem(res, 400, 'validation-error', 'Request body is invalid');
  });

  test('a body over 256 KiB gives 413 payload-too-large', async () => {
    const { app } = setup();
    const res = await submit(app, {
      body: { language: 'cpp', source: 'x'.repeat(300 * 1024) },
    });
    assertProblem(res, 413, 'payload-too-large', 'Request body is too large');
  });
});
