import { ProblemError } from '../shared/problems.js';

const IDEMPOTENCY_KEY = /^[\x21-\x7E]{1,255}$/;

/** @type {import('express').RequestHandler} */
export const requireIdempotencyKey = (req, res, next) => {
  const idempotencyKey = req.get('idempotency-key') ?? '';
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
    throw new ProblemError(
      'idempotency-key-missing',
      'Send an Idempotency-Key of 1-255 printable ASCII characters.',
    );
  }
  res.locals.idempotencyKey = idempotencyKey;
  next();
};
