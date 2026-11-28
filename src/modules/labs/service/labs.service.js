import { randomUUID } from 'node:crypto';
import { assertStaff } from '../../auth/service/roles.js';
import { ProblemError } from '../../../shared/problems.js';

/** @typedef {import('../repository/labs.repository.js').Lab} Lab */
/** @typedef {import('../repository/labs.repository.js').Viewer} Viewer */
/** @typedef {import('../../grading/repository/judge-jobs.repository.js').ReviewRow} ReviewRow */
/** @typedef {import('../../grading/repository/judge-jobs.repository.js').Decision} Decision */
/** @typedef {Omit<ReviewRow, 'proposal' | 'decision'> & { constraint: string, deduction: number, proposal: ReviewRow['proposal'], decision: Decision | null }} ReviewItem */

export class LabService {
  /**
   * @param {{
   *   labRepository: import('../repository/labs.repository.js').LabRepository,
   *   judgeJobsRepository?: import('../../grading/repository/judge-jobs.repository.js').JudgeJobsRepository,
   *   now?: () => Date,
   * }} deps
   */
  constructor({ labRepository, judgeJobsRepository, now = () => new Date() }) {
    this.labRepository = labRepository;
    this.judgeJobsRepository = judgeJobsRepository;
    this.now = now;
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
   * The lab, if the caller may work on its review queue: the lab check first (404), then
   * the role (403).
   * @param {Viewer} user
   * @param {string} labId
   * @returns {Promise<Lab>}
   */
  async getReviewable(user, labId) {
    const lab = await this.getVisible(user, labId);
    assertStaff(user, 'Only TAs and admins open the review queue.');
    return lab;
  }

  /**
   * Every stored verdict of the lab, with the constraint text and the deduction the TA set.
   * shortcut: lists every verdict; FAQ-10 asks for all violations, all unsure and a 10% sample
   * of the passes, which comes with the Publish work (PA#4).
   * @param {Viewer} user
   * @param {string} labId
   * @returns {Promise<{ items: ReviewItem[] }>}
   */
  async openReviewQueue(user, labId) {
    const lab = await this.getReviewable(user, labId);
    if (!this.judgeJobsRepository) return { items: [] };
    const rows = await this.judgeJobsRepository.findReviewQueue(lab.id);
    return { items: rows.map((row) => toItem(lab, row)) };
  }

  /**
   * Records a TA decision. Only a decision carries a deduction, always the constraint's own.
   * shortcut: a new decision replaces the old one with no history; FAQ-10 asks for a log of
   * who changed what, which needs its own table (PA#4).
   * @param {Viewer} user
   * @param {Lab} lab a lab from `getReviewable`
   * @param {string} verdictId
   * @param {{ verdict: 'pass' | 'violation', evidenceLines?: number[] }} input
   * @returns {Promise<ReviewItem>}
   */
  async decide(user, lab, verdictId, input) {
    const row = await this.judgeJobsRepository?.findReviewRow(
      lab.id,
      verdictId,
    );
    if (!row || !this.judgeJobsRepository) {
      throw new ProblemError(
        'verdict-not-found',
        `No verdict "${verdictId}" in lab "${lab.id}".`,
      );
    }
    const lines = row.source.split('\n');
    const evidence = [];
    for (const line of new Set(input.evidenceLines ?? [])) {
      const text = (lines[line - 1] ?? '').replace(/\r$/, '');
      if (line < 1 || text.trim() === '') {
        throw new ProblemError(
          'evidence-not-in-source',
          `Line ${line} is not a non-blank line of the submitted source.`,
        );
      }
      evidence.push({ line, text });
    }
    const constraint = lab.constraints?.find((c) => c.id === row.constraintId);
    /** @type {Decision} */
    const decision = {
      verdict: input.verdict,
      evidence,
      deduction:
        input.verdict === 'violation' ? (constraint?.deduction ?? 0) : 0,
      reviewedBy: user.id,
      reviewedAt: this.now().toISOString(),
    };
    await this.judgeJobsRepository.saveDecision(row.id, decision);
    return toItem(lab, { ...row, decision });
  }
}

/**
 * @param {Lab} lab
 * @param {ReviewRow} row
 * @returns {ReviewItem}
 */
function toItem(lab, row) {
  const constraint = lab.constraints?.find((c) => c.id === row.constraintId);
  return {
    ...row,
    constraint: constraint?.text ?? '',
    deduction: constraint?.deduction ?? 0,
  };
}
