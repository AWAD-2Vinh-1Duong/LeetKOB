import pg from 'pg';
const { Pool } = pg;

/**
 * Creates a PostgreSQL connection pool.
 * @param {string} [connectionString]
 * @returns {import('pg').Pool}
 */
export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is required to connect to PostgreSQL',
    );
  }
  return new Pool({ connectionString });
}
