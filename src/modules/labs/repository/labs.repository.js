/**
 * The lab store, as the rest of the app sees it. Two implementations exist:
 * `labs.repository.memory.js` (tests) and `labs.repository.postgres.js`.
 * Only `src/container.js` may import an implementation.
 *
 * @typedef {{ id: string, text: string, deduction: number }} LabConstraint
 * @typedef {{
 *   id: string, classId: string, deadline: Date,
 *   title?: string, statement?: string,
 *   tests?: Array<{ input: string, expectedOutput: string }>,
 *   constraints?: LabConstraint[],
 * }} Lab
 * @typedef {{ id: string, role: 'admin' | 'ta' | 'student' }} Viewer
 * @typedef {{
 *   findForStudent(labId: string, studentId: string): Promise<Lab | undefined>,
 *   findForUser(labId: string, viewer: Viewer): Promise<Lab | undefined>,
 *   canManageClass(viewer: Viewer, classId: string): Promise<boolean>,
 *   create(lab: Lab): Promise<Lab>,
 * }} LabRepository
 */

export {};
