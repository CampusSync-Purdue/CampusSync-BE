import { and, asc, eq, gt, lt } from 'drizzle-orm'
import { db } from '../db/index.js'
import { reservations } from '../db/schema.js'
import type { InsertedReservation } from '../types/reservation.js'
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

/**
 * Every reservation with its room, newest first.
 *
 * Provisional: US-15 (CSYNC-24) owns the administrator reservation view and
 * will want filtering and paging. This exists so the administrator
 * cancellation action (US-16) has something to act on.
 */
export async function findAllReservations(): Promise<ReservationWithRoom[]> {
  const result = await pool.query<ReservationRow>(
    `SELECT ${RESERVATION_COLUMNS}
       FROM reservations
       JOIN rooms ON rooms.id = reservations.room_id
      ORDER BY reservations.start_time DESC`,
  )

  return result.rows.map(toReservationWithRoom)
}

/**
 * Marks a reservation cancelled and returns it.
 *
 * The row is kept, not deleted, so the booking stays in the user's history
 * (US-16). `status = 'active'` in the WHERE clause makes this a no-op on a
 * reservation that is already cancelled, so two concurrent cancellations
 * cannot both report success; the caller reads `undefined` and reports a
 * conflict.
 *
 * Because the exclusion constraint only covers active rows, cancelling frees
 * the time range for a new booking immediately.
 */
export async function cancelReservationById(
  reservationId: string,
): Promise<ReservationWithRoom | undefined> {
  const updated = await pool.query<{ id: string }>(
    `UPDATE reservations
        SET status = 'cancelled', updated_at = now()
      WHERE id = $1
        AND status = 'active'
      RETURNING id`,
    [reservationId],
  )

  if (updated.rowCount === 0) {
    return undefined
  }

  return findReservationById(reservationId)
}

/* ---- Booking creation (CSYNC-17) ---- */

export type NewReservation = {
  userId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
};

/**
 * Inserts an active reservation.
 *
 * @throws the driver error with SQLSTATE 23P01 when it overlaps another active
 * reservation for the same room (reservations_no_overlap), or 23503 when the
 * user or room no longer exists.
 */
export async function insertReservation(record: NewReservation): Promise<InsertedReservation> {
  const [reservation] = await db
    .insert(reservations)
    .values({ ...record, status: "active" })
    .returning();

  return reservation;
}

/**
 * Active reservations for a room that overlap [from, to). The user id is
 * selected only so callers can tell the requester's own bookings apart; it
 * must not be returned to clients.
 */
export async function findActiveReservationTimesForRoom(
  roomId: string,
  from: Date,
  to: Date,
): Promise<Array<{ userId: string; startTime: Date; endTime: Date }>> {
  return db
    .select({
      userId: reservations.userId,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.roomId, roomId),
        eq(reservations.status, "active"),
        lt(reservations.startTime, to),
        gt(reservations.endTime, from),
      ),
    )
    .orderBy(asc(reservations.startTime));
}
