import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { Database } from './index.js'

// Resolves to <project>/drizzle from both src/db and dist/db.
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))

/** Applies every pending drizzle-kit migration. Safe to run repeatedly. */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}
