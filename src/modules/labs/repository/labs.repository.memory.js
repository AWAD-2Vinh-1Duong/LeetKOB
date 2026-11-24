/** @typedef {import('./labs.repository.js').Lab} Lab */
/** @typedef {import('./labs.repository.js').Viewer} Viewer */

// shortcut: in-memory stores lose data on restart; the app uses the PostgreSQL repository.
export class InMemoryLabRepository {
  /** @param {{ labs: Lab[], enrollments: Array<{ studentId: string, classId: string }>, staff?: Array<{ userId: string, classId: string }>, classes?: string[] }} seed */
  constructor({ labs, enrollments, staff = [], classes = [] }) {
    this.classes = new Set([
      ...classes,
      ...labs.map((l) => l.classId),
      ...enrollments.map((e) => e.classId),
      ...staff.map((s) => s.classId),
    ]);
    this.staff = new Set(staff.map((s) => `${s.userId}\0${s.classId}`));
    this.labs = new Map(labs.map((lab) => [lab.id, lab]));
    this.enrollments = new Set(
      enrollments.map((e) => `${e.studentId}\0${e.classId}`),
    );
  }

  /**
   * The lab, only if the student is enrolled in its class.
   * @param {string} labId
   * @param {string} studentId
   * @returns {Promise<Lab | undefined>}
   */
  async findForStudent(labId, studentId) {
    const lab = this.labs.get(labId);
    return lab && this.enrollments.has(`${studentId}\0${lab.classId}`)
      ? lab
      : undefined;
  }

  /**
   * The lab, only if the caller may see it: an admin always, a TA of its class,
   * or a student enrolled in its class.
   * @param {string} labId
   * @param {Viewer} viewer
   * @returns {Promise<Lab | undefined>}
   */
  async findForUser(labId, viewer) {
    const lab = this.labs.get(labId);
    if (!lab) return undefined;
    const key = `${viewer.id}\0${lab.classId}`;
    const allowed =
      viewer.role === 'admin' ||
      (viewer.role === 'ta' && this.staff.has(key)) ||
      (viewer.role === 'student' && this.enrollments.has(key));
    return allowed ? lab : undefined;
  }

  /**
   * Whether the caller may create labs in the class: an admin in any existing
   * class, a TA only in a class they teach.
   * @param {Viewer} viewer
   * @param {string} classId
   * @returns {Promise<boolean>}
   */
  async canManageClass(viewer, classId) {
    if (viewer.role === 'admin') return this.classes.has(classId);
    return viewer.role === 'ta' && this.staff.has(`${viewer.id}\0${classId}`);
  }

  /**
   * @param {Lab} lab
   * @returns {Promise<Lab>}
   */
  async create(lab) {
    this.labs.set(lab.id, lab);
    return lab;
  }
}
