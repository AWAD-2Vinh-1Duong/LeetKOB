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
 *   status: 'queued', createdAt: string, idempotencyKey: string, fingerprint: string,
 *   source?: string
 * }} Submission
 */

const LAB_COLUMNS = `l.id, l.class_id AS "classId", l.title, l.statement, l.tests, l.constraints, l.deadline`;

/** @param {any} row @returns {Lab} */
function toLab(row) {
  return {
    id: String(row.id),
    classId: String(row.classId),
    title: row.title,
    statement: row.statement,
    tests: row.tests,
    constraints: row.constraints,
    deadline: new Date(row.deadline),
  };
}

export class PostgresLabRepository {
  /** @param {{ pool: import('pg').Pool }} deps */
  constructor({ pool }) {
    this.pool = pool;
  }

  /**
   * The lab, only if the student is enrolled in its class.
   * @param {string} labId
   * @param {string} studentId
   * @returns {Promise<Lab | undefined>}
   */
  async findForStudent(labId, studentId) {
    const res = await this.pool.query(
      `SELECT ${LAB_COLUMNS}
       FROM labs l
       JOIN class_enrollments ce ON ce.class_id = l.class_id
       WHERE l.id = $1 AND ce.student_id = $2`,
      [labId, studentId],
    );
    if (res.rows.length === 0) return undefined;
    return toLab(res.rows[0]);
  }

  /**
   * The lab, only if the caller may see it: an admin always, a TA of its class
   * (class_staff), or a student enrolled in its class.
   * @param {string} labId
   * @param {Viewer} viewer
   * @returns {Promise<Lab | undefined>}
   */
  async findForUser(labId, viewer) {
    const res = await this.pool.query(
      `SELECT ${LAB_COLUMNS}
       FROM labs l
       WHERE l.id = $1 AND (
         $3::text = 'admin'
         OR ($3::text = 'ta' AND EXISTS (
              SELECT 1 FROM class_staff cs
              WHERE cs.class_id = l.class_id AND cs.user_id = $2))
         OR ($3::text = 'student' AND EXISTS (
              SELECT 1 FROM class_enrollments ce
              WHERE ce.class_id = l.class_id AND ce.student_id = $2))
       )`,
      [labId, viewer.id, viewer.role],
    );
    if (res.rows.length === 0) return undefined;
    return toLab(res.rows[0]);
  }

  /**
   * Whether the caller may create labs in the class: an admin in any existing
   * class, a TA only in a class they teach (class_staff).
   * @param {Viewer} viewer
   * @param {string} classId
   * @returns {Promise<boolean>}
   */
  async canManageClass(viewer, classId) {
    if (viewer.role === 'admin') {
      const res = await this.pool.query('SELECT 1 FROM classes WHERE id = $1', [
        classId,
      ]);
      return res.rows.length > 0;
    }
    if (viewer.role !== 'ta') return false;
    const res = await this.pool.query(
      'SELECT 1 FROM class_staff WHERE class_id = $1 AND user_id = $2',
      [classId, viewer.id],
    );
    return res.rows.length > 0;
  }

  /**
   * @param {Lab} lab
   * @returns {Promise<Lab>}
   */
  async create(lab) {
    await this.pool.query(
      `INSERT INTO labs (id, class_id, title, statement, tests, constraints, deadline)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
      [
        lab.id,
        lab.classId,
        lab.title,
        lab.statement,
        JSON.stringify(lab.tests ?? []),
        JSON.stringify(lab.constraints ?? []),
        lab.deadline,
      ],
    );
    return lab;
  }
}

export class PostgresUserRepository {
  /** @param {{ pool: import('pg').Pool }} deps */
  constructor({ pool }) {
    this.pool = pool;
  }

  /**
   * @param {string} email
   * @returns {Promise<User | undefined>}
   */
  async findByEmail(email) {
    const res = await this.pool.query(
      `SELECT id, email, password_hash AS "passwordHash", role FROM users WHERE email = $1`,
      [email],
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: String(row.id),
      email: String(row.email),
      passwordHash: String(row.passwordHash),
      role: row.role,
    };
  }
}

export class PostgresSubmissionRepository {
  /** @param {{ pool: import('pg').Pool }} deps */
  constructor({ pool }) {
    this.pool = pool;
  }

  /**
   * @param {string} id
   * @returns {Promise<Submission | undefined>}
   */
  async findById(id) {
    const res = await this.pool.query(
      `SELECT id, lab_id AS "labId", student_id AS "studentId", language, status,
              created_at AS "createdAt", idempotency_key AS "idempotencyKey", fingerprint
       FROM submissions WHERE id = $1`,
      [id],
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: String(row.id),
      labId: String(row.labId),
      studentId: String(row.studentId),
      language: row.language,
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
      idempotencyKey: String(row.idempotencyKey),
      fingerprint: String(row.fingerprint),
    };
  }

  /**
   * @param {string} studentId
   * @param {string} labId
   * @param {string} idempotencyKey
   * @returns {Promise<Submission | undefined>}
   */
  async findByIdempotencyKey(studentId, labId, idempotencyKey) {
    const res = await this.pool.query(
      `SELECT id, lab_id AS "labId", student_id AS "studentId", language, status,
              created_at AS "createdAt", idempotency_key AS "idempotencyKey", fingerprint
       FROM submissions
       WHERE student_id = $1 AND lab_id = $2 AND idempotency_key = $3`,
      [studentId, labId, idempotencyKey],
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: String(row.id),
      labId: String(row.labId),
      studentId: String(row.studentId),
      language: row.language,
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
      idempotencyKey: String(row.idempotencyKey),
      fingerprint: String(row.fingerprint),
    };
  }

  /**
   * Inserts unless the idempotency scope is taken; returns whichever row holds it.
   * @param {Submission} submission
   * @returns {Promise<{ submission: Submission, created: boolean }>}
   */
  async insertIfAbsent(submission) {
    const res = await this.pool.query(
      `INSERT INTO submissions (id, lab_id, student_id, language, source, status, idempotency_key, fingerprint, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (student_id, lab_id, idempotency_key) DO NOTHING
       RETURNING id, lab_id AS "labId", student_id AS "studentId", language, status,
                 created_at AS "createdAt", idempotency_key AS "idempotencyKey", fingerprint`,
      [
        submission.id,
        submission.labId,
        submission.studentId,
        submission.language,
        submission.source ?? '',
        submission.status,
        submission.idempotencyKey,
        submission.fingerprint,
        submission.createdAt,
      ],
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        submission: {
          id: String(row.id),
          labId: String(row.labId),
          studentId: String(row.studentId),
          language: row.language,
          status: row.status,
          createdAt: new Date(row.createdAt).toISOString(),
          idempotencyKey: String(row.idempotencyKey),
          fingerprint: String(row.fingerprint),
        },
        created: true,
      };
    }

    const existing = await this.findByIdempotencyKey(
      submission.studentId,
      submission.labId,
      submission.idempotencyKey,
    );
    if (!existing) {
      throw new Error('Concurrent modification failed to resolve submission');
    }
    return { submission: existing, created: false };
  }
}
