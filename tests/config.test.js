import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const env = {
    JWT_SECRET: 'a-test-secret-that-is-long-enough-0123456789',
    DATABASE_URL: 'postgres://localhost/test',
  };

  test('reads the required values and defaults the rest', () => {
    const c = loadConfig(env);
    assert.equal(c.jwtSecret, env.JWT_SECRET);
    assert.equal(c.databaseUrl, env.DATABASE_URL);
    assert.equal(c.port, 3000);
    assert.equal(c.logLevel, 'info');
  });

  test('PORT and LOG_LEVEL override the defaults', () => {
    const c = loadConfig({ ...env, PORT: '8080', LOG_LEVEL: 'debug' });
    assert.equal(c.port, 8080);
    assert.equal(c.logLevel, 'debug');
  });

  test('a missing JWT_SECRET names the variable', () => {
    assert.throws(
      () => loadConfig({ DATABASE_URL: env.DATABASE_URL }),
      /JWT_SECRET/,
    );
  });

  test('a missing DATABASE_URL names the variable', () => {
    assert.throws(
      () => loadConfig({ JWT_SECRET: env.JWT_SECRET }),
      /DATABASE_URL/,
    );
  });

  test('a JWT_SECRET shorter than 32 characters is refused', () => {
    assert.throws(
      () => loadConfig({ ...env, JWT_SECRET: 'short' }),
      /JWT_SECRET/,
    );
  });

  test('a PORT that is not a number is refused', () => {
    assert.throws(() => loadConfig({ ...env, PORT: 'abc' }), /PORT/);
  });

  test('the error never contains the secret value', () => {
    try {
      loadConfig({ ...env, JWT_SECRET: 'short-secret-value' });
      assert.fail('should throw');
    } catch (e) {
      assert.ok(
        !String(/** @type {Error} */ (e).message).includes(
          'short-secret-value',
        ),
      );
    }
  });
});
