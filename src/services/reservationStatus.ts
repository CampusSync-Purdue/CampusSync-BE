import { DateTime } from 'luxon'
import { toUtc } from '../utils/dateTime.js'
import type {
  Reservation,
  ReservationStatus,
  ReservationTimeframe,
  StoredReservationStatus,
} from '../types/reservation.js'

/**
 * Reservation status derivation (CSYNC-33 / US-24).
 *
 * A reservation leaves `active` in one of two ways:
 *
 * - Someone cancels it, which writes `cancelled` to the database.
 * - Its end time passes, which writes nothing at all.
 *
 * The second case is derived here at read time rather than by a scheduled
 * job. That keeps the database free of a background writer whose failure
 * would silently leave stale rows, and it makes "completed" exact to the
 * instant instead of accurate only to the job's interval.
 *
 * The `completed` stored value stays part of the schema so that a future
 * materialising job can be added without a migration; this module treats an
 * already-stored `completed` as authoritative.
 *
 * See `docs/reservation-status-model.md`.
 */

function toInstant(timestamp: string): DateTime {
  return DateTime.fromISO(toUtc(timestamp), { zone: 'utc' })
}

/**
 * Resolves the status a caller should be shown.
 *
 * Cancellation is terminal: a cancelled reservation stays cancelled however
 * long ago it ended, so cancelled bookings are never reported as completed.
 *
 * @param storedStatus the `reservations.status` value
 * @param endTime the reservation's end, as an ISO 8601 instant with an offset
 * @param now the instant to evaluate against; defaults to the current time
 */
export function deriveReservationStatus(
  storedStatus: StoredReservationStatus,
  endTime: string,
  now: Date = new Date(),
): ReservationStatus {
  if (storedStatus !== 'active') {
    return storedStatus
  }

  const hasEnded = toInstant(endTime) <= DateTime.fromJSDate(now, { zone: 'utc' })

  return hasEnded ? 'completed' : 'active'
}

/**
 * Splits reservations into the two sections the My Bookings page shows.
 * Only a still-running or future active reservation counts as upcoming.
 */
export function deriveReservationTimeframe(
  storedStatus: StoredReservationStatus,
  endTime: string,
  now: Date = new Date(),
): ReservationTimeframe {
  return deriveReservationStatus(storedStatus, endTime, now) === 'active'
    ? 'upcoming'
    : 'past'
}

/**
 * True when an administrator or owner is still allowed to cancel. A booking
 * that has already ended, or that is no longer active, cannot be cancelled.
 */
export function isCancellable(
  reservation: Pick<Reservation, 'status' | 'endTime'>,
  now: Date = new Date(),
): boolean {
  return deriveReservationStatus(reservation.status, reservation.endTime, now) === 'active'
}
