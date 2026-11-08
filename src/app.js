import express from 'express';
import { createAuthMiddleware } from './middlewares/auth.js';
import { SubmissionsController } from './controllers/submissions-controller.js';
import { SubmissionService } from './services/submission-service.js';
import { ProblemError, sendProblem } from './problems.js';

/**
 * Wires the app. Repositories and the clock are injected so tests run without a database.
 * @param {{
 *   jwtSecret: string,
 *   labRepository: import('./repositories/in-memory.js').InMemoryLabRepository,
 *   submissionRepository: import('./repositories/in-memory.js').InMemorySubmissionRepository,
 *   now?: () => Date,
 * }} deps
 */
export function createApp({
  jwtSecret,
  labRepository,
  submissionRepository,
  now = () => new Date(),
}) {
  const submissions = new SubmissionsController({
    submissionService: new SubmissionService({
      labRepository,
      submissionRepository,
      now,
    }),
  });

  const app = express();
  app.disable('x-powered-by');
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
    // shortcut: no pino logger yet, unexpected errors are swallowed; wire pino with request ids before PA#3.
    sendProblem(
      req,
      res,
      new ProblemError('internal-error', 'Something went wrong.'),
    );
  };
  app.use(onError);

  return app;
}
