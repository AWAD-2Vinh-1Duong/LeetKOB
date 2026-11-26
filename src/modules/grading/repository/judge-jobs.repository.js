/**
 * The judge job queue and verdict store. Implementations:
 * `judge-jobs.repository.memory.js` (tests) and `judge-jobs.repository.postgres.js`.
 * Only `src/container.js` may import an implementation.
 *
 * @typedef {'queued' | 'running' | 'completed' | 'failed'} JudgeJobStatus
 * @typedef {{
 *   id: string,
 *   submissionId: string,
 *   status: JudgeJobStatus,
 *   attempts: number,
 *   maxAttempts: number,
 *   lockedAt: string | null,
 *   lockedBy: string | null,
 *   createdAt: string,
 *   updatedAt: string,
 * }} JudgeJob
 * @typedef {{
 *   constraintId: string,
 *   verdict: 'pass' | 'violation' | 'unsure',
 *   evidence: Array<{ line: number, text: string }>,
 *   deduction?: number,
 * }} VerdictInput
 * @typedef {{
 *   id: string,
 *   submissionId: string,
 *   constraintId: string,
 *   verdict: 'pass' | 'violation' | 'unsure',
 *   evidence: Array<{ line: number, text: string }>,
 *   deduction: number,
 *   isReviewed: boolean,
 *   reviewedBy: string | null,
 *   reviewedAt: string | null,
 *   createdAt: string,
 * }} StoredVerdict
 * @typedef {{
 *   submission: { id: string, labId: string, studentId: string, language: 'cpp', source: string },
 *   lab: {
 *     id: string,
 *     statement: string,
 *     constraints: Array<{ id: string, text: string, deduction: number }>,
 *   },
 *   student: { id: string, email?: string },
 * }} JobSubmissionContext
 * @typedef {{
 *   enqueue(submissionId: string, now?: Date): Promise<{ job: JudgeJob, created: boolean }>,
 *   claimNext(workerId: string, now?: Date): Promise<JudgeJob | null>,
 *   getSubmissionContext(submissionId: string): Promise<JobSubmissionContext | null>,
 *   completeJob(jobId: string, submissionId: string, verdicts: VerdictInput[], now?: Date): Promise<void>,
 *   failJob(jobId: string, submissionId: string, now?: Date): Promise<JudgeJob | null>,
 *   recordLlmCall(submissionId: string, call: import('../service/constraint-judge.js').CallRecord): Promise<void>,
 *   findVerdictsBySubmission(submissionId: string): Promise<StoredVerdict[]>,
 *   findJobsBySubmission(submissionId: string): Promise<JudgeJob[]>,
 * }} JudgeJobsRepository
 */

export {};
