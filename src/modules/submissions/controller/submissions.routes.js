import express from 'express';
import { jsonBody, requireRole } from '../../../middlewares/index.js';

/**
 * Mounted at `/`: the two paths start under different roots (`/labs/...` and `/submissions/...`).
 * @param {{
 *   controller: import('./submissions.controller.js').SubmissionsController,
 *   requireAuth: import('express').RequestHandler,
 * }} deps
 */
export function createSubmissionsRouter({ controller, requireAuth }) {
  const router = express.Router();
  router.post(
    '/labs/:labId/submissions',
    requireAuth,
    requireRole({
      roles: ['student'],
      slug: 'forbidden-role',
      detail: (role) => `Role "${role}" cannot submit.`,
    }),
    jsonBody({ limit: '256kb' }),
    controller.create,
  );
  router.get('/submissions/:id', requireAuth, controller.get);
  return router;
}
