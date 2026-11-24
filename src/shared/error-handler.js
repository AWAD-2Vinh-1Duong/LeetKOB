import { ProblemError, sendProblem } from './problems.js';

/**
 * The one place errors become responses. Anything that is not a known problem is
 * logged and sent as a 500 that leaks nothing.
 * @param {{ logger: import('pino').Logger }} deps
 * @returns {import('express').ErrorRequestHandler}
 */
export function createErrorHandler({ logger }) {
  // eslint-disable-next-line no-unused-vars -- Express spots error handlers by their 4 arguments
  return (err, req, res, _next) => {
    if (err instanceof ProblemError) return sendProblem(req, res, err);
    if (err?.type === 'entity.too.large') {
      return sendProblem(
        req,
        res,
        new ProblemError('payload-too-large', 'The body exceeds 256 KiB.'),
      );
    }
    if (err?.type === 'entity.parse.failed') {
      return sendProblem(
        req,
        res,
        new ProblemError('validation-error', 'The body is not valid JSON.', {
          errors: [{ path: '', message: 'Malformed JSON' }],
        }),
      );
    }
    const reqId = /** @type {any} */ (req)?.id;
    logger.error({ err, reqId }, 'Unhandled error');
    sendProblem(
      req,
      res,
      new ProblemError('internal-error', 'Something went wrong.'),
    );
  };
}
