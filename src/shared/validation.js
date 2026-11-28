import { ProblemError } from './problems.js';

/**
 * Parses a request body with a zod schema, or throws a 400 `validation-error`
 * that lists every invalid path. Controllers call this; services never see raw input.
 * @template {import('zod').ZodType} S
 * @param {S} schema
 * @param {unknown} body
 * @returns {import('zod').infer<S>}
 */
export function parseBody(schema, body) {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
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
