import { ProblemError } from '../shared/problems.js';

/**
 * Rejects a caller whose role is not listed. Use it only for checks that need no data;
 * "may this TA see this lab" belongs in a service.
 * @param {{ roles: Array<'admin' | 'ta' | 'student'>,
 *           slug: import('../shared/problems.js').ProblemSlug,
 *           detail: (role: string) => string }} opts
 * @returns {import('express').RequestHandler}
 */
export function requireRole({ roles, slug, detail }) {
  return (req, res, next) => {
    const { role } = res.locals.user;
    if (!roles.includes(role)) throw new ProblemError(slug, detail(role));
    next();
  };
}
