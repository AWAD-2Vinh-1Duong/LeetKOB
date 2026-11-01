import { z } from 'zod';
import { ProblemError } from '../problems.js';

const IDEMPOTENCY_KEY = /^[\x21-\x7E]{1,255}$/;
const MAX_SOURCE_BYTES = 65_536;

const bodySchema = z.strictObject({
  language: z.literal('cpp'),
  source: z
    .string()
    .min(1)
    .refine((s) => Buffer.byteLength(s, 'utf8') <= MAX_SOURCE_BYTES, {
      message: `Must be at most ${MAX_SOURCE_BYTES} bytes in UTF-8`,
    }),
});

export class SubmissionsController {
  /** @param {{ submissionService: import('../services/submission-service.js').SubmissionService }} deps */
  constructor({ submissionService }) {
    this.submissionService = submissionService;
  }

  /** @type {import('express').RequestHandler<{ labId: string }>} */
  create = async (req, res) => {
    /** @type {import('../middlewares/auth.js').AuthUser} */
    const user = res.locals.user;
    if (user.role !== 'student') {
      throw new ProblemError(
        'forbidden-role',
        `Role "${user.role}" cannot submit.`,
      );
    }

    const idempotencyKey = req.get('idempotency-key') ?? '';
    if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new ProblemError(
        'idempotency-key-missing',
        'Send an Idempotency-Key of 1-255 printable ASCII characters.',
      );
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      throw new ProblemError(
        'validation-error',
        `${errors.length} field(s) invalid.`,
        { errors },
      );
    }

    const { submission, replayed } = await this.submissionService.submit({
      studentId: user.id,
      labId: req.params.labId,
      idempotencyKey,
      ...parsed.data,
    });

    const { id, labId, studentId, language, status, createdAt } = submission;
    res.status(202).location(`/submissions/${id}`);
    if (replayed) res.set('Idempotent-Replayed', 'true');
    res.json({ id, labId, studentId, language, status, createdAt });
  };
}
