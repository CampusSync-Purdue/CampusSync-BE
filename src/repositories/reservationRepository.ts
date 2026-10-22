import { pool } from '../config/database.js'
import type { Reservation, ReservationRoomSummary } from '../types/reservation.js'

/**
 * Database access for reservations. This is the only module that knows how
 * reservations are queried, so the services above it never build SQL.
 */

type ReservationRow = {
  id: string
  user_id: string
  room_id: string
  start_time: Date
  end_time: Date
  status: Reservation['status']
  created_at: Date
  updated_at: Date
  room_name: string
  room_location: string
  room_capacity: number
}

/** A reservation together with the room it reserves. */
export type ReservationWithRoom = Reservation & {
  room: ReservationRoomSummary
}

const RESERVATION_COLUMNS = `
  reservations.id,
  reservations.user_id,
  reservations.room_id,
  reservations.start_time,
  reservations.end_time,
  reservations.status,
  reservations.created_at,
  reservations.updated_at,
  rooms.name     AS room_name,
  rooms.location AS room_location,
  rooms.capacity AS room_capacity
`

/**
 * Timestamps leave this layer as ISO 8601 UTC strings, per
 * `docs/date-time-conventions.md` section 3, so nothing above it handles a
 * `Date` whose own time zone could be read by accident.
 */
function toReservationWithRoom(row: ReservationRow): ReservationWithRoom {
  return {
    id: row.id,
    userId: row.user_id,
    roomId: row.room_id,
    startTime: row.start_time.toISOString(),
    endTime: row.end_time.toISOString(),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    room: {
      id: row.room_id,
      name: row.room_name,
      location: row.room_location,
      capacity: Number(row.room_capacity),
    },
  }
}

/**
 * Every reservation belonging to one user, newest first.
 *
 * Filtering by `user_id` in SQL is what keeps a caller from seeing anyone
 * else's bookings; the handler never widens it.
 */
export async function findReservationsByUserId(
  userId: string,
): Promise<ReservationWithRoom[]> {
  const result = await pool.query<ReservationRow>(
    `SELECT ${RESERVATION_COLUMNS}
       FROM reservations
       JOIN rooms ON rooms.id = reservations.room_id
      WHERE reservations.user_id = $1
      ORDER BY reservations.start_time DESC`,
    [userId],
  )

  return result.rows.map(toReservationWithRoom)
}

/** One reservation with its room, or undefined when no such row exists. */
export async function findReservationById(
  reservationId: string,
): Promise<ReservationWithRoom | undefined> {
  const result = await pool.query<ReservationRow>(
    `SELECT ${RESERVATION_COLUMNS}
       FROM reservations
       JOIN rooms ON rooms.id = reservations.room_id
      WHERE reservations.id = $1`,
    [reservationId],
  )

  return result.rows[0] ? toReservationWithRoom(result.rows[0]) : undefined
}
