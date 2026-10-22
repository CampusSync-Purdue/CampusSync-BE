import { DateTime } from 'luxon'

export const CAMPUS_TIME_ZONE = 'America/Indiana/Indianapolis'

/**
 * Converts an ISO 8601 timestamp with an explicit UTC offset
 * into a normalized UTC timestamp.
 */
export function toUtc(timestamp: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp)
  ) {
    throw new Error('Timestamp must include an explicit UTC offset.')
  }

  const dateTime = DateTime.fromISO(timestamp, { setZone: true })

  if (!dateTime.isValid) {
    throw new Error('Invalid timestamp.')
  }

  return dateTime.toUTC().toISO()!
}

/**
 * Converts an absolute timestamp into the campus time zone.
 */
export function toCampusTime(timestamp: string): DateTime {
  const utcTimestamp = toUtc(timestamp)

  return DateTime.fromISO(utcTimestamp, { zone: 'utc' }).setZone(CAMPUS_TIME_ZONE)
}

/**
 * Converts a campus-local date/time to UTC.
 *
 * Rejects nonexistent and ambiguous local times caused by
 * daylight saving time transitions.
 */
export function campusLocalToUtc(localTimestamp: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(localTimestamp)
  ) {
    throw new Error('Expected a campus-local timestamp without an offset.')
  }

  const local = DateTime.fromISO(localTimestamp, {
    zone: CAMPUS_TIME_ZONE,
  })

  if (!local.isValid || local.toFormat("yyyy-MM-dd'T'HH:mm:ss") !== localTimestamp.slice(0, 19)) {
    throw new Error('Nonexistent campus-local time.')
  }

  if (local.getPossibleOffsets().length > 1) {
    throw new Error('Ambiguous campus-local time. Specify an explicit UTC offset.')
  }

  return local.toUTC().toISO()!
}

/**
 * Calculates actual elapsed minutes between two UTC instants.
 */
export function elapsedMinutes(start: string, end: string): number {
  const startTime = DateTime.fromISO(toUtc(start), { zone: 'utc' })
  const endTime = DateTime.fromISO(toUtc(end), { zone: 'utc' })

  return endTime.diff(startTime, 'minutes').minutes
}
