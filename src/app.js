import express from 'express';
import { createContainer } from './container.js';
import { createAuthRouter } from './modules/auth/controller/auth.routes.js';
import { createLabsRouter } from './modules/labs/controller/labs.routes.js';
import { createSubmissionsRouter } from './modules/submissions/controller/submissions.routes.js';
import { createRequestContext } from './middlewares/request-context.middleware.js';
import { createErrorHandler } from './middlewares/error-handler.middleware.js';

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
