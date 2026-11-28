import { z } from 'zod';
import { assertStaff } from '../../auth/service/roles.js';
import { parseBody } from '../../../shared/validation.js';

const createSchema = z.strictObject({
  classId: z.string().min(1),
  title: z.string().min(1).max(200),
  statement: z.string().min(1).max(20_000),
  tests: z
    .array(z.strictObject({ input: z.string(), expectedOutput: z.string() }))
    .min(1)
    .max(200),
  constraints: z
    .array(
      z.strictObject({
        text: z.string().min(1).max(500),
        deduction: z.number().min(0).max(100),
      }),
    )
    .max(20),
  deadline: z.iso.datetime({ offset: true }),
});

const decisionSchema = z
  .strictObject({
    verdict: z.enum(['pass', 'violation']),
    evidenceLines: z.array(z.number().int()).max(200).optional(),
  })
  .superRefine((body, ctx) => {
    const n = body.evidenceLines?.length ?? 0;
    if (body.verdict === 'violation' && n === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['evidenceLines'],
        message: 'A violation needs at least one evidence line.',
      });
    }
    if (body.verdict === 'pass' && n > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['evidenceLines'],
        message: 'A pass takes no evidence lines.',
      });
    }
  });

/**
 * Staff see the whole lab; a student does not see the expected outputs.
 * @param {import('../repository/labs.repository.js').Lab} lab
 * @param {'admin' | 'ta' | 'student'} role
 */
function labView(lab, role) {
  const view = {
    id: lab.id,
    classId: lab.classId,
    title: lab.title,
    statement: lab.statement,
    tests: lab.tests,
    constraints: lab.constraints,
    deadline: lab.deadline.toISOString(),
  };
  if (role === 'student') delete view.tests;
  return view;
}

export class LabsController {
  /** @param {{ labService: import('../service/labs.service.js').LabService }} deps */
  constructor({ labService }) {
    this.labService = labService;
  }

  /** @type {import('express').RequestHandler<{ labId: string }>} */
  get = async (req, res) => {
    const user = res.locals.user;
    const lab = await this.labService.getVisible(user, req.params.labId);
    res.json(labView(lab, user.role));
  };

  /** @type {import('express').RequestHandler} */
  create = async (req, res) => {
    const user = res.locals.user;
    assertStaff(user, 'Only TAs and admins create labs.');
    const input = parseBody(createSchema, req.body);
    const lab = await this.labService.create(user, {
      ...input,
      deadline: new Date(input.deadline),
    });
    res.status(201).location(`/labs/${lab.id}`).json(labView(lab, user.role));
  };

  /** @type {import('express').RequestHandler<{ labId: string }>} */
  reviewQueue = async (req, res) => {
    res.json(
      await this.labService.openReviewQueue(res.locals.user, req.params.labId),
    );
  };

  /** @type {import('express').RequestHandler<{ labId: string, verdictId: string }>} */
  decide = async (req, res) => {
    const user = res.locals.user;
    const lab = await this.labService.getReviewable(user, req.params.labId);
    const input = parseBody(decisionSchema, req.body);
    res.json(
      await this.labService.decide(user, lab, req.params.verdictId, input),
    );
  };
}
