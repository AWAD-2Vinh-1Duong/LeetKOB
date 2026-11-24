/** @typedef {import('./submissions.repository.js').Submission} Submission */

// shortcut: in-memory stores lose data on restart; the app uses the PostgreSQL repository.
export class InMemorySubmissionRepository {
  constructor() {
    /** @type {Map<string, Submission>} keyed like the PA#3 unique index (student_id, lab_id, idempotency_key) */
    this.byKey = new Map();
  }

  /**
   * @param {string} id
   * @returns {Promise<Submission | undefined>}
   */
  async findById(id) {
    return [...this.byKey.values()].find((s) => s.id === id);
  }

  /**
   * @param {string} studentId
   * @param {string} labId
   * @param {string} idempotencyKey
   * @returns {Promise<Submission | undefined>}
   */
  async findByIdempotencyKey(studentId, labId, idempotencyKey) {
    return this.byKey.get(`${studentId}\0${labId}\0${idempotencyKey}`);
  }

  /**
   * Inserts unless the idempotency scope is taken; returns whichever row holds it.
   * @param {Submission} submission
   * @returns {Promise<{ submission: Submission, created: boolean }>}
   */
  async insertIfAbsent(submission) {
    const k = `${submission.studentId}\0${submission.labId}\0${submission.idempotencyKey}`;
    const existing = this.byKey.get(k);
    if (existing) return { submission: existing, created: false };
    this.byKey.set(k, submission);
    return { submission, created: true };
  }
}
