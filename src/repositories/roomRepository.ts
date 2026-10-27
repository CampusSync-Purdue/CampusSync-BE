import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { rooms } from "../db/schema.js";
import type { Room } from "../types/room.js";
import { isUuid } from "../validation/uuid.js";

export async function findActiveRooms(): Promise<Room[]> {
  return db
    .select()
    .from(rooms)
    .where(eq(rooms.isActive, true))
    .orderBy(asc(rooms.name));
}

export async function findActiveRoomById(id: string): Promise<Room | undefined> {
  // A malformed id cannot match any room; skip the query (and the cast error).
  if (!isUuid(id)) {
    return undefined;
  }

  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, id), eq(rooms.isActive, true)))
    .limit(1);

  return room;
}
