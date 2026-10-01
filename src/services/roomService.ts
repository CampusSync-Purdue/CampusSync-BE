import type { Room } from "../types/room.js";

const rooms: Room[] = [
  {
    id: "room-101",
    name: "Study Room 101",
    location: "Library",
    capacity: 8,
    amenities: ["WiFi", "Whiteboard"],
    active: true,
  },
  {
    id: "room-202",
    name: "Conference Room A",
    location: "Science Hall",
    capacity: 12,
    amenities: ["WiFi", "Projector", "Whiteboard"],
    active: true,
  },
  {
    id: "room-303",
    name: "Study Room 303",
    location: "Engineering Building",
    capacity: 6,
    amenities: ["WiFi"],
    active: false,
  },
];

export function getActiveRooms(): Omit<Room, "active">[] {
  return rooms.filter((room) => room.active).map(({ active, ...room }) => room);
}
