import { randomUUID } from 'node:crypto';
import { assertStaff } from '../auth/roles.js';
import { ProblemError } from '../shared/problems.js';

/** @typedef {import('./labs.repository.js').Lab} Lab */
/** @typedef {import('./labs.repository.js').Viewer} Viewer */

export class LabService {
  /** @param {{ labRepository: import('./labs.repository.js').LabRepository }} deps */
  constructor({ labRepository }) {
    this.labRepository = labRepository;
  }

  /**
   * The lab, or 404 for one that is missing and for one the caller cannot see, so
   * a TA of another class cannot tell that the lab exists.
   * @param {Viewer} user
   * @param {string} labId
   * @returns {Promise<Lab>}
   */
  async getVisible(user, labId) {
    const lab = await this.labRepository.findForUser(labId, user);
    if (!lab) {
      throw new ProblemError(
        'lab-not-found',
        `No lab "${labId}" is open to you.`,
      );
    }
    return lab;
  }

  /**
   * Creates a lab. A TA of another class and a class that does not exist get the same error.
   * @param {Viewer} user
   * @param {{
   *   classId: string, title: string, statement: string,
   *   tests: Array<{ input: string, expectedOutput: string }>,
   *   constraints: Array<{ text: string, deduction: number }>,
   *   deadline: Date,
   * }} input
   * @returns {Promise<Lab>}
   */
  async create(user, input) {
    assertStaff(user, 'Only TAs and admins create labs.');
    if (!(await this.labRepository.canManageClass(user, input.classId))) {
      throw new ProblemError(
        'class-not-found',
        `No class "${input.classId}" is open to you.`,
      );
    }
    return this.labRepository.create({
      id: randomUUID(),
      classId: input.classId,
      title: input.title,
      statement: input.statement,
      tests: input.tests,
      constraints: input.constraints.map((c, i) => ({
        id: `c${i + 1}`,
        text: c.text,
        deduction: c.deduction,
      })),
      deadline: input.deadline,
    });
  }

  /**
   * Who may open the review queue. The lab check comes first (404), then the role (403).
   * The verdicts themselves are added by the review-queue work.
   * @param {Viewer} user
   * @param {string} labId
   * @returns {Promise<{ items: unknown[] }>}
   */
  async openReviewQueue(user, labId) {
    await this.getVisible(user, labId);
    assertStaff(user, 'Only TAs and admins open the review queue.');
    return { items: [] };
  }
}
