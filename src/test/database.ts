import { pool } from '../config/database.js'

/**
 * Test helpers for the integration suites.
 *
 * Repository-level behaviour (the overlap test, the exclusion constraint) is
 * only meaningfully verified against a real PostgreSQL instance, so those
 * suites run against one when it is reachable and skip when it is not. That
 * keeps `npm test` green on a machine with no database while still covering
 * the SQL locally and in any environment that provides one.
 */
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

/** Inserts a user that reservations can reference, and returns its id. */
export async function insertTestUser(tag: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, 'not-a-real-hash', $3)
     RETURNING id`,
    [`Test User ${tag}`, `${tag}@example.test`, 'user'],
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
 * Removes everything this run created. Rooms are tagged by `location`, and
 * reservations and users fall away with them.
 */
export async function cleanUpTestData(tag: string): Promise<void> {
  await pool.query(
    `DELETE FROM reservations
      WHERE room_id IN (SELECT id FROM rooms WHERE location = $1)`,
    [tag],
  )
  await pool.query('DELETE FROM rooms WHERE location = $1', [tag])
  await pool.query('DELETE FROM users WHERE email = $1', [`${tag}@example.test`])
}
