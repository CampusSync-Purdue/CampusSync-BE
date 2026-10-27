import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { reservations } from "../db/schema.js";
import type { Reservation } from "../types/reservation.js";

export type NewReservation = {
  userId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
};

/**
 * Inserts an active reservation.
 *
 * @throws the driver error with SQLSTATE 23P01 when it overlaps another active
 * reservation for the same room (reservations_no_overlap), or 23503 when the
 * user or room no longer exists.
 */
export async function insertReservation(record: NewReservation): Promise<Reservation> {
  const [reservation] = await db
    .insert(reservations)
    .values({ ...record, status: "active" })
    .returning();

  return reservation;
}

/**
 * Active reservations for a room that overlap [from, to). The user id is
 * selected only so callers can tell the requester's own bookings apart; it
 * must not be returned to clients.
 */
export async function findActiveReservationTimesForRoom(
  roomId: string,
  from: Date,
  to: Date,
): Promise<Array<{ userId: string; startTime: Date; endTime: Date }>> {
  return db
    .select({
      userId: reservations.userId,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.roomId, roomId),
        eq(reservations.status, "active"),
        lt(reservations.startTime, to),
        gt(reservations.endTime, from),
      ),
    )
    .orderBy(asc(reservations.startTime));
}
