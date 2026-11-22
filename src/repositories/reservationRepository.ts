import { and, asc, eq, gt, lt } from 'drizzle-orm'
import { db } from '../db/index.js'
import { reservations } from '../db/schema.js'
import type { InsertedReservation } from '../types/reservation.js'
import { pool } from '../config/database.js'
import type {
  Reservation,
  ReservationRoomSummary,
  ReservationStatus,
  ReservationUserSummary,
} from '../types/reservation.js'

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

/** A reservation together with its room and the user who made it. */
export type ReservationWithRoomAndUser = ReservationWithRoom & {
  user: ReservationUserSummary
}

type ReservationWithUserRow = ReservationRow & {
  user_name: string
  user_email: string
}

export type AdminReservationFilters = {
  /** Only reservations starting at or after this instant. */
  startsFrom?: Date
  /** Only reservations starting before this instant. */
  startsBefore?: Date
  roomId?: string
  /** A derived status; see DERIVED_STATUS_SQL. */
  status?: ReservationStatus
  sort: 'date' | 'room' | 'status'
  order: 'asc' | 'desc'
}

/**
 * The derived status in SQL, mirroring `deriveReservationStatus` in
 * `services/reservationStatus.ts`: an active reservation whose end has passed
 * is completed. `$1` is always the evaluation instant. The two must agree, or
 * filtering by status would disagree with the status a row is shown with;
 * `adminReservations.test.ts` checks that they do.
 */
const DERIVED_STATUS_SQL = `
  CASE
    WHEN reservations.status = 'active' AND reservations.end_time <= $1
      THEN 'completed'
    ELSE reservations.status
  END`

/**
 * ORDER BY clauses for each sort field. Only these fixed strings are ever
 * placed in the SQL text; the caller's choice selects one of them. Start time
 * and then id break ties, so rows with equal keys keep a stable order.
 */
const ORDER_BY_SQL: Record<
  AdminReservationFilters['sort'],
  (direction: 'ASC' | 'DESC') => string
> = {
  date: (direction) =>
    `reservations.start_time ${direction}, reservations.id ${direction}`,
  room: (direction) =>
    `lower(rooms.name) ${direction}, reservations.start_time ASC, reservations.id ASC`,
  status: (direction) =>
    `derived_status ${direction}, reservations.start_time ASC, reservations.id ASC`,
}

/**
 * Every reservation matching the filters, with its room and reserving user,
 * for the administrator view (US-15).
 *
 * Filtering and sorting happen in SQL so the result is correct however many
 * reservations exist. Every caller-supplied value is a bound parameter.
 */
export async function findReservationsForAdmin(
  filters: AdminReservationFilters,
  now: Date,
): Promise<ReservationWithRoomAndUser[]> {
  const conditions: string[] = []
  const values: unknown[] = [now]

  if (filters.startsFrom) {
    values.push(filters.startsFrom)
    conditions.push(`reservations.start_time >= $${values.length}`)
  }
  if (filters.startsBefore) {
    values.push(filters.startsBefore)
    conditions.push(`reservations.start_time < $${values.length}`)
  }
  if (filters.roomId) {
    values.push(filters.roomId)
    conditions.push(`reservations.room_id = $${values.length}`)
  }
  if (filters.status) {
    values.push(filters.status)
    conditions.push(`(${DERIVED_STATUS_SQL}) = $${values.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const direction = filters.order === 'asc' ? 'ASC' : 'DESC'

  const result = await pool.query<ReservationWithUserRow>(
    `SELECT ${RESERVATION_COLUMNS},
            users.name  AS user_name,
            users.email AS user_email,
            ${DERIVED_STATUS_SQL} AS derived_status
       FROM reservations
       JOIN rooms ON rooms.id = reservations.room_id
       JOIN users ON users.id = reservations.user_id
      ${where}
      ORDER BY ${ORDER_BY_SQL[filters.sort](direction)}`,
    values,
  )

  return result.rows.map((row) => ({
    ...toReservationWithRoom(row),
    user: { id: row.user_id, name: row.user_name, email: row.user_email },
  }))
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
 *
 * This function is used for administrator cancellation.
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

/**
 * Cancels an upcoming active reservation belonging to a specific user.
 *
 * CSYNC-21 — Cancel my reservation (US-12).
 *
 * A regular user can cancel only their own upcoming, active reservations.
 *
 * The ownership, status, and start-time checks are performed directly
 * in the database to prevent unauthorized or invalid cancellations.
 *
 * The reservation record is preserved with status 'cancelled'.
 * Since the exclusion constraint applies only to active reservations,
 * the cancelled time slot becomes available for new bookings.
 */
export async function cancelOwnReservationById(
  reservationId: string,
  userId: string,
): Promise<ReservationWithRoom | undefined> {
  const updated = await pool.query<{ id: string }>(
    `UPDATE reservations
        SET status = 'cancelled', updated_at = now()
      WHERE id = $1
        AND user_id = $2
        AND status = 'active'
        AND start_time > now()
      RETURNING id`,
    [reservationId, userId],
  )

  if (updated.rowCount === 0) {
    return undefined
  }

  return findReservationById(reservationId)
}

/* ---- Booking creation (CSYNC-17) ---- */

export type NewReservation = {
  userId: string
  roomId: string
  startTime: Date
  endTime: Date
}

/**
 * Inserts an active reservation.
 *
 * @throws the driver error with SQLSTATE 23P01 when it overlaps another active
 * reservation for the same room (reservations_no_overlap), or 23503 when the
 * user or room no longer exists.
 */
export async function insertReservation(
  record: NewReservation,
): Promise<InsertedReservation> {
  const [reservation] = await db
    .insert(reservations)
    .values({ ...record, status: 'active' })
    .returning()

  return reservation
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
        eq(reservations.status, 'active'),
        lt(reservations.startTime, to),
        gt(reservations.endTime, from),
      ),
    )
    .orderBy(asc(reservations.startTime))
}