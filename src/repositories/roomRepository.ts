import { pool } from '../config/database.js'
import type { OperatingHours, RoomSummary } from '../types/room.js'
import type { NewRoomInput } from '../validation/roomValidation.js'

/**
 * Database access for rooms. This is the only module that knows how rooms are
 * queried, so the services above it never build SQL.
 */

type RoomRow = {
  id: string
  name: string
  location: string
  capacity: number
  description: string
  amenities: string[]
  availability_hours: OperatingHours
}

const ROOM_COLUMNS = `
  id,
  name,
  location,
  capacity,
  description,
  amenities,
  availability_hours
`

function toRoomSummary(row: RoomRow): RoomSummary {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    // `capacity` is an INTEGER, which pg returns as a number, but a driver
    // configured to return strings for numerics should not corrupt the type.
    capacity: Number(row.capacity),
    description: row.description,
    amenities: row.amenities ?? [],
    availabilityHours: row.availability_hours ?? {},
  }
}

/** Every active room, ordered by name. */
export async function findActiveRooms(): Promise<RoomSummary[]> {
  const result = await pool.query<RoomRow>(
    `SELECT ${ROOM_COLUMNS} FROM rooms WHERE is_active ORDER BY name`,
  )

  return result.rows.map(toRoomSummary)
}

/**
 * Active rooms with no active reservation overlapping the requested window.
 *
 * The overlap test uses the same half-open range, `[start, end)`, as the
 * `reservations_room_id_tstzrange_excl` exclusion constraint, so a room this
 * returns is a room the database will accept a booking for. A reservation
 * ending exactly when the requested window begins does not overlap it.
 *
 * Cancelled and completed reservations are ignored: only `active` rows hold a
 * room, which is also the condition the exclusion constraint is limited to.
 *
 * Operating hours are not applied here. They are campus-local recurring wall
 * clock values, so they are filtered above this layer by
 * `isWithinOperatingHours`.
 *
 * @param startUtc the window's start, as an absolute UTC instant
 * @param endUtc the window's end, as an absolute UTC instant
 */
export async function findRoomsFreeBetween(
  startUtc: string,
  endUtc: string,
): Promise<RoomSummary[]> {
  const result = await pool.query<RoomRow>(
    `SELECT ${ROOM_COLUMNS}
       FROM rooms
      WHERE is_active
        AND NOT EXISTS (
              SELECT 1
                FROM reservations
               WHERE reservations.room_id = rooms.id
                 AND reservations.status = 'active'
                 AND tstzrange(reservations.start_time, reservations.end_time, '[)')
                     && tstzrange($1::timestamptz, $2::timestamptz, '[)')
            )
      ORDER BY name`,
    [startUtc, endUtc],
  )

  return result.rows.map(toRoomSummary)
}

/**
 * Creates a room and returns it.
 *
 * `is_active` is not a parameter: a newly created room is always active, so
 * it reaches the catalog and the availability search straight away (US-13).
 */
export async function insertRoom(room: NewRoomInput): Promise<RoomSummary> {
  const result = await pool.query<RoomRow>(
    `INSERT INTO rooms
       (name, location, capacity, description, amenities, availability_hours, is_active)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, TRUE)
     RETURNING ${ROOM_COLUMNS}`,
    [
      room.name,
      room.location,
      room.capacity,
      room.description,
      room.amenities,
      JSON.stringify(room.availabilityHours),
    ],
  )

  return toRoomSummary(result.rows[0])
}
