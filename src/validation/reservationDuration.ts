import { elapsedMinutes } from '../utils/dateTime.js'
import {
  MAX_RESERVATION_DURATION_MINUTES,
  describeMaxDuration,
} from '../config/reservationRules.js'

/**
 * Server-side duration check (CSYNC-19 / US-10).
 *
 * Duration is measured as elapsed time between absolute UTC instants, never
 * by subtracting wall-clock readings, per `docs/date-time-conventions.md`
 * section 7. A window that looks like two hours on the clock can be one or
 * three across a daylight saving transition, and the limit applies to the
 * time the room is actually occupied.
 *
 * This is the check any endpoint that accepts a reservation window should
 * call: the availability search uses it today, and creating a reservation
 * (US-08) should use it too.
 */
export type DurationValidationResult =
  | { valid: true; minutes: number }
  | { valid: false; minutes: number; message: string }

export function validateReservationDuration(
  startUtc: string,
  endUtc: string,
  maxMinutes: number = MAX_RESERVATION_DURATION_MINUTES,
): DurationValidationResult {
  const minutes = elapsedMinutes(startUtc, endUtc)

  if (minutes > maxMinutes) {
    return {
      valid: false,
      minutes,
      message: `A reservation may not be longer than ${describeMaxDuration(maxMinutes)}.`,
    }
  }

  return { valid: true, minutes }
}
