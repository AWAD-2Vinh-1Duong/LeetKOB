import { z } from 'zod';
import { assertStaff } from '../auth/roles.js';
import { parseBody } from '../shared/validation.js';

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

/**
 * Staff see the whole lab; a student does not see the expected outputs.
 * @param {import('./labs.repository.js').Lab} lab
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
  /** @param {{ labService: import('./labs.service.js').LabService }} deps */
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
}
