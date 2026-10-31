import { WEEKDAYS, type OperatingHours, type Weekday } from '../types/room.js'

/**
 * Operating-hours checks for the availability search (CSYNC-15 / US-06).
 *
 * `rooms.availability_hours` holds recurring campus-local wall-clock times,
 * so these comparisons are made on `HH:mm` text rather than instants. Both
 * values are zero-padded 24-hour times, which makes lexicographic order the
 * same as chronological order.
 *
 * `docs/date-time-conventions.md` section 5 leaves two questions to this
 * feature. Both are answered here:
 *
 * - **An empty `availability_hours` does not mean a room is open all day.** A
 *   room with no published hours for the requested day is treated as closed
 *   and excluded from results. Publishing no hours and being open around the
 *   clock are very different claims, and the safe reading of silence is that
 *   the room cannot be booked. US-13 makes operating hours required when a
 *   room is created, so a room reaching the catalog always carries them.
 * - **Overnight hours are supported.** A `close` at or before `open`, such as
 *   `{ open: "20:00", close: "02:00" }`, denotes hours running past midnight.
 */

/** The campus-local weekday a `YYYY-MM-DD` date falls on. */
export function weekdayOf(date: string): Weekday {
  const [year, month, day] = date.split('-').map(Number)

  // A plain calendar date has no time zone of its own. Reading it as UTC
  // keeps the weekday stable regardless of where the server runs.
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
}

/** True when a day's hours run past midnight into the following day. */
export function isOvernight(hours: { open: string; close: string }): boolean {
  return hours.close <= hours.open
}

/**
 * Whether a requested window falls entirely inside a room's operating hours
 * for that date.
 *
 * @param hours the room's weekly hours
 * @param date campus-local date, `YYYY-MM-DD`
 * @param startTime campus-local start, `HH:mm`
 * @param endTime campus-local end, `HH:mm`, later than `startTime`
 */
export function isWithinOperatingHours(
  hours: OperatingHours,
  date: string,
  startTime: string,
  endTime: string,
): boolean {
  const dayHours = hours[weekdayOf(date)]

  if (!dayHours) {
    return false
  }

  if (!isOvernight(dayHours)) {
    return startTime >= dayHours.open && endTime <= dayHours.close
  }

  // Overnight hours leave the room closed in the middle of the day, so the
  // window has to sit wholly in the evening segment (open → midnight) or
  // wholly in the early-morning one (midnight → close). The request is
  // confined to a single date and `endTime` is later than `startTime`, so
  // each segment reduces to a single comparison.
  const inEveningSegment = startTime >= dayHours.open
  const inMorningSegment = endTime <= dayHours.close

  return inEveningSegment || inMorningSegment
}
