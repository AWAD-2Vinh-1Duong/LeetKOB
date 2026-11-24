import { SignJWT } from 'jose';

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
