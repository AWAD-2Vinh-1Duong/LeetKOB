/**
 * The submission store. Implementations: `submissions.repository.memory.js`,
 * `submissions.repository.postgres.js`.
 *
 * @typedef {{
 *   id: string, labId: string, studentId: string, language: 'cpp',
 *   status: 'queued' | 'compiling' | 'running' | 'judged' | 'failed',
 *   createdAt: string, idempotencyKey: string, fingerprint: string,
 *   source?: string
 * }} Submission
 * @typedef {{
 *   findById(id: string): Promise<Submission | undefined>,
 *   findByIdempotencyKey(studentId: string, labId: string, idempotencyKey: string): Promise<Submission | undefined>,
 *   insertIfAbsent(submission: Submission): Promise<{ submission: Submission, created: boolean }>,
 * }} SubmissionRepository
 */

export {};
