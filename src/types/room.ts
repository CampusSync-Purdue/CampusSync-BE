import type { OpeningHours, RoomRecord } from "../db/schema.js";

export type { OpeningHours } from "../db/schema.js";

export type Room = RoomRecord;

/** The room shape returned by the API. */
export type PublicRoom = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  amenities: string[];
  openingHours: OpeningHours;
};

export function toPublicRoom(room: Room): PublicRoom {
  return {
    id: room.id,
    name: room.name,
    location: room.location,
    capacity: room.capacity,
    amenities: room.amenities,
    openingHours: room.availabilityHours,
  };
}
