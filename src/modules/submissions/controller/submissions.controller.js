import { z } from 'zod';
import { parseBody } from '../../../shared/validation.js';

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
  /** @param {{ submissionService: import('../service/submissions.service.js').SubmissionService }} deps */
  constructor({ submissionService }) {
    this.submissionService = submissionService;
  }

  /** @type {import('express').RequestHandler<{ labId: string }>} */
  create = async (req, res) => {
    const user = res.locals.user;

    const idempotencyKey = res.locals.idempotencyKey;

    const body = parseBody(bodySchema, req.body);

    const { submission, replayed } = await this.submissionService.submit({
      studentId: user.id,
      labId: req.params.labId,
      idempotencyKey,
      ...body,
    });

    const { id, labId, studentId, language, status, createdAt } = submission;
    res.status(202).location(`/submissions/${id}`);
    if (replayed) res.set('Idempotent-Replayed', 'true');
    res.json({ id, labId, studentId, language, status, createdAt });
  };

  /** @type {import('express').RequestHandler<{ id: string }>} */
  get = async (req, res) => {
    const user = res.locals.user;
    const submission = await this.submissionService.getVisible(
      user,
      req.params.id,
    );
    const { id, labId, studentId, language, status, createdAt } = submission;
    res.json({ id, labId, studentId, language, status, createdAt });
  };
}
