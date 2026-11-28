/**
 * Reads the settings the server needs from the environment, once, at start-up.
 * Everything else receives its settings through the container, never from `process.env`.
 * @param {Record<string, string | undefined>} env
 * @returns {{ jwtSecret: string, databaseUrl: string, port: number, logLevel: string }}
 */
export function loadConfig(env) {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET is required and must be at least 32 characters.',
    );
  }
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const port = env.PORT ? Number(env.PORT) : 3000;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return { jwtSecret, databaseUrl, port, logLevel: env.LOG_LEVEL || 'info' };
}
