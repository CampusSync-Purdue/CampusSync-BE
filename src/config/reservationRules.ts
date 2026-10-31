/**
 * Reservation rules (CSYNC-19 / US-10).
 *
 * This module is the single configuration point for how long a reservation
 * may run. Nothing else should hard-code a duration: both the server-side
 * check and the limit published to the browser read from here, so the two can
 * never disagree.
 *
 * Override it with the `MAX_RESERVATION_DURATION_MINUTES` environment
 * variable. An absent, malformed, or non-positive value falls back to the
 * default rather than disabling the limit, because a typo in configuration
 * should not quietly allow unbounded bookings.
 */

/** Three hours: long enough for group study, short enough to share a room. */
export const DEFAULT_MAX_RESERVATION_DURATION_MINUTES = 180

function readMaxDuration(): number {
  const configured = Number(process.env.MAX_RESERVATION_DURATION_MINUTES)

  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_RESERVATION_DURATION_MINUTES
}

export const MAX_RESERVATION_DURATION_MINUTES = readMaxDuration()

/** The limit in the shape the API publishes it, for the browser to display. */
export type ReservationRules = {
  maxDurationMinutes: number
}

export function getReservationRules(): ReservationRules {
  return { maxDurationMinutes: MAX_RESERVATION_DURATION_MINUTES }
}

/**
 * A message naming the limit in whole hours when it divides evenly, and in
 * minutes otherwise, so a three-hour limit does not read as "180 minutes".
 */
export function describeMaxDuration(
  minutes: number = MAX_RESERVATION_DURATION_MINUTES,
): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60

    return hours === 1 ? '1 hour' : `${hours} hours`
  }

  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}
