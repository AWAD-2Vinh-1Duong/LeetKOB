/**
 * @typedef {{ id: string, classId: string, deadline: Date }} Lab
 * @typedef {{
 *   id: string, labId: string, studentId: string, language: 'cpp',
 *   status: 'queued', createdAt: string, idempotencyKey: string, fingerprint: string
 * }} Submission
 */

// shortcut: in-memory stores lose data on restart, replace with PostgreSQL repositories in PA#3.
export class InMemoryLabRepository {
  /** @param {{ labs: Lab[], enrollments: Array<{ studentId: string, classId: string }> }} seed */
  constructor({ labs, enrollments }) {
    this.labs = new Map(labs.map((lab) => [lab.id, lab]));
    this.enrollments = new Set(
      enrollments.map((e) => `${e.studentId}\0${e.classId}`),
    );
  }

  /**
   * The lab, only if the student is enrolled in its class.
   * @param {string} labId
   * @param {string} studentId
   * @returns {Promise<Lab | undefined>}
   */
  async findForStudent(labId, studentId) {
    const lab = this.labs.get(labId);
    return lab && this.enrollments.has(`${studentId}\0${lab.classId}`)
      ? lab
      : undefined;
  }
}

export class InMemorySubmissionRepository {
  constructor() {
    /** @type {Map<string, Submission>} keyed like the PA#3 unique index (student_id, lab_id, idempotency_key) */
    this.byKey = new Map();
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
    this.byKey.set(k, submission);
    return { submission, created: true };
  }
}
