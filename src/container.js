import pino from 'pino';
import { createAuthMiddleware } from './middlewares/require-auth.middleware.js';
import { AuthController } from './modules/auth/controller/auth.controller.js';
import { AuthService } from './modules/auth/service/auth.service.js';
import { PostgresUserRepository } from './modules/auth/repository/users.repository.postgres.js';
import { LabsController } from './modules/labs/controller/labs.controller.js';
import { LabService } from './modules/labs/service/labs.service.js';
import { PostgresLabRepository } from './modules/labs/repository/labs.repository.postgres.js';
import { SubmissionsController } from './modules/submissions/controller/submissions.controller.js';
import { SubmissionService } from './modules/submissions/service/submissions.service.js';
import { PostgresSubmissionRepository } from './modules/submissions/repository/submissions.repository.postgres.js';

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
}) {
  if (!labRepository || !submissionRepository) {
    throw new Error(
      'labRepository and submissionRepository must be provided or pool specified',
    );
  }

  return {
    logger,
    requireAuth: createAuthMiddleware({ secret: jwtSecret }),
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
          now,
        }),
      }),
    },
  };
}
