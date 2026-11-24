import express from 'express';
import {
  jsonBody,
  requireIdempotencyKey,
  requireRole,
} from '../../../middlewares/index.js';

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
    // Step 1: Authenticate the caller.
    requireAuth,
    // Step 2: Require the student role.
    requireRole({
      roles: ['student'],
      slug: 'forbidden-role',
      detail: (role) => `Role "${role}" cannot submit.`,
    }),
    // Step 3: Enforce the size limit and parse JSON.
    jsonBody({ limit: '256kb' }),
    // Step 4: Require a valid Idempotency-Key.
    requireIdempotencyKey,
    controller.create,
  );
  router.get('/submissions/:id', requireAuth, controller.get);
  return router;
}
