import { z } from 'zod';
import { ProblemError } from '../problems.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { signToken, TOKEN_TTL_SECONDS } from '../auth/tokens.js';

const bodySchema = z.strictObject({
  email: z.string().min(1),
  password: z.string().min(1),
});

export class AuthController {
  /**
   * @param {{
   *   userRepository: { findByEmail(email: string): Promise<import('../repositories/in-memory.js').User | undefined> },
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

  /** @type {import('express').RequestHandler} */
  login = async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
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
    const { email, password } = parsed.data;
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
    res.json({ token, tokenType: 'Bearer', expiresIn: TOKEN_TTL_SECONDS });
  };
}
