import { randomUUID } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import { createAuthMiddleware } from './middlewares/auth.js';
import { SubmissionsController } from './controllers/submissions-controller.js';
import { SubmissionService } from './services/submission-service.js';
import { ProblemError, sendProblem } from './problems.js';
import {
  PostgresLabRepository,
  PostgresSubmissionRepository,
} from './repositories/postgres.js';

/**
 * Wires the app. Repositories and the clock are injected so tests run without a database.
 * @param {{
 *   jwtSecret: string,
 *   labRepository?: import('./repositories/in-memory.js').InMemoryLabRepository | import('./repositories/postgres.js').PostgresLabRepository,
 *   submissionRepository?: import('./repositories/in-memory.js').InMemorySubmissionRepository | import('./repositories/postgres.js').PostgresSubmissionRepository,
 *   pool?: import('pg').Pool,
 *   logger?: import('pino').Logger,
 *   now?: () => Date,
 * }} deps
 */
export function createApp({
  jwtSecret,
  labRepository,
  submissionRepository,
  pool,
  logger = pino({ level: process.env.LOG_LEVEL || 'silent' }),
  now = () => new Date(),
}) {
  if (pool) {
    labRepository = labRepository ?? new PostgresLabRepository({ pool });
    submissionRepository =
      submissionRepository ?? new PostgresSubmissionRepository({ pool });
  }

  if (!labRepository || !submissionRepository) {
    throw new Error(
      'labRepository and submissionRepository must be provided or pool specified',
    );
  }

  const submissions = new SubmissionsController({
    submissionService: new SubmissionService({
      labRepository,
      submissionRepository,
      now,
    }),
  });

  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const rawId = req.headers['x-request-id'] || randomUUID();
    const reqId = Array.isArray(rawId) ? rawId[0] : rawId;
    /** @type {any} */ (req).id = reqId;
    /** @type {any} */ (req).log = logger.child({ reqId });
    res.setHeader('x-request-id', reqId);
    next();
  });

  app.post(
    '/labs/:labId/submissions',
    createAuthMiddleware({ secret: jwtSecret }),
    express.json({ limit: '256kb', strict: false }),
    submissions.create,
  );

  /** @type {import('express').ErrorRequestHandler} */
  // eslint-disable-next-line no-unused-vars -- Express spots error handlers by their 4 arguments
  const onError = (err, req, res, _next) => {
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
  app.use(onError);

  return app;
}
