import express from 'express';
import { createContainer } from './container.js';
import { createAuthRouter } from './auth/auth.routes.js';
import { createLabsRouter } from './labs/labs.routes.js';
import { createSubmissionsRouter } from './submissions/submissions.routes.js';
import { createRequestContext } from './shared/request-context.js';
import { createErrorHandler } from './shared/error-handler.js';

/**
 * Builds the Express app. It only wires HTTP: request context, the routers, the error
 * handler. Objects come from the container; routes live in each feature's `*.routes.js`.
 * @param {Parameters<typeof createContainer>[0]} deps
 */
export function createApp(deps) {
  const { logger, requireAuth, controllers } = createContainer(deps);

  const app = express();
  app.disable('x-powered-by');
  app.use(createRequestContext({ logger }));

  if (controllers.auth) {
    app.use('/auth', createAuthRouter({ controller: controllers.auth }));
  }
  app.use(
    '/labs',
    createLabsRouter({ controller: controllers.labs, requireAuth }),
  );
  app.use(
    createSubmissionsRouter({
      controller: controllers.submissions,
      requireAuth,
    }),
  );

  app.use(createErrorHandler({ logger }));
  return app;
}
