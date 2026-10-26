import { WEEKDAYS, type OperatingHours, type Weekday } from '../types/room.js'

/**
 * Validation for creating a room (CSYNC-22 / US-13).
 *
 * Name, location, capacity, and operating hours are all required. Operating
 * hours in particular: a room with no published hours is never offered by the
 * availability search, so creating one without them would add a room nobody
 * could ever book.
 */

export const ROOM_NAME_MAX_LENGTH = 120
export const ROOM_LOCATION_MAX_LENGTH = 120
export const ROOM_DESCRIPTION_MAX_LENGTH = 1000
export const ROOM_CAPACITY_MAX = 10_000

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export type RoomFieldErrors = Partial<
  Record<
    'name' | 'location' | 'capacity' | 'availabilityHours' | 'description' | 'amenities',
    string
  >
>

export type NewRoomInput = {
  name: string
  location: string
  capacity: number
  description: string
  amenities: string[]
  availabilityHours: OperatingHours
}

export type RoomValidationResult =
  | { valid: true; value: NewRoomInput }
  | { valid: false; errors: RoomFieldErrors }

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Validates the `availability_hours` object.
 *
 * Returns the parsed hours, or a message naming what is wrong. At least one
 * day must be present; `close` equal to or before `open` is accepted as
 * overnight hours, which the availability search handles.
 */
function parseOperatingHours(
  value: unknown,
): { hours: OperatingHours } | { error: string } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'Operating hours are required.' }
  }

  const entries = Object.entries(value as Record<string, unknown>)

  if (entries.length === 0) {
    return {
      error: 'Add operating hours for at least one day, or the room can never be booked.',
    }
  }

  const hours: OperatingHours = {}

  for (const [day, dayValue] of entries) {
    const weekday = day.toLowerCase() as Weekday

    if (!WEEKDAYS.includes(weekday)) {
      return { error: `"${day}" is not a day of the week.` }
    }

    if (dayValue === null || typeof dayValue !== 'object' || Array.isArray(dayValue)) {
      return { error: `Give ${weekday} an opening and closing time.` }
    }

    const { open, close } = dayValue as Record<string, unknown>

    if (typeof open !== 'string' || !TIME_PATTERN.test(open)) {
      return { error: `Enter ${weekday}'s opening time as HH:mm.` }
    }

    if (typeof close !== 'string' || !TIME_PATTERN.test(close)) {
      return { error: `Enter ${weekday}'s closing time as HH:mm.` }
    }

    hours[weekday] = { open, close }
  }

  return { hours }
}

function parseAmenities(value: unknown): { amenities: string[] } | { error: string } {
  if (value === undefined || value === null) {
    return { amenities: [] }
  }

  if (!Array.isArray(value)) {
    return { error: 'Amenities must be a list.' }
  }

  if (!value.every((amenity) => isNonEmptyString(amenity))) {
    return { error: 'Every amenity must be a non-empty name.' }
  }

  return { amenities: value.map((amenity) => (amenity as string).trim()) }
}

export function validateNewRoom(body: unknown): RoomValidationResult {
  const errors: RoomFieldErrors = {}
  const input = (body ?? {}) as Record<string, unknown>

  const rawName = input.name
  const rawLocation = input.location
  const rawCapacity = input.capacity
  const rawDescription = input.description

  if (!isNonEmptyString(rawName)) {
    errors.name = 'A room name is required.'
  } else if (rawName.trim().length > ROOM_NAME_MAX_LENGTH) {
    errors.name = `The name must be ${ROOM_NAME_MAX_LENGTH} characters or fewer.`
  }

  if (!isNonEmptyString(rawLocation)) {
    errors.location = 'A location is required.'
  } else if (rawLocation.trim().length > ROOM_LOCATION_MAX_LENGTH) {
    errors.location = `The location must be ${ROOM_LOCATION_MAX_LENGTH} characters or fewer.`
  }

  // Accept a numeric string, because an HTML number input submits text.
  const capacity =
    typeof rawCapacity === 'string' && rawCapacity.trim().length > 0
      ? Number(rawCapacity)
      : rawCapacity

  if (capacity === undefined || capacity === null || capacity === '') {
    errors.capacity = 'A capacity is required.'
  } else if (typeof capacity !== 'number' || !Number.isInteger(capacity)) {
    errors.capacity = 'Capacity must be a whole number.'
  } else if (capacity < 1) {
    errors.capacity = 'Capacity must be at least 1.'
  } else if (capacity > ROOM_CAPACITY_MAX) {
    errors.capacity = `Capacity must be ${ROOM_CAPACITY_MAX} or fewer.`
  }

  if (rawDescription !== undefined && typeof rawDescription !== 'string') {
    errors.description = 'The description must be text.'
  } else if (
    typeof rawDescription === 'string' &&
    rawDescription.length > ROOM_DESCRIPTION_MAX_LENGTH
  ) {
    errors.description = `The description must be ${ROOM_DESCRIPTION_MAX_LENGTH} characters or fewer.`
  }

  const amenities = parseAmenities(input.amenities)

  if ('error' in amenities) {
    errors.amenities = amenities.error
  }

  const operatingHours = parseOperatingHours(input.availabilityHours)

  if ('error' in operatingHours) {
    errors.availabilityHours = operatingHours.error
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    value: {
      name: (rawName as string).trim(),
      location: (rawLocation as string).trim(),
      capacity: capacity as number,
      description:
        typeof rawDescription === 'string' ? rawDescription.trim() : '',
      amenities: 'amenities' in amenities ? amenities.amenities : [],
      availabilityHours: 'hours' in operatingHours ? operatingHours.hours : {},
    },
  }
}
