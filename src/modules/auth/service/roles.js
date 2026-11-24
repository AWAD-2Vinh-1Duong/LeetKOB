import { ProblemError } from '../../../shared/problems.js';

/**
 * Throws `403 staff-only` for a student. Admins and TAs pass.
 * @param {{ role: 'admin' | 'ta' | 'student' }} user
 * @param {string} detail
 */
export function assertStaff(user, detail) {
  if (user.role === 'student') throw new ProblemError('staff-only', detail);
}
