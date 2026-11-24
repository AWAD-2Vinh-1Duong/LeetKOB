import express from 'express';

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
    express.json({ limit: '256kb', strict: false }),
    controller.create,
  );
  router.get('/submissions/:id', requireAuth, controller.get);
  return router;
}
