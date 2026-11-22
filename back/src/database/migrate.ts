import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * Applies the SQL already generated into `drizzle/` by drizzle-kit.
 *
 * This exists so the production image does not have to carry drizzle-kit and
 * the whole dev dependency tree: `drizzle-orm`'s migrator only needs the
 * generated SQL files and the journal, both of which are copied into the image.
 * Generating new migrations is still a `drizzle-kit generate` job on a
 * developer machine.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }

  const pool = new Pool({ connectionString });

  try {
    await migrate(drizzle(pool), {
      migrationsFolder: resolve(process.cwd(), 'drizzle'),
    });
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
