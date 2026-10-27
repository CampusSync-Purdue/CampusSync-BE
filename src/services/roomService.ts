import { findActiveRooms } from "../repositories/roomRepository.js";
import { toPublicRoom, type PublicRoom } from "../types/room.js";

export async function getActiveRooms(): Promise<PublicRoom[]> {
  const rooms = await findActiveRooms();

  return rooms.map(toPublicRoom);
}
