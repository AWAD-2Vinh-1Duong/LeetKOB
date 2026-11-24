/**
 * @typedef {{ id: string, text: string, deduction: number }} LabConstraint
 * @typedef {{
 *   id: string, classId: string, deadline: Date,
 *   title?: string, statement?: string,
 *   tests?: Array<{ input: string, expectedOutput: string }>,
 *   constraints?: LabConstraint[],
 * }} Lab
 * @typedef {{ id: string, role: 'admin' | 'ta' | 'student' }} Viewer
 * @typedef {{ id: string, email: string, passwordHash: string, role: 'admin' | 'ta' | 'student' }} User
 * @typedef {{
 *   id: string, labId: string, studentId: string, language: 'cpp',
 *   status: 'queued', createdAt: string, idempotencyKey: string, fingerprint: string
 * }} Submission
 */

// shortcut: in-memory stores lose data on restart, replace with PostgreSQL repositories in PA#3.
export class InMemoryLabRepository {
  /** @param {{ labs: Lab[], enrollments: Array<{ studentId: string, classId: string }>, staff?: Array<{ userId: string, classId: string }>, classes?: string[] }} seed */
  constructor({ labs, enrollments, staff = [], classes = [] }) {
    this.classes = new Set([
      ...classes,
      ...labs.map((l) => l.classId),
      ...enrollments.map((e) => e.classId),
      ...staff.map((s) => s.classId),
    ]);
    this.staff = new Set(staff.map((s) => `${s.userId}\0${s.classId}`));
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

  /**
   * The lab, only if the caller may see it: an admin always, a TA of its class,
   * or a student enrolled in its class.
   * @param {string} labId
   * @param {Viewer} viewer
   * @returns {Promise<Lab | undefined>}
   */
  async findForUser(labId, viewer) {
    const lab = this.labs.get(labId);
    if (!lab) return undefined;
    const key = `${viewer.id}\0${lab.classId}`;
    const allowed =
      viewer.role === 'admin' ||
      (viewer.role === 'ta' && this.staff.has(key)) ||
      (viewer.role === 'student' && this.enrollments.has(key));
    return allowed ? lab : undefined;
  }

  /**
   * Whether the caller may create labs in the class: an admin in any existing
   * class, a TA only in a class they teach.
   * @param {Viewer} viewer
   * @param {string} classId
   * @returns {Promise<boolean>}
   */
  async canManageClass(viewer, classId) {
    if (viewer.role === 'admin') return this.classes.has(classId);
    return viewer.role === 'ta' && this.staff.has(`${viewer.id}\0${classId}`);
  }

  /**
   * @param {Lab} lab
   * @returns {Promise<Lab>}
   */
  async create(lab) {
    this.labs.set(lab.id, lab);
    return lab;
  }
}

export class InMemoryUserRepository {
  /** @param {{ users: User[] }} seed */
  constructor({ users }) {
    this.byEmail = new Map(users.map((u) => [u.email, u]));
  }

  /**
   * @param {string} email
   * @returns {Promise<User | undefined>}
   */
  async findByEmail(email) {
    return this.byEmail.get(email);
  }
}

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
