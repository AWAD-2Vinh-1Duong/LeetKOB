import { ProblemError } from '../problems.js';

export class LabsController {
  /**
   * @param {{ labRepository: { findForUser(labId: string, viewer: import('../repositories/in-memory.js').Viewer): Promise<import('../repositories/in-memory.js').Lab | undefined> } }} deps
   */
  constructor({ labRepository }) {
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
    res.json({
      id: lab.id,
      classId: lab.classId,
      deadline: lab.deadline.toISOString(),
    });
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
