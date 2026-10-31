import {
  findActiveRooms,
  findRoomById,
  insertRoom,
} from '../repositories/roomRepository.js'
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

/** One active room by id, or null when there is none (CSYNC-14). */
export async function getActiveRoomById(
  roomId: string,
): Promise<RoomSummary | null> {
  return findRoomById(roomId)
}

/** Creates a room. It is active immediately. */
export async function createRoom(input: NewRoomInput): Promise<RoomSummary> {
  return insertRoom(input)
}
