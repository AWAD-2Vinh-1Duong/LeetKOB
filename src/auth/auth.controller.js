import { z } from 'zod';
import { parseBody } from '../shared/validation.js';

const bodySchema = z.strictObject({
  email: z.string().min(1),
  password: z.string().min(1),
});

export class AuthController {
  /** @param {{ authService: import('./auth.service.js').AuthService }} deps */
  constructor({ authService }) {
    this.authService = authService;
  }

  /** @type {import('express').RequestHandler} */
  login = async (req, res) => {
    const credentials = parseBody(bodySchema, req.body);
    res.json(await this.authService.login(credentials));
  };
}
