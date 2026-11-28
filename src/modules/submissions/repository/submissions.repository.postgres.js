import { randomUUID } from 'node:crypto';

/** @typedef {import('./submissions.repository.js').Submission} Submission */

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
   * Inserts unless the idempotency scope is taken; atomically enqueues a judge_jobs row
   * in the same PostgreSQL transaction when a new submission is created.
   * @param {Submission} submission
   * @returns {Promise<{ submission: Submission, created: boolean }>}
   */
  async insertIfAbsent(submission) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
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
        await client.query(
          `INSERT INTO judge_jobs (id, submission_id, status, created_at, updated_at)
           VALUES ($1, $2, 'queued', $3, $3)`,
          [randomUUID(), row.id, submission.createdAt],
        );
        await client.query('COMMIT');
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

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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
