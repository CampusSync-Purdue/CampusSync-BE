import {
  getPgConstraint,
  getPgErrorCode,
  PG_EXCLUSION_VIOLATION,
  PG_FOREIGN_KEY_VIOLATION,
} from "../db/errors.js";
import { CAMPUS_TIMEZONE } from "../config/environment.js";
import { DAYS_OF_WEEK } from "../db/schema.js";
import {
  findActiveReservationTimesForRoom,
  insertReservation,
} from "../repositories/reservationRepository.js";
import { findActiveRoomById } from "../repositories/roomRepository.js";
import type { ReservationConfirmation, RoomAvailability } from "../types/reservation.js";
import { addDays, zonedTimeToInstant } from "../utils/campusTime.js";
import {
  checkWithinOpeningHours,
  type ReservationInput,
} from "../validation/reservationValidation.js";
import { isUuid } from "../validation/uuid.js";

export class RoomNotFoundError extends Error {
  constructor() {
    super("This room does not exist or is not available for booking.");
    this.name = "RoomNotFoundError";
  }
}

export class OutsideOpeningHoursError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutsideOpeningHoursError";
  }
}

export class ReservationConflictError extends Error {
  constructor() {
    super("This room is already booked for part of that time. Choose a different time.");
    this.name = "ReservationConflictError";
  }
}

/** The token is valid but its user no longer exists (or predates the database). */
export class AccountNotFoundError extends Error {
  constructor() {
    super("Your session is no longer valid. Please sign in again.");
    this.name = "AccountNotFoundError";
  }
}

/**
 * Creates an active reservation for `userId`. The input has already passed
 * `validateReservationInput`; this adds the checks that need the room.
 */
export async function createReservation(
  userId: string,
  input: ReservationInput,
): Promise<ReservationConfirmation> {
  if (!isUuid(userId)) {
    throw new AccountNotFoundError();
  }

  const room = await findActiveRoomById(input.roomId);

  if (!room) {
    throw new RoomNotFoundError();
  }

  const hoursError = checkWithinOpeningHours(
    room.availabilityHours,
    input.startTime,
    input.endTime,
  );

  if (hoursError) {
    throw new OutsideOpeningHoursError(hoursError);
  }

  try {
    const reservation = await insertReservation({
      userId,
      roomId: room.id,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    return {
      id: reservation.id,
      roomId: room.id,
      roomName: room.name,
      roomLocation: room.location,
      userId: reservation.userId,
      startTime: reservation.startTime.toISOString(),
      endTime: reservation.endTime.toISOString(),
      status: reservation.status,
      createdAt: reservation.createdAt.toISOString(),
    };
  } catch (error) {
    // The database constraint is the source of truth for overlaps, so two
    // concurrent requests for the same slot cannot both succeed.
    if (getPgErrorCode(error) === PG_EXCLUSION_VIOLATION) {
      throw new ReservationConflictError();
    }

    if (getPgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
      if (getPgConstraint(error) === "reservations_room_id_rooms_id_fk") {
        throw new RoomNotFoundError();
      }

      throw new AccountNotFoundError();
    }

    throw error;
  }
}

/**
 * Opening hours and booked time ranges for a room on a campus-local date
 * (YYYY-MM-DD, already validated). Each range says whether it belongs to
 * `requesterId`; no other user details are returned.
 */
export async function getRoomAvailability(
  roomId: string,
  date: string,
  requesterId: string,
): Promise<RoomAvailability> {
  const room = await findActiveRoomById(roomId);

  if (!room) {
    throw new RoomNotFoundError();
  }

  const dayStart = zonedTimeToInstant(date, "00:00", CAMPUS_TIMEZONE);
  const dayEnd = zonedTimeToInstant(addDays(date, 1), "00:00", CAMPUS_TIMEZONE);
  const booked = await findActiveReservationTimesForRoom(room.id, dayStart, dayEnd);
  const weekday = DAYS_OF_WEEK[new Date(`${date}T00:00:00Z`).getUTCDay()];

  return {
    roomId: room.id,
    date,
    timeZone: CAMPUS_TIMEZONE,
    openingHours: room.availabilityHours[weekday] ?? null,
    booked: booked.map((slot) => ({
      startTime: slot.startTime.toISOString(),
      endTime: slot.endTime.toISOString(),
      isMine: slot.userId === requesterId,
    })),
  };
}
