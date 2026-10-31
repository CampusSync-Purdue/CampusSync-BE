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
