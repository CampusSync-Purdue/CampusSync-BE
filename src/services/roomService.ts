import {
  findActiveRooms,
  findActiveRoomById,
  findAllRooms,
  findRoomById,
  insertRoom,
  updateRoom as updateRoomInRepository,
  deactivateRoom as deactivateRoomInRepository,
} from '../repositories/roomRepository.js'
import type { RoomSummary } from '../types/room.js'
import type { NewRoomInput } from '../validation/roomValidation.js'

/**
 * Returns active rooms for the public catalog.
 */
export async function getActiveRooms(): Promise<RoomSummary[]> {
  return findActiveRooms()
}

/**
 * Returns one active room by ID.
 */
export async function getActiveRoomById(
  roomId: string,
): Promise<RoomSummary | null> {
  return findActiveRoomById(roomId)
}

/**
 * Creates a room. New rooms are active immediately.
 */
export async function createRoom(
  input: NewRoomInput,
): Promise<RoomSummary> {
  return insertRoom(input)
}

/**
 * CSYNC-23: Returns all rooms, including inactive ones,
 * for the administrator management page.
 */
export async function getAllRooms() {
  return findAllRooms()
}

/**
 * CSYNC-23: Returns a room regardless of its active status.
 */
export async function getRoomForAdmin(roomId: string) {
  return findRoomById(roomId)
}

/**
 * CSYNC-23: Updates a room's information.
 * Does not change its active/inactive status.
 */
export async function editRoom(
  roomId: string,
  input: NewRoomInput,
) {
  return updateRoomInRepository(roomId, input)
}

/**
 * CSYNC-23: Deactivates a room without deleting it
 * or any associated reservation history.
 */
export async function deactivateRoom(roomId: string) {
  return deactivateRoomInRepository(roomId)
}
