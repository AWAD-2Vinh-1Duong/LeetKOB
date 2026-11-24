import { randomUUID } from 'node:crypto';

/**
 * Gives every request an id (the caller's `x-request-id`, or a new one), echoes it
 * in the response and puts a logger carrying it on `req.log`.
 * @param {{ logger: import('pino').Logger }} deps
 * @returns {import('express').RequestHandler}
 */
export function createRequestContext({ logger }) {
  return (req, res, next) => {
    const rawId = req.headers['x-request-id'] || randomUUID();
    const reqId = Array.isArray(rawId) ? rawId[0] : rawId;
    /** @type {any} */ (req).id = reqId;
    /** @type {any} */ (req).log = logger.child({ reqId });
    res.setHeader('x-request-id', reqId);
    next();
  };
}
