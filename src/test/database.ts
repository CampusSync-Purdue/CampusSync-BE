import { sql } from 'drizzle-orm'
import { pool } from '../config/database.js'
import { db } from '../db/index.js'
import { runMigrations } from '../db/migrate.js'

/**
 * Test-only helpers. `npm test` points DATABASE_URL at TEST_DATABASE_URL
 * (scripts/test-env.ts); the name check below is a second guard so these
 * helpers never wipe a development database.
 */
async function assertTestDatabase(): Promise<void> {
  const result = await db.execute<{ name: string }>(sql`SELECT current_database() AS name`)
  const name = result.rows[0]?.name ?? ''

  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to reset "${name}": test database names must end in "_test".`)
  }
}

export async function setupTestDatabase(): Promise<void> {
  await assertTestDatabase()
  await runMigrations(db)
}

export async function resetTestDatabase(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE reservations, rooms, users CASCADE`)
}

export async function closeTestDatabase(): Promise<void> {
  await pool.end()
}
