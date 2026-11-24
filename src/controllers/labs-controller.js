import { z } from 'zod';
import { ProblemError } from '../problems.js';

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
 * @param {import('../repositories/in-memory.js').Lab} lab
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
  /**
   * @param {{ labService: import('../services/lab-service.js').LabService, labRepository: { findForUser(labId: string, viewer: import('../repositories/in-memory.js').Viewer): Promise<import('../repositories/in-memory.js').Lab | undefined> } }} deps
   */
  constructor({ labService, labRepository }) {
    this.labService = labService;
    this.labRepository = labRepository;
  }

  /**
   * The lab, or 404 for a lab that is missing and for one the caller cannot see.
   * @param {string} labId
   * @param {import('../middlewares/auth.js').AuthUser} user
   */
  async #visibleLab(labId, user) {
    const lab = await this.labRepository.findForUser(labId, user);
    if (!lab) {
      throw new ProblemError(
        'lab-not-found',
        `No lab "${labId}" is open to you.`,
      );
    }
    return lab;
  }

  /** @type {import('express').RequestHandler<{ labId: string }>} */
  get = async (req, res) => {
    const lab = await this.#visibleLab(req.params.labId, res.locals.user);
    res.json(labView(lab, res.locals.user.role));
  };

  /** @type {import('express').RequestHandler} */
  create = async (req, res) => {
    /** @type {import('../middlewares/auth.js').AuthUser} */
    const user = res.locals.user;
    if (user.role === 'student') {
      throw new ProblemError('staff-only', 'Only TAs and admins create labs.');
    }
    const parsed = createSchema.safeParse(req.body);
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
    const lab = await this.labService.create(user, {
      ...parsed.data,
      deadline: new Date(parsed.data.deadline),
    });
    res.status(201).location(`/labs/${lab.id}`).json(labView(lab, user.role));
  };

  /** @type {import('express').RequestHandler<{ labId: string }>} */
  reviewQueue = async (req, res) => {
    /** @type {import('../middlewares/auth.js').AuthUser} */
    const user = res.locals.user;
    await this.#visibleLab(req.params.labId, user);
    if (user.role === 'student') {
      throw new ProblemError(
        'staff-only',
        'Only TAs and admins open the review queue.',
      );
    }
    res.json({ items: [] });
  };
}
