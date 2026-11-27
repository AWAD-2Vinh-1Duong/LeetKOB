import { createHash, randomUUID } from 'node:crypto';

/** @typedef {import('./judge-jobs.repository.js').JudgeJob} JudgeJob */
/** @typedef {import('./judge-jobs.repository.js').VerdictInput} VerdictInput */
/** @typedef {import('./judge-jobs.repository.js').StoredVerdict} StoredVerdict */
/** @typedef {import('./judge-jobs.repository.js').JobSubmissionContext} JobSubmissionContext */

/**
 * Deterministic 64-char hex id for (submissionId, constraintId) so verdict inserts
 * are idempotent via the primary key without requiring an extra unique constraint.
 * @param {string} submissionId
 * @param {string} constraintId
 */
function deterministicVerdictId(submissionId, constraintId) {
  return createHash('sha256')
    .update(`${submissionId}\0${constraintId}`)
    .digest('hex');
}

/**
 * @param {Record<string, any>} row
 * @returns {JudgeJob}
 */
function mapJobRow(row) {
  return {
    id: String(row.id),
    submissionId: String(row.submissionId),
    status: row.status,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.maxAttempts),
    lockedAt: row.lockedAt ? new Date(row.lockedAt).toISOString() : null,
    lockedBy: row.lockedBy ? String(row.lockedBy) : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class PostgresJudgeJobsRepository {
  /** @param {{ pool: import('pg').Pool }} deps */
  constructor({ pool }) {
    this.pool = pool;
  }

  /**
   * Idempotently enqueues a job for a submission if one does not already exist.
   * @param {string} submissionId
   * @param {Date} [now]
   * @returns {Promise<{ job: JudgeJob, created: boolean }>}
   */
  async enqueue(submissionId, now = new Date()) {
    const id = randomUUID();
    const iso = now.toISOString();
    const inserted = await this.pool.query(
      `INSERT INTO judge_jobs (id, submission_id, status, created_at, updated_at)
       SELECT $1::varchar, $2::varchar, 'queued', $3::timestamptz, $3::timestamptz
       WHERE NOT EXISTS (
         SELECT 1 FROM judge_jobs WHERE submission_id = $2::varchar
       )
       RETURNING id, submission_id AS "submissionId", status, attempts,
                 max_attempts AS "maxAttempts", locked_at AS "lockedAt",
                 locked_by AS "lockedBy", created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [id, submissionId, iso],
    );

    if (inserted.rows.length > 0) {
      return { job: mapJobRow(inserted.rows[0]), created: true };
    }

    const existing = await this.pool.query(
      `SELECT id, submission_id AS "submissionId", status, attempts,
              max_attempts AS "maxAttempts", locked_at AS "lockedAt",
              locked_by AS "lockedBy", created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM judge_jobs
       WHERE submission_id = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [submissionId],
    );
    if (existing.rows.length === 0) {
      throw new Error(
        `Failed to resolve judge job for submission ${submissionId}`,
      );
    }
    return { job: mapJobRow(existing.rows[0]), created: false };
  }

  /**
   * Atomically claims the oldest queued job using FOR UPDATE SKIP LOCKED.
   * @param {string} workerId
   * @param {Date} [now]
   * @returns {Promise<JudgeJob | null>}
   */
  async claimNext(workerId, now = new Date()) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const selected = await client.query(
        `SELECT id, submission_id AS "submissionId"
         FROM judge_jobs
         WHERE status = 'queued' AND attempts < max_attempts
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
      );

      if (selected.rows.length === 0) {
        await client.query('COMMIT');
        return null;
      }

      const { id, submissionId } = selected.rows[0];
      const iso = now.toISOString();

      const updated = await client.query(
        `UPDATE judge_jobs
         SET status = 'running',
             attempts = attempts + 1,
             locked_at = $2,
             locked_by = $3,
             updated_at = $2
         WHERE id = $1
         RETURNING id, submission_id AS "submissionId", status, attempts,
                   max_attempts AS "maxAttempts", locked_at AS "lockedAt",
                   locked_by AS "lockedBy", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [id, iso, workerId],
      );

      await client.query(
        `UPDATE submissions
         SET status = 'running', updated_at = $2
         WHERE id = $1 AND status = 'queued'`,
        [submissionId, iso],
      );

      await client.query('COMMIT');
      return mapJobRow(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Loads submission source, lab statement/constraints, and student identity for grading.
   * @param {string} submissionId
   * @returns {Promise<JobSubmissionContext | null>}
   */
  async getSubmissionContext(submissionId) {
    const res = await this.pool.query(
      `SELECT s.id AS "submissionId",
              s.lab_id AS "labId",
              s.student_id AS "studentId",
              s.language AS "language",
              s.source AS "source",
              l.statement AS "statement",
              l.tests AS "tests",
              l.constraints AS "constraints",
              u.email AS "studentEmail"
       FROM submissions s
       JOIN labs l ON l.id = s.lab_id
       LEFT JOIN users u ON u.id = s.student_id
       WHERE s.id = $1`,
      [submissionId],
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      submission: {
        id: String(row.submissionId),
        labId: String(row.labId),
        studentId: String(row.studentId),
        language: row.language,
        source: String(row.source),
      },
      lab: {
        id: String(row.labId),
        statement: String(row.statement),
        tests: Array.isArray(row.tests) ? row.tests : [],
        constraints: Array.isArray(row.constraints) ? row.constraints : [],
      },
      student: {
        id: String(row.studentId),
        ...(row.studentEmail ? { email: String(row.studentEmail) } : {}),
      },
    };
  }

  /**
   * Atomically and idempotently persists verdicts and marks job & submission completed.
   * @param {string} jobId
   * @param {string} submissionId
   * @param {VerdictInput[]} verdicts
   * @param {Date} [now]
   */
  async completeJob(jobId, submissionId, verdicts, now = new Date()) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const iso = now.toISOString();

      for (const v of verdicts) {
        const verdictId = deterministicVerdictId(submissionId, v.constraintId);
        await client.query(
          `INSERT INTO verdicts (id, submission_id, constraint_id, verdict, evidence, deduction, is_reviewed, created_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, FALSE, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            verdictId,
            submissionId,
            v.constraintId,
            v.verdict,
            JSON.stringify(v.evidence ?? []),
            v.deduction ?? 0,
            iso,
          ],
        );
      }

      await client.query(
        `UPDATE submissions
         SET status = 'judged', updated_at = $2
         WHERE id = $1`,
        [submissionId, iso],
      );

      await client.query(
        `UPDATE judge_jobs
         SET status = 'completed',
             locked_at = NULL,
             locked_by = NULL,
             updated_at = $2
         WHERE id = $1`,
        [jobId, iso],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Re-queues the job if attempts remain; otherwise marks both job and submission failed.
   * @param {string} jobId
   * @param {string} submissionId
   * @param {Date} [now]
   * @returns {Promise<JudgeJob | null>}
   */
  async failJob(jobId, submissionId, now = new Date()) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const iso = now.toISOString();

      const updated = await client.query(
        `UPDATE judge_jobs
         SET status = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
             locked_at = NULL,
             locked_by = NULL,
             updated_at = $2
         WHERE id = $1
         RETURNING id, submission_id AS "submissionId", status, attempts,
                   max_attempts AS "maxAttempts", locked_at AS "lockedAt",
                   locked_by AS "lockedBy", created_at AS "createdAt",
                   updated_at AS "updatedAt"`,
        [jobId, iso],
      );

      if (updated.rows.length === 0) {
        await client.query('COMMIT');
        return null;
      }

      const job = mapJobRow(updated.rows[0]);
      await client.query(
        `UPDATE submissions
         SET status = $2, updated_at = $3
         WHERE id = $1`,
        [submissionId, job.status === 'failed' ? 'failed' : 'queued', iso],
      );

      await client.query('COMMIT');
      return job;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Persists an LLM call record into llm_call_logs.
   * @param {string} submissionId
   * @param {import('../service/constraint-judge.js').CallRecord} call
   */
  async recordLlmCall(submissionId, call) {
    await this.pool.query(
      `INSERT INTO llm_call_logs (
         id, submission_id, provider, provider_request_id, model,
         prompt, response, input_tokens, output_tokens, latency_ms, cost_usd
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        randomUUID(),
        submissionId,
        'gemini',
        call.requestId,
        call.model,
        call.prompt,
        call.response,
        call.inputTokens,
        call.outputTokens,
        call.latencyMs,
        call.costUsd,
      ],
    );
  }

  /**
   * @param {string} submissionId
   * @returns {Promise<StoredVerdict[]>}
   */
  async findVerdictsBySubmission(submissionId) {
    const res = await this.pool.query(
      `SELECT id, submission_id AS "submissionId", constraint_id AS "constraintId",
              verdict, evidence, deduction, is_reviewed AS "isReviewed",
              reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
              created_at AS "createdAt"
       FROM verdicts
       WHERE submission_id = $1
       ORDER BY constraint_id ASC`,
      [submissionId],
    );
    return res.rows.map((row) => ({
      id: String(row.id),
      submissionId: String(row.submissionId),
      constraintId: String(row.constraintId),
      verdict: row.verdict,
      evidence: Array.isArray(row.evidence) ? row.evidence : [],
      deduction: Number(row.deduction),
      isReviewed: Boolean(row.isReviewed),
      reviewedBy: row.reviewedBy ? String(row.reviewedBy) : null,
      reviewedAt: row.reviewedAt
        ? new Date(row.reviewedAt).toISOString()
        : null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  }

  /**
   * @param {string} submissionId
   * @returns {Promise<JudgeJob[]>}
   */
  async findJobsBySubmission(submissionId) {
    const res = await this.pool.query(
      `SELECT id, submission_id AS "submissionId", status, attempts,
              max_attempts AS "maxAttempts", locked_at AS "lockedAt",
              locked_by AS "lockedBy", created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM judge_jobs
       WHERE submission_id = $1
       ORDER BY created_at ASC`,
      [submissionId],
    );
    return res.rows.map(mapJobRow);
  }
}
