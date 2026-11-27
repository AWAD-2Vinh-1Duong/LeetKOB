import pino from 'pino';
import { createRequireAuth } from './middlewares/require-auth.middleware.js';
import { AuthController } from './modules/auth/controller/auth.controller.js';
import { AuthService } from './modules/auth/service/auth.service.js';
import { PostgresUserRepository } from './modules/auth/repository/users.repository.postgres.js';
import { LabsController } from './modules/labs/controller/labs.controller.js';
import { LabService } from './modules/labs/service/labs.service.js';
import { PostgresLabRepository } from './modules/labs/repository/labs.repository.postgres.js';
import { SubmissionsController } from './modules/submissions/controller/submissions.controller.js';
import { SubmissionService } from './modules/submissions/service/submissions.service.js';
import { PostgresSubmissionRepository } from './modules/submissions/repository/submissions.repository.postgres.js';
import { PostgresJudgeJobsRepository } from './modules/grading/repository/judge-jobs.repository.postgres.js';
import { JudgeWorkerService } from './modules/grading/service/judge-worker.service.js';

/**
 * The composition root: the only file that decides which implementation backs
 * which interface and that calls `new` on repositories, services and controllers.
 * Nothing else imports a `*.repository.postgres.js` or `*.repository.memory.js` file.
 *
 * Pass a `pool` for PostgreSQL, or pass repositories (tests pass in-memory ones).
 * A repository you pass always wins over the one built from `pool`.
 *
 * @param {{
 *   jwtSecret: string,
 *   now?: () => Date,
 *   logger?: import('pino').Logger,
 *   pool?: import('pg').Pool,
 *   labRepository?: import('./modules/labs/repository/labs.repository.js').LabRepository,
 *   submissionRepository?: import('./modules/submissions/repository/submissions.repository.js').SubmissionRepository,
 *   userRepository?: import('./modules/auth/repository/users.repository.js').UserRepository,
 *   judgeJobsRepository?: import('./modules/grading/repository/judge-jobs.repository.js').JudgeJobsRepository,
 * }} deps
 */
export function createContainer({
  jwtSecret,
  now = () => new Date(),
  logger = pino({ level: process.env.LOG_LEVEL || 'silent' }),
  pool,
  labRepository = pool && new PostgresLabRepository({ pool }),
  submissionRepository = pool && new PostgresSubmissionRepository({ pool }),
  userRepository = pool && new PostgresUserRepository({ pool }),
  judgeJobsRepository = pool && new PostgresJudgeJobsRepository({ pool }),
}) {
  if (!labRepository || !submissionRepository) {
    throw new Error(
      'labRepository and submissionRepository must be provided or pool specified',
    );
  }

  return {
    logger,
    requireAuth: createRequireAuth({ secret: jwtSecret, now }),
    controllers: {
      // Without a user repository there is no login route (some tests build the app without one).
      auth: userRepository
        ? new AuthController({
            authService: new AuthService({ userRepository, jwtSecret, now }),
          })
        : undefined,
      labs: new LabsController({
        labService: new LabService({ labRepository }),
      }),
      submissions: new SubmissionsController({
        submissionService: new SubmissionService({
          labRepository,
          submissionRepository,
          judgeJobsRepository,
          now,
        }),
      }),
    },
  };
}

/**
 * Composition root for the isolated background worker process.
 * @param {{
 *   pool?: import('pg').Pool,
 *   judgeJobsRepository?: import('./modules/grading/repository/judge-jobs.repository.js').JudgeJobsRepository,
 *   judge?: import('./modules/grading/service/judge-worker.service.js').Judge | null,
 *   sandboxRunner?: import('./modules/grading/service/judge-worker.service.js').SandboxRunner | null,
 *   evaluator?: import('./modules/grading/service/judge-worker.service.js').SubmissionEvaluator,
 *   workerId?: string,
 *   pollIntervalMs?: number,
 *   logger?: import('pino').Logger,
 *   now?: () => Date,
 * }} deps
 */
export function createWorkerContainer({
  pool,
  judgeJobsRepository = pool && new PostgresJudgeJobsRepository({ pool }),
  judge = null,
  sandboxRunner = null,
  evaluator,
  workerId,
  pollIntervalMs = 500,
  logger = pino({ level: process.env.LOG_LEVEL || 'silent' }),
  now = () => new Date(),
}) {
  if (!judgeJobsRepository) {
    throw new Error('judgeJobsRepository or pool must be provided');
  }
  const worker = new JudgeWorkerService({
    judgeJobsRepository,
    judge,
    sandboxRunner,
    evaluator,
    workerId,
    pollIntervalMs,
    logger,
    now,
  });
  return { worker, judgeJobsRepository, logger };
}
