/**
 * The user store. Implementations: `users.repository.memory.js`, `users.repository.postgres.js`.
 *
 * @typedef {{ id: string, email: string, passwordHash: string, role: 'admin' | 'ta' | 'student' }} User
 * @typedef {{ findByEmail(email: string): Promise<User | undefined> }} UserRepository
 */

export {};
