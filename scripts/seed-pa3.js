import { pathToFileURL } from 'node:url';
import { hashPassword } from '../src/modules/auth/service/passwords.js';
import { createPool } from '../src/shared/db.js';

export const SEED_CLASSES = [
  { id: 'class-a', name: 'Class A' },
  { id: 'class-b', name: 'Class B' },
];

export const SEED_USERS = [
  {
    id: 'admin-1',
    email: 'admin@leettkob.dev',
    password: 'AdminTest#2026',
    role: 'admin',
    scope: 'Global',
  },
  {
    id: 'ta-1',
    email: 'ta1@leettkob.dev',
    password: 'Ta1Test#2026',
    role: 'ta',
    staffClassId: 'class-a',
    scope: 'Class A',
  },
  {
    id: 'ta-2',
    email: 'ta2@leettkob.dev',
    password: 'Ta2Test#2026',
    role: 'ta',
    staffClassId: 'class-b',
    scope: 'Class B',
  },
  {
    id: 'student-1',
    email: 'student1@student.hcmus.edu.vn',
    password: 'Student1Test#2026',
    role: 'student',
    enrollClassId: 'class-a',
    scope: 'Class A',
  },
  {
    id: 'student-2',
    email: 'student2@student.hcmus.edu.vn',
    password: 'Student2Test#2026',
    role: 'student',
    enrollClassId: 'class-a',
    scope: 'Class A',
  },
];

/**
 * Idempotently seeds Class A, Class B, and the 5 synthetic PA#3 test accounts.
 * @param {import('pg').Pool} pool
 */
export async function seedPa3(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const cls of SEED_CLASSES) {
      await client.query(
        `INSERT INTO classes (id, name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [cls.id, cls.name],
      );
    }

    for (const user of SEED_USERS) {
      const passwordHash = await hashPassword(user.password);
      await client.query(
        `INSERT INTO users (id, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [user.id, user.email, passwordHash, user.role],
      );

      const resolved = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email],
      );
      const userId = String(resolved.rows[0].id);

      if (user.staffClassId) {
        await client.query(
          `INSERT INTO class_staff (class_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (class_id, user_id) DO NOTHING`,
          [user.staffClassId, userId],
        );
      }

      if (user.enrollClassId) {
        await client.query(
          `INSERT INTO class_enrollments (class_id, student_id)
           VALUES ($1, $2)
           ON CONFLICT (class_id, student_id) DO NOTHING`,
          [user.enrollClassId, userId],
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required.');
    process.exitCode = 1;
    return;
  }

  const pool = createPool(databaseUrl);
  try {
    await seedPa3(pool);
    console.log('PA#3 seed complete. Synthetic test accounts:');
    console.table(
      SEED_USERS.map(({ email, password, role, scope }) => ({
        role,
        email,
        password,
        scope,
      })),
    );
  } finally {
    await pool.end();
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
