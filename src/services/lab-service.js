import { randomUUID } from 'node:crypto';
import { ProblemError } from '../problems.js';

/** @typedef {import('../repositories/in-memory.js').Lab} Lab */

export class LabService {
  /**
   * @param {{
   *   labRepository: {
   *     canManageClass(viewer: import('../repositories/in-memory.js').Viewer, classId: string): Promise<boolean>,
   *     create(lab: Lab): Promise<Lab>,
   *   },
   * }} deps
   */
  constructor({ labRepository }) {
    this.labRepository = labRepository;
  }

  /**
   * Creates a lab. A TA of another class and a class that does not exist get the same error.
   * @param {import('../repositories/in-memory.js').Viewer} user
   * @param {{
   *   classId: string, title: string, statement: string,
   *   tests: Array<{ input: string, expectedOutput: string }>,
   *   constraints: Array<{ text: string, deduction: number }>,
   *   deadline: Date,
   * }} input
   * @returns {Promise<Lab>}
   */
  async create(user, input) {
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
}
