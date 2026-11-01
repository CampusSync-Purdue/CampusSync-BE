import { campusLocalToUtc } from '../utils/dateTime.js'
import { validateReservationDuration } from './reservationDuration.js'

/**
 * Validation for the availability search (CSYNC-15 / US-06).
 *
 * A caller picks a calendar date and a start and end time, all expressed as
 * campus-local wall-clock values, because that is how a person reads a room's
 * operating hours. They are converted to absolute UTC instants here so that
 * every comparison further in happens between instants, per
 * `docs/date-time-conventions.md`.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export type AvailabilityFieldErrors = Partial<
  Record<
    'date' | 'startTime' | 'endTime' | 'location' | 'minCapacity' | 'amenities',
    string
  >
>

export type AvailabilityQuery = {
  /** Campus-local calendar date, `YYYY-MM-DD`. */
  date: string
  /** Campus-local start, `HH:mm`. */
  startTime: string
  /** Campus-local end, `HH:mm`. */
  endTime: string
  /** The start as an absolute UTC instant. */
  startUtc: string
  /** The end as an absolute UTC instant. */
  endUtc: string
  /** Optional room location to filter by (case-insensitive). */
  location?: string
  /** Optional minimum number of people the room must accommodate. */
  minCapacity?: number
  /** Optional amenities that must all be present in a matching room. */
  amenities?: string[]
}

export type AvailabilityValidationResult =
  | { valid: true; value: AvailabilityQuery }
  | { valid: false; errors: AvailabilityFieldErrors }

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined
}

/**
 * Checks that the date is a real calendar date, rejecting values that match
 * the pattern but do not exist, such as `2026-02-30`.
 */
function isRealDate(date: string): boolean {
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export function validateAvailabilityQuery(
  query: unknown,
): AvailabilityValidationResult {
  const errors: AvailabilityFieldErrors = {}
  const input = (query ?? {}) as Record<string, unknown>

  const date = asString(input.date)
  const startTime = asString(input.startTime)
  const endTime = asString(input.endTime)
  const location = asString(input.location)
  const minCapacityInput = asString(input.minCapacity)
  const amenitiesInput = asString(input.amenities)

  let minCapacity: number | undefined
  let amenities: string[] | undefined

  if (input.location !== undefined) {
    if (typeof input.location !== 'string' || input.location.trim().length > 100) {
      errors.location = 'Enter a valid location (up to 100 characters).'
    }
  }

  if (input.minCapacity !== undefined && input.minCapacity !== '') {
    if (
      !minCapacityInput ||
      !/^[1-9]\d*$/.test(minCapacityInput) ||
      !Number.isSafeInteger(Number(minCapacityInput))
    ) {
      errors.minCapacity = 'Enter a positive whole number.'
    } else {
      minCapacity = Number(minCapacityInput)
    }
  }

  if (input.amenities !== undefined && input.amenities !== '') {
    if (!amenitiesInput) {
      errors.amenities = 'Enter valid amenities.'
    } else {
      amenities = amenitiesInput
        .split(',')
        .map((amenity) => amenity.trim())
        .filter(Boolean)

      if (
        amenities.length === 0 ||
        amenities.length > 20 ||
        amenities.some((amenity) => amenity.length > 100)
      ) {
        errors.amenities = 'Enter between 1 and 20 valid amenities.'
      }
    } 
  }

  if (!date) {
    errors.date = 'A date is required.'
  } else if (!DATE_PATTERN.test(date)) {
    errors.date = 'Enter the date as YYYY-MM-DD.'
  } else if (!isRealDate(date)) {
    errors.date = 'Enter a real calendar date.'
  }

  if (!startTime) {
    errors.startTime = 'A start time is required.'
  } else if (!TIME_PATTERN.test(startTime)) {
    errors.startTime = 'Enter the start time as HH:mm.'
  }

  if (!endTime) {
    errors.endTime = 'An end time is required.'
  } else if (!TIME_PATTERN.test(endTime)) {
    errors.endTime = 'Enter the end time as HH:mm.'
  }

  // Comparing HH:mm as text is safe because both are zero-padded 24-hour
  // values. A booking is confined to one calendar date, so an end time equal
  // to or before the start is always wrong rather than an overnight range.
  if (!errors.startTime && !errors.endTime && startTime && endTime && endTime <= startTime) {
    errors.endTime = 'The end time must be after the start time.'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  // Safe: every field above is validated by this point.
  const validDate = date as string
  const validStart = startTime as string
  const validEnd = endTime as string

  let startUtc: string
  let endUtc: string

  try {
    startUtc = campusLocalToUtc(`${validDate}T${validStart}:00`)
    endUtc = campusLocalToUtc(`${validDate}T${validEnd}:00`)
  } catch (error) {
    // A daylight saving transition can make a local time nonexistent or
    // ambiguous. Report it against the field the caller can actually change
    // rather than failing with a generic message.
    const message =
      error instanceof Error ? error.message : 'That time is not valid on this date.'

    return { valid: false, errors: { startTime: message } }
  }

  // The duration limit is checked here, against the instants rather than the
  // wall clock, so a window longer than a reservation may run is rejected
  // before any rooms are offered for it (US-10).
  const duration = validateReservationDuration(startUtc, endUtc)

  if (!duration.valid) {
    return { valid: false, errors: { endTime: duration.message } }
  }

  return {
    valid: true,
    value: {
      date: validDate,
      startTime: validStart,
      endTime: validEnd,
      startUtc,
      endUtc,
      location,
      minCapacity,
      amenities,
    },
  }
}
