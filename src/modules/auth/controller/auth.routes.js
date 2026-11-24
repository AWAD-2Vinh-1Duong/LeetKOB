import express from 'express';

/**
 * Mounted at `/auth`.
 * @param {{ controller: import('./auth.controller.js').AuthController }} deps
 */
export function createAuthRouter({ controller }) {
  const router = express.Router();
  router.post(
    '/login',
    express.json({ limit: '4kb', strict: false }),
    controller.login,
  );
  return router;
}
