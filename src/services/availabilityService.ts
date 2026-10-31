import { findRoomsFreeBetween } from '../repositories/roomRepository.js'
import { isWithinOperatingHours } from './operatingHours.js'
import type { RoomSummary } from '../types/room.js'
import type { AvailabilityQuery } from '../validation/availabilityValidation.js'

/**
 * Availability search (CSYNC-15 / US-06).
 *
 * A room is available when all three hold:
 *
 * 1. it is active,
 * 2. no active reservation overlaps the requested window, and
 * 3. the window falls inside the room's operating hours for that day.
 *
 * The first two are settled in SQL, where the overlap test matches the
 * schema's exclusion constraint. The third is applied here, because operating
 * hours are campus-local recurring wall-clock values rather than instants.
 */
export async function findAvailableRooms(
  query: AvailabilityQuery,
): Promise<RoomSummary[]> {
  const freeRooms = await findRoomsFreeBetween(query.startUtc, query.endUtc)

  return freeRooms.filter((room) =>
    isWithinOperatingHours(
      room.availabilityHours,
      query.date,
      query.startTime,
      query.endTime,
    ),
  )
}
