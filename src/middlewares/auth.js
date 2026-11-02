import { jwtVerify } from 'jose';
import { ProblemError } from '../problems.js';

const ROLES = new Set(['admin', 'ta', 'student']);

/** @typedef {{ id: string, role: 'admin' | 'ta' | 'student' }} AuthUser */

/**
 * Verifies the HS256 bearer token and puts the caller on `res.locals.user`.
 * @param {{ secret: string }} deps
 * @returns {import('express').RequestHandler}
 */
export function createAuthMiddleware({ secret }) {
  const key = new TextEncoder().encode(secret);
  return async (req, res, next) => {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new ProblemError('unauthenticated', 'A bearer token is required.');
    }
    let payload;
    try {
      ({ payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        requiredClaims: ['exp'],
      }));
    } catch {
      throw new ProblemError(
        'unauthenticated',
        'The bearer token is invalid or expired.',
      );
    }
    const { sub, role } = payload;
    if (
      typeof sub !== 'string' ||
      sub === '' ||
      typeof role !== 'string' ||
      !ROLES.has(role)
    ) {
      throw new ProblemError(
        'unauthenticated',
        'The bearer token lacks a valid sub or role.',
      );
    }
    res.locals.user = /** @type {AuthUser} */ ({ id: sub, role });
    next();
  };
}
