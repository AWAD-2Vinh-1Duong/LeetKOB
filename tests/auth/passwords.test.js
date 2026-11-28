import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
} from '../../src/modules/auth/service/passwords.js';

describe('passwords (scrypt)', () => {
  test('the stored value is not the password', async () => {
    const stored = await hashPassword('hunter2-correct-horse');
    assert.ok(!stored.includes('hunter2-correct-horse'));
    assert.match(stored, /^scrypt\$/);
  });

  test('the right password verifies', async () => {
    const stored = await hashPassword('s3cret-pass');
    assert.equal(await verifyPassword('s3cret-pass', stored), true);
  });

  test('a wrong password does not verify', async () => {
    const stored = await hashPassword('s3cret-pass');
    assert.equal(await verifyPassword('s3cret-pasS', stored), false);
    assert.equal(await verifyPassword('', stored), false);
  });

  test('the same password hashes differently each time (salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    assert.notEqual(a, b);
    assert.equal(await verifyPassword('same-password', a), true);
    assert.equal(await verifyPassword('same-password', b), true);
  });

  test('a malformed stored value is false, not a crash', async () => {
    assert.equal(await verifyPassword('x', ''), false);
    assert.equal(await verifyPassword('x', 'plain-text'), false);
    assert.equal(await verifyPassword('x', 'scrypt$only-two'), false);
    assert.equal(await verifyPassword('x', 'scrypt$zz$zz$zz'), false);
  });
});
