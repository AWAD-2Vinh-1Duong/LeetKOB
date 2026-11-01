// RFC 9457 problem types. Slugs and titles are fixed by the endpoint contracts in docs/contract/.
export const PROBLEMS = /** @type {const} */ ({
  'validation-error': { status: 400, title: 'Request body is invalid' },
  'idempotency-key-missing': {
    status: 400,
    title: 'Idempotency-Key header is required',
  },
  unauthenticated: { status: 401, title: 'Authentication required' },
  'forbidden-role': { status: 403, title: 'Only students may submit' },
  'lab-not-found': { status: 404, title: 'Lab not found' },
  'lab-closed': { status: 409, title: 'Lab is closed for submissions' },
  'payload-too-large': { status: 413, title: 'Request body is too large' },
  'idempotency-key-reused': {
    status: 422,
    title: 'Idempotency-Key was used with a different request',
  },
  'internal-error': { status: 500, title: 'Internal server error' },
});

/** @typedef {keyof typeof PROBLEMS} ProblemSlug */

export class ProblemError extends Error {
  /**
   * @param {ProblemSlug} slug
   * @param {string} detail
   * @param {Record<string, unknown>} [extensions]
   */
  constructor(slug, detail, extensions = {}) {
    super(detail);
    this.slug = slug;
    this.extensions = extensions;
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {ProblemError} err
 */
export function sendProblem(req, res, err) {
  const { status, title } = PROBLEMS[err.slug];
  res
    .status(status)
    .type('application/problem+json')
    .send(
      JSON.stringify({
        type: `https://leettkob.dev/problems/${err.slug}`,
        title,
        status,
        detail: err.message,
        instance: req.originalUrl.split('?')[0],
        ...err.extensions,
      }),
    );
}
