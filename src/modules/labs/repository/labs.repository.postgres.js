/** @typedef {import('./labs.repository.js').Lab} Lab */
/** @typedef {import('./labs.repository.js').Viewer} Viewer */

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
