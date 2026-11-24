/** @typedef {import('./users.repository.js').User} User */

export class PostgresUserRepository {
  /** @param {{ pool: import('pg').Pool }} deps */
  constructor({ pool }) {
    this.pool = pool;
  }

  /**
   * @param {string} email
   * @returns {Promise<User | undefined>}
   */
  async findByEmail(email) {
    const res = await this.pool.query(
      `SELECT id, email, password_hash AS "passwordHash", role FROM users WHERE email = $1`,
      [email],
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: String(row.id),
      email: String(row.email),
      passwordHash: String(row.passwordHash),
      role: row.role,
    };
  }
}
