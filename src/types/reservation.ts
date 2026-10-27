import type { ReservationRecord, ReservationStatus } from "../db/schema.js";

export type { ReservationStatus } from "../db/schema.js";

export type Reservation = ReservationRecord;

/** Confirmation data returned after creating a reservation. Times are UTC ISO strings. */
export type ReservationConfirmation = {
  id: string;
  roomId: string;
  roomName: string;
  roomLocation: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  createdAt: string;
};

/** A booked time range for a room. Times are UTC ISO strings; no user details. */
export type BookedInterval = {
  startTime: string;
  endTime: string;
  /** True when the signed-in requester made this reservation. */
  isMine: boolean;
};

export type RoomAvailability = {
  roomId: string;
  /** Campus-local date, YYYY-MM-DD. */
  date: string;
  timeZone: string;
  /** Campus-local opening hours that day, or null when closed. */
  openingHours: { open: string; close: string } | null;
  booked: BookedInterval[];
};
