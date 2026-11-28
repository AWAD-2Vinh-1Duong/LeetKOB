import { ProblemError } from '../../../shared/problems.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { signToken, TOKEN_TTL_SECONDS } from './tokens.js';

export class AuthService {
  /**
   * @param {{
   *   userRepository: import('../repository/users.repository.js').UserRepository,
   *   jwtSecret: string,
   *   now: () => Date,
   * }} deps
   */
  constructor({ userRepository, jwtSecret, now }) {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
    this.now = now;
    // Checked when the email is unknown, so both failures take about as long.
    this.decoy = hashPassword('decoy-password');
  }

  /**
   * An unknown email and a wrong password give the same error, so callers cannot
   * learn which emails exist.
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<{ token: string, tokenType: 'Bearer', expiresIn: number }>}
   */
  async login({ email, password }) {
    const user = await this.userRepository.findByEmail(email);
    const ok = await verifyPassword(
      password,
      user ? user.passwordHash : await this.decoy,
    );
    if (!user || !ok) {
      throw new ProblemError(
        'invalid-credentials',
        'The email or the password is wrong.',
      );
    }
    const token = await signToken(
      { sub: user.id, role: user.role },
      { secret: this.jwtSecret, now: this.now() },
    );
    return { token, tokenType: 'Bearer', expiresIn: TOKEN_TTL_SECONDS };
  }
}
