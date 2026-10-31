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

export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await pool.query('SELECT 1')

    return true
  } catch {
    return false
  }
}

/** A label unique to one test run, so parallel runs cannot collide. */
export function testTag(prefix: string): string {
  return `${prefix}-${process.pid}-${Date.now()}`
}

/**
 * Inserts a user that reservations can reference, and returns its id.
 * `suffix` distinguishes several users within one run.
 */
export async function insertTestUser(
  tag: string,
  suffix = '',
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, 'not-a-real-hash', $3)
     RETURNING id`,
    [`Test User ${tag}${suffix}`, `${tag}${suffix}@example.test`, 'user'],
  )

  return result.rows[0].id
}

type TestRoom = {
  tag: string
  name: string
  capacity?: number
  isActive?: boolean
  availabilityHours?: Record<string, { open: string; close: string }>
}

/** Inserts a room tagged for this run, and returns its id. */
export async function insertTestRoom(room: TestRoom): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO rooms (name, location, capacity, availability_hours, is_active)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [
      room.name,
      room.tag,
      room.capacity ?? 10,
      JSON.stringify(room.availabilityHours ?? {}),
      room.isActive ?? true,
    ],
  )

  return result.rows[0].id
}

/** Inserts a reservation, returning its id. */
export async function insertTestReservation(reservation: {
  userId: string
  roomId: string
  startUtc: string
  endUtc: string
  status?: 'active' | 'cancelled' | 'completed'
}): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO reservations (user_id, room_id, start_time, end_time, status)
     VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5)
     RETURNING id`,
    [
      reservation.userId,
      reservation.roomId,
      reservation.startUtc,
      reservation.endUtc,
      reservation.status ?? 'active',
    ],
  )

  return result.rows[0].id
}

/**
 * Removes everything this run created. Rooms are tagged by `location` and
 * users by an email built from the same tag, so one run never disturbs
 * another's rows.
 */
export async function cleanUpTestData(tag: string): Promise<void> {
  await pool.query(
    `DELETE FROM reservations
      WHERE room_id IN (SELECT id FROM rooms WHERE location = $1)
         OR user_id IN (SELECT id FROM users WHERE email LIKE $2)`,
    [tag, `${tag}%@example.test`],
  )
  await pool.query('DELETE FROM rooms WHERE location = $1', [tag])
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${tag}%@example.test`])
}

/** Removes a single user by email. Test-only, so the repository stays clean. */
export async function deleteTestUserByEmail(email: string): Promise<void> {
  await pool.query('DELETE FROM users WHERE lower(email) = lower($1)', [email])
}
