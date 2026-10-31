import type { ReservationRecord } from '../db/schema.js'

/**
 * Reservation statuses and shapes.
 *
 * Two status vocabularies exist on purpose, and the distinction matters:
 *
 * - `StoredReservationStatus` is what the `reservations.status` column holds.
 *   Only an explicit action writes it.
 * - `ReservationStatus` is what a caller is shown. It is derived from the
 *   stored status and the reservation's end time at read time.
 *
 * See `docs/reservation-status-model.md` (CSYNC-33) for the full model.
 */

/** The values permitted by the `reservations_status_check` constraint. */
export type StoredReservationStatus = 'active' | 'cancelled' | 'completed'

/** The status presented to a caller, after time-based derivation. */
export type ReservationStatus = StoredReservationStatus

/**
 * Whether a reservation still lies ahead. Only a reservation that is active
 * and has not yet ended is upcoming; everything else belongs to history.
 */
export type ReservationTimeframe = 'upcoming' | 'past'

/** A reservation row, with columns mapped to camelCase. */
export type Reservation = {
  id: string
  userId: string
  roomId: string
  /** ISO 8601 UTC instant, e.g. `2026-10-21T18:00:00.000Z`. */
  startTime: string
  /** ISO 8601 UTC instant. Always greater than `startTime`. */
  endTime: string
  status: StoredReservationStatus
  createdAt: string
  updatedAt: string
}

/** The room fields shown alongside a reservation, so callers need no second request. */
export type ReservationRoomSummary = {
  id: string
  name: string
  location: string
  capacity: number
}

/**
 * A reservation as returned by the API: the stored row with its derived
 * status and timeframe, plus the room it reserves.
 */
export type ReservationView = Omit<Reservation, 'status' | 'roomId'> & {
  status: ReservationStatus
  timeframe: ReservationTimeframe
  room: ReservationRoomSummary
}

/* ---- Booking creation (CSYNC-17) ---- */

/**
 * A reservation row as Drizzle returns it, with `Date` columns.
 *
 * `Reservation` above is the same row after the repository maps it to the
 * ISO strings the API speaks. Keep the two apart: only code talking directly
 * to Drizzle should see this one.
 */
export type InsertedReservation = ReservationRecord

/** Confirmation data returned after creating a reservation. Times are UTC ISO strings. */
export type ReservationConfirmation = {
  id: string
  roomId: string
  roomName: string
  roomLocation: string
  userId: string
  startTime: string
  endTime: string
  status: ReservationStatus
  createdAt: string
}

/** A booked time range for a room. Times are UTC ISO strings; no user details. */
export type BookedInterval = {
  startTime: string
  endTime: string
  /** True when the signed-in requester made this reservation. */
  isMine: boolean
}

export type RoomAvailability = {
  roomId: string
  /** Campus-local date, YYYY-MM-DD. */
  date: string
  timeZone: string
  /** Campus-local opening hours that day, or null when closed. */
  openingHours: { open: string; close: string } | null
  booked: BookedInterval[]
}
