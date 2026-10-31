import { findRoomsFreeBetween } from '../repositories/roomRepository.js'
import { isWithinOperatingHours } from './operatingHours.js'
import type { RoomSummary } from '../types/room.js'
import type { AvailabilityQuery } from '../validation/availabilityValidation.js'

/**
 * Availability search (CSYNC-15 / US-06 and CSYNC-16 / US-07).
 *
 * A room is available when:
 *
 * 1. it is active,
 * 2. no active reservation overlaps the requested window,
 * 3. the window falls inside the room's operating hours, and
 * 4. it satisfies all selected location, capacity, and amenity filters.
 *
 * The first two conditions are handled in SQL. Operating hours are checked
 * here because they use campus-local recurring times rather than UTC instants.
 *
 * Optional room filters use AND logic, meaning a room must satisfy every
 * selected filter. When no filters are provided, the original availability
 * search behavior is preserved.
 */
export async function findAvailableRooms(
  query: AvailabilityQuery,
): Promise<RoomSummary[]> {
  const freeRooms = await findRoomsFreeBetween(query.startUtc, query.endUtc)

  return freeRooms.filter((room) => {
    // Check whether the room is open during the requested time window.
    if (
      !isWithinOperatingHours(
        room.availabilityHours,
        query.date,
        query.startTime,
        query.endTime,
      )
    ) {
      return false
    }

    // Filter by location, ignoring capitalization.
    if (
      query.location &&
      room.location.toLowerCase() !== query.location.toLowerCase()
    ) {
      return false
    }

    // Only include rooms meeting the requested minimum capacity.
    if (
      query.minCapacity !== undefined &&
      room.capacity < query.minCapacity
    ) {
      return false
    }

    // Require every selected amenity to be present in the room.
    if (
      query.amenities?.length &&
      !query.amenities.every((amenity) =>
        room.amenities.some(
          (roomAmenity) =>
            roomAmenity.toLowerCase() === amenity.toLowerCase(),
        ),
      )
    ) {
      return false
    }

    // The room satisfies the availability rules and all selected filters.
    return true
  })
}
