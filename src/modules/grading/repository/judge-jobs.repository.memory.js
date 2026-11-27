import { createHash, randomUUID } from 'node:crypto';

/** @typedef {import('./judge-jobs.repository.js').JudgeJob} JudgeJob */
/** @typedef {import('./judge-jobs.repository.js').VerdictInput} VerdictInput */
/** @typedef {import('./judge-jobs.repository.js').StoredVerdict} StoredVerdict */
/** @typedef {import('./judge-jobs.repository.js').JobSubmissionContext} JobSubmissionContext */

/**
 * Deterministic 64-char hex id for (submissionId, constraintId) so verdict writes are idempotent.
 * @param {string} submissionId
 * @param {string} constraintId
 */
function deterministicVerdictId(submissionId, constraintId) {
  return createHash('sha256')
    .update(`${submissionId}\0${constraintId}`)
    .digest('hex');
}

// shortcut: in-memory queue for tests; production uses PostgresJudgeJobsRepository.
export class InMemoryJudgeJobsRepository {
  /**
   * @param {{
   *   submissionRepository?: import('../../submissions/repository/submissions.repository.js').SubmissionRepository,
   *   labRepository?: import('../../labs/repository/labs.repository.js').LabRepository,
   *   usersById?: Map<string, { id: string, email?: string }>,
   * }} [deps]
   */
  constructor(deps = {}) {
    this.submissionRepository = deps.submissionRepository;
    this.labRepository = deps.labRepository;
    this.usersById = deps.usersById ?? new Map();
    /** @type {Map<string, JudgeJob>} keyed by job.id */
    this.jobs = new Map();
    /** @type {Map<string, StoredVerdict>} keyed by deterministic verdict id */
    this.verdicts = new Map();
    /** @type {Array<{ submissionId: string, call: import('../service/constraint-judge.js').CallRecord }>} */
    this.llmCalls = [];
  }

  /**
   * @param {string} submissionId
   * @param {Date} [now]
   * @returns {Promise<{ job: JudgeJob, created: boolean }>}
   */
  async enqueue(submissionId, now = new Date()) {
    for (const existing of this.jobs.values()) {
      if (existing.submissionId === submissionId) {
        return { job: existing, created: false };
      }
    }
    const iso = now.toISOString();
    /** @type {JudgeJob} */
    const job = {
      id: randomUUID(),
      submissionId,
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      lockedAt: null,
      lockedBy: null,
      createdAt: iso,
      updatedAt: iso,
    };
    this.jobs.set(job.id, job);
    return { job, created: true };
  }

  /**
   * Claims the oldest queued job that has remaining attempts.
   * @param {string} workerId
   * @param {Date} [now]
   * @returns {Promise<JudgeJob | null>}
   */
  async claimNext(workerId, now = new Date()) {
    const candidates = [...this.jobs.values()]
      .filter((j) => j.status === 'queued' && j.attempts < j.maxAttempts)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const next = candidates[0];
    if (!next) return null;

    const iso = now.toISOString();
    next.status = 'running';
    next.attempts += 1;
    next.lockedAt = iso;
    next.lockedBy = workerId;
    next.updatedAt = iso;

    if (this.submissionRepository) {
      const sub = await this.submissionRepository.findById(next.submissionId);
      if (sub) sub.status = 'running';
    }
    return { ...next };
  }

  /**
   * @param {string} submissionId
   * @returns {Promise<JobSubmissionContext | null>}
   */
  async getSubmissionContext(submissionId) {
    if (!this.submissionRepository || !this.labRepository) return null;
    const sub = await this.submissionRepository.findById(submissionId);
    if (!sub) return null;
    const lab = await this.labRepository.findForUser(sub.labId, {
      id: 'worker',
      role: 'admin',
    });
    if (!lab) return null;
    const student = this.usersById.get(sub.studentId) ?? { id: sub.studentId };
    return {
      submission: {
        id: sub.id,
        labId: sub.labId,
        studentId: sub.studentId,
        language: sub.language,
        source: sub.source ?? '',
      },
      lab: {
        id: lab.id,
        statement: lab.statement ?? '',
        tests: lab.tests ?? [],
        constraints: lab.constraints ?? [],
      },
      student,
    };
  }

  /**
   * Idempotently saves verdicts and marks both job and submission complete.
   * @param {string} jobId
   * @param {string} submissionId
   * @param {VerdictInput[]} verdicts
   * @param {Date} [now]
   */
  async completeJob(jobId, submissionId, verdicts, now = new Date()) {
    const iso = now.toISOString();
    for (const v of verdicts) {
      const id = deterministicVerdictId(submissionId, v.constraintId);
      if (!this.verdicts.has(id)) {
        this.verdicts.set(id, {
          id,
          submissionId,
          constraintId: v.constraintId,
          verdict: v.verdict,
          evidence: v.evidence,
          deduction: v.deduction ?? 0,
          isReviewed: false,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: iso,
        });
      }
    }

    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.lockedAt = null;
      job.lockedBy = null;
      job.updatedAt = iso;
    }

    if (this.submissionRepository) {
      const sub = await this.submissionRepository.findById(submissionId);
      if (sub) sub.status = 'judged';
    }
  }

  /**
   * Re-queues the job if attempts remain, otherwise marks both job and submission failed.
   * @param {string} jobId
   * @param {string} submissionId
   * @param {Date} [now]
   * @returns {Promise<JudgeJob | null>}
   */
  async failJob(jobId, submissionId, now = new Date()) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    const iso = now.toISOString();
    const retryable = job.attempts < job.maxAttempts;
    job.status = retryable ? 'queued' : 'failed';
    job.lockedAt = null;
    job.lockedBy = null;
    job.updatedAt = iso;

    if (this.submissionRepository) {
      const sub = await this.submissionRepository.findById(submissionId);
      if (sub) sub.status = retryable ? 'queued' : 'failed';
    }
    return { ...job };
  }

  /**
   * @param {string} submissionId
   * @param {import('../service/constraint-judge.js').CallRecord} call
   */
  async recordLlmCall(submissionId, call) {
    this.llmCalls.push({ submissionId, call });
  }

  /**
   * @param {string} submissionId
   * @returns {Promise<StoredVerdict[]>}
   */
  async findVerdictsBySubmission(submissionId) {
    return [...this.verdicts.values()].filter(
      (v) => v.submissionId === submissionId,
    );
  }

  /**
   * @param {string} submissionId
   * @returns {Promise<JudgeJob[]>}
   */
  async findJobsBySubmission(submissionId) {
    return [...this.jobs.values()]
      .filter((j) => j.submissionId === submissionId)
      .map((j) => ({ ...j }));
  }
}
