import { findActiveRooms, insertRoom } from '../repositories/roomRepository.js'
import type { RoomSummary } from '../types/room.js'
import type { NewRoomInput } from '../validation/roomValidation.js'

/**
 * Room catalog and creation.
 *
 * The catalog reads from the database rather than the in-memory list it
 * started as, because US-13 requires a newly created room to appear in it.
 * This is the change CSYNC-43 describes; it had to happen here for a created
 * room to be visible at all.
 */
export async function getActiveRooms(): Promise<RoomSummary[]> {
  return findActiveRooms()
}

/** Creates a room. It is active immediately. */
export async function createRoom(input: NewRoomInput): Promise<RoomSummary> {
  return insertRoom(input)
}
