/** @typedef {import('./users.repository.js').User} User */

// shortcut: in-memory stores lose data on restart; the app uses the PostgreSQL repository.
export class InMemoryUserRepository {
  /** @param {{ users: User[] }} seed */
  constructor({ users }) {
    this.byEmail = new Map(users.map((u) => [u.email, u]));
  }

  /**
   * @param {string} email
   * @returns {Promise<User | undefined>}
   */
  async findByEmail(email) {
    return this.byEmail.get(email);
  }
}
