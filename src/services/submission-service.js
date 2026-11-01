import { createHash, randomUUID } from 'node:crypto';
import { ProblemError } from '../problems.js';

/** @typedef {import('../repositories/in-memory.js').Submission} Submission */

export class SubmissionService {
  /**
   * @param {{
   *   labRepository: import('../repositories/in-memory.js').InMemoryLabRepository,
   *   submissionRepository: import('../repositories/in-memory.js').InMemorySubmissionRepository,
   *   now: () => Date,
   * }} deps
   */
  constructor({ labRepository, submissionRepository, now }) {
    this.labRepository = labRepository;
    this.submissionRepository = submissionRepository;
    this.now = now;
  }

  /**
   * @param {{ studentId: string, labId: string, idempotencyKey: string, language: 'cpp', source: string }} input
   * @returns {Promise<{ submission: Submission, replayed: boolean }>}
   */
  async submit({ studentId, labId, idempotencyKey, language, source }) {
    const lab = await this.labRepository.findForStudent(labId, studentId);
    if (!lab)
      throw new ProblemError(
        'lab-not-found',
        `No lab "${labId}" is open to you.`,
      );

    const fingerprint = createHash('sha256')
      .update(JSON.stringify([language, source]))
      .digest('hex');
    const existing = await this.submissionRepository.findByIdempotencyKey(
      studentId,
      labId,
      idempotencyKey,
    );
    // Replay before the deadline check: a retry of an accepted request must not turn into 409.
    if (existing) return this.#replay(existing, fingerprint);

    const now = this.now();
    if (now >= lab.deadline) {
      throw new ProblemError(
        'lab-closed',
        `The deadline was ${lab.deadline.toISOString()}.`,
      );
    }

    const { submission, created } =
      await this.submissionRepository.insertIfAbsent({
        id: randomUUID(),
        labId,
        studentId,
        language,
        status: 'queued',
        createdAt: now.toISOString(),
        idempotencyKey,
        fingerprint,
      });
    return created
      ? { submission, replayed: false }
      : this.#replay(submission, fingerprint);
  }

  /** @param {Submission} submission @param {string} fingerprint */
  #replay(submission, fingerprint) {
    if (submission.fingerprint !== fingerprint) {
      throw new ProblemError(
        'idempotency-key-reused',
        'This Idempotency-Key was first used with a different language or source.',
      );
    }
    return { submission, replayed: true };
  }
}
