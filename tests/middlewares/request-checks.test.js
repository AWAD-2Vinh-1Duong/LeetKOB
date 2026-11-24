import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import {
  createErrorHandler,
  requireIdempotencyKey,
  requireRole,
} from '../../src/middlewares/index.js';

/** @param {import('express').RequestHandler[]} handlers */
function appWith(...handlers) {
  const app = express();
  app.post('/', ...handlers);
  app.use(createErrorHandler({ logger: pino({ level: 'silent' }) }));
  return request(app);
}

/** @param {'ta' | 'student'} role */
function submitAs(role) {
  return appWith(
    (_req, res, next) => {
      res.locals.user = { id: 'user-1', role };
      next();
    },
    requireRole({
      roles: ['student'],
      slug: 'forbidden-role',
      detail: (role) => `Role "${role}" cannot submit.`,
    }),
    (_req, res) => res.sendStatus(204),
  ).post('/');
}

test('requireRole forwards an allowed role', async () => {
  await submitAs('student').expect(204);
});

test('requireRole returns a problem for a forbidden role', async () => {
  const res = await submitAs('ta')
    .expect(403)
    .expect('Content-Type', /application\/problem\+json/);
  assert.deepEqual(res.body, {
    type: 'https://leettkob.dev/problems/forbidden-role',
    title: 'Only students may submit',
    status: 403,
    detail: 'Role "ta" cannot submit.',
    instance: '/',
  });
});

/** @param {string} [key] */
function submitWithKey(key) {
  const req = appWith(requireIdempotencyKey, (_req, res) =>
    res.json({ key: res.locals.idempotencyKey }),
  ).post('/');
  return key === undefined ? req : req.set('Idempotency-Key', key);
}

test('requireIdempotencyKey passes the header through res.locals', async () => {
  await submitWithKey('key-1').expect(200, { key: 'key-1' });
});

for (const [label, key] of [
  ['missing', undefined],
  ['too long', 'x'.repeat(256)],
]) {
  test(`requireIdempotencyKey returns a problem when the key is ${label}`, async () => {
    const res = await submitWithKey(key)
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/);
    assert.deepEqual(res.body, {
      type: 'https://leettkob.dev/problems/idempotency-key-missing',
      title: 'Idempotency-Key header is required',
      status: 400,
      detail: 'Send an Idempotency-Key of 1-255 printable ASCII characters.',
      instance: '/',
    });
  });
}
