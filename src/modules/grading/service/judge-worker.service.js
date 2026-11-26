import { randomUUID } from 'node:crypto';
import { decideConstraint } from './hard-rules.js';

/** @typedef {import('../repository/judge-jobs.repository.js').JudgeJob} JudgeJob */
/** @typedef {import('../repository/judge-jobs.repository.js').VerdictInput} VerdictInput */
/** @typedef {import('../repository/judge-jobs.repository.js').JobSubmissionContext} JobSubmissionContext */
/** @typedef {import('./constraint-judge.js').CallRecord} CallRecord */
/** @typedef {{ judge(input: {
 *   statement: string,
 *   constraints: Array<{ id: string, text: string }>,
 *   source: string,
 *   identity?: import('./sanitize.js').Identity,
 * }): Promise<{ verdicts: import('./constraint-judge.js').JudgeVerdict[], call: CallRecord | null }> }} Judge */
/** @typedef {(ctx: JobSubmissionContext) => Promise<{ verdicts: VerdictInput[], call?: CallRecord | null }>} SubmissionEvaluator */

export class JudgeWorkerService {
  /**
   * @param {{
   *   judgeJobsRepository: import('../repository/judge-jobs.repository.js').JudgeJobsRepository,
   *   judge?: Judge | null,
   *   evaluator?: SubmissionEvaluator,
   *   workerId?: string,
   *   pollIntervalMs?: number,
   *   logger?: { info: (...args: any[]) => void, error: (...args: any[]) => void },
   *   now?: () => Date,
   * }} deps
   */
  constructor({
    judgeJobsRepository,
    judge = null,
    evaluator,
    workerId = `worker-${randomUUID()}`,
    pollIntervalMs = 500,
    logger = { info: () => {}, error: () => {} },
    now = () => new Date(),
  }) {
    this.judgeJobsRepository = judgeJobsRepository;
    this.judge = judge;
    this.evaluator = evaluator;
    this.workerId = workerId;
    this.pollIntervalMs = pollIntervalMs;
    this.logger = logger;
    this.now = now;
    this.running = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.timer = null;
    /** @type {Promise<void> | null} */
    this.inFlight = null;
  }

  /**
   * Claims and processes at most one queued job. Returns the processed job info, or null if queue is empty.
   * @returns {Promise<{ job: JudgeJob, outcome: 'completed' | 'failed' } | null>}
   */
  async runOnce() {
    const job = await this.judgeJobsRepository.claimNext(
      this.workerId,
      this.now(),
    );
    if (!job) return null;

    try {
      const ctx = await this.judgeJobsRepository.getSubmissionContext(
        job.submissionId,
      );
      if (!ctx) {
        throw new Error(
          `Submission context not found for submission ${job.submissionId}`,
        );
      }

      const { verdicts, call } = this.evaluator
        ? await this.evaluator(ctx)
        : await this.#evaluateDefault(ctx);

      if (call) {
        await this.judgeJobsRepository.recordLlmCall(ctx.submission.id, call);
      }

      // Guardrail: worker verdicts are never reviewed and carry 0 deduction until TA review.
      const safeVerdicts = verdicts.map((v) => ({
        constraintId: v.constraintId,
        verdict: v.verdict,
        evidence: v.evidence,
        deduction: 0,
      }));

      await this.judgeJobsRepository.completeJob(
        job.id,
        job.submissionId,
        safeVerdicts,
        this.now(),
      );
      this.logger.info(
        {
          workerId: this.workerId,
          jobId: job.id,
          submissionId: job.submissionId,
          verdicts: safeVerdicts.length,
        },
        'Judge job completed',
      );
      return { job, outcome: 'completed' };
    } catch (err) {
      this.logger.error(
        {
          err,
          workerId: this.workerId,
          jobId: job.id,
          submissionId: job.submissionId,
        },
        'Judge job failed',
      );
      await this.judgeJobsRepository.failJob(
        job.id,
        job.submissionId,
        this.now(),
      );
      return { job, outcome: 'failed' };
    }
  }

  /**
   * Starts the polling loop. Safe to call when stopped.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.#scheduleNext(0);
  }

  /**
   * Stops the polling loop and waits for any currently executing job to finish.
   */
  async stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight) {
      await this.inFlight;
    }
  }

  /** @param {number} delayMs */
  #scheduleNext(delayMs) {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.inFlight = this.#tick();
    }, delayMs);
    this.timer.unref?.();
  }

  async #tick() {
    let processed = false;
    try {
      const result = await this.runOnce();
      processed = result !== null;
    } catch (err) {
      this.logger.error(
        { err, workerId: this.workerId },
        'Worker poll tick failed',
      );
    } finally {
      this.inFlight = null;
      if (this.running) {
        this.#scheduleNext(processed ? 0 : this.pollIntervalMs);
      }
    }
  }

  /**
   * Default evaluation pipeline: syntax-aware hard rules first, then semantic LLM judge
   * (or `unsure` when MODEL_OFF=1 / no judge configured).
   * @param {JobSubmissionContext} ctx
   * @returns {Promise<{ verdicts: VerdictInput[], call: CallRecord | null }>}
   */
  async #evaluateDefault(ctx) {
    /** @type {Map<string, { verdict: 'pass' | 'violation' | 'unsure', evidence: Array<{ line: number, text: string }> }>} */
    const decided = new Map();
    const semantic = [];

    for (const c of ctx.lab.constraints) {
      const hard = decideConstraint(ctx.submission.source, c);
      if (hard) {
        decided.set(c.id, { verdict: hard.verdict, evidence: hard.evidence });
      } else {
        semantic.push({ id: c.id, text: c.text });
      }
    }

    /** @type {CallRecord | null} */
    let call = null;
    if (semantic.length > 0 && this.judge) {
      const res = await this.judge.judge({
        statement: ctx.lab.statement,
        constraints: semantic,
        source: ctx.submission.source,
        identity: {
          studentId: ctx.student.id,
          ...(ctx.student.email ? { email: ctx.student.email } : {}),
        },
      });
      call = res.call;
      for (const v of res.verdicts) {
        decided.set(v.constraintId, {
          verdict: v.verdict,
          evidence: v.evidence,
        });
      }
    }

    const verdicts = ctx.lab.constraints.map((c) => {
      const d = decided.get(c.id) ?? { verdict: 'unsure', evidence: [] };
      return /** @type {VerdictInput} */ ({
        constraintId: c.id,
        verdict: d.verdict,
        evidence: d.evidence,
        deduction: 0,
      });
    });

    return { verdicts, call };
  }
}
