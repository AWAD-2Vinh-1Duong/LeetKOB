import { SignJWT, jwtVerify } from 'jose';
import { ProblemError } from '../../../shared/problems.js';

export const TOKEN_TTL_SECONDS = 3600;

/**
 * HS256 bearer token with `sub`, `role` and `exp`.
 * @param {{ sub: string, role: 'admin' | 'ta' | 'student' }} claims
 * @param {{ secret: string, now: Date }} opts
 * @returns {Promise<string>}
 */
export function signToken({ sub, role }, { secret, now }) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sub, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(secret));
}

const ROLES = new Set(['admin', 'ta', 'student']);

/** @typedef {{ id: string, role: 'admin' | 'ta' | 'student' }} AuthUser */

/**
 * Verifies a bearer token and returns the caller.
 * @param {string} token
 * @param {{ secret: string, now?: Date }} opts the same clock that signs tokens, so `exp` is judged consistently
 * @returns {Promise<AuthUser>}
 */
export async function verifyToken(token, { secret, now }) {
  const key = new TextEncoder().encode(secret);
  let payload;
  try {
    ({ payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      requiredClaims: ['exp'],
      currentDate: now,
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
  return { id: sub, role: /** @type {AuthUser['role']} */ (role) };
}
