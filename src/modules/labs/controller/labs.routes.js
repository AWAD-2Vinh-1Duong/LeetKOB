import express from 'express';

/**
 * Mounted at `/labs`.
 * @param {{
 *   controller: import('./labs.controller.js').LabsController,
 *   requireAuth: import('express').RequestHandler,
 * }} deps
 */
export function createLabsRouter({ controller, requireAuth }) {
  const router = express.Router();
  router.post(
    '/',
    requireAuth,
    express.json({ limit: '256kb', strict: false }),
    controller.create,
  );
  router.get('/:labId', requireAuth, controller.get);
  router.get('/:labId/review-queue', requireAuth, controller.reviewQueue);
  router.put(
    '/:labId/review-queue/:verdictId',
    requireAuth,
    express.json({ limit: '16kb', strict: false }),
    controller.decide,
  );
  return router;
}
