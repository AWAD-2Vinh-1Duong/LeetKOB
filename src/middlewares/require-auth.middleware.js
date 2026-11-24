import { ProblemError } from '../shared/problems.js';

import { verifyToken } from '../modules/auth/service/tokens.js';

/**
 * Verifies the HS256 bearer token and puts the caller on `res.locals.user`.
 * @param {{ secret: string }} deps
 * @returns {import('express').RequestHandler}
 */
export function createRequireAuth({ secret }) {
  return async (req, res, next) => {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new ProblemError('unauthenticated', 'A bearer token is required.');
    }
    res.locals.user = await verifyToken(token, { secret });
    next();
  };
}
