import { CAMPUS_TIMEZONE } from "../config/environment.js";
import type { OpeningHours } from "../types/room.js";
import {
  addDays,
  minutesToTime,
  timeToMinutes,
  toZonedDateTime,
} from "../utils/campusTime.js";
import { isUuid } from "./uuid.js";
import { MAX_RESERVATION_DURATION_MINUTES } from "../config/reservationRules.js";

export const RESERVATION_MIN_MINUTES = 30;
/**
 * The limit comes from `config/reservationRules.ts`, which is the one place
 * it is defined (docs/booking-rules.md). It was 4 hours here while the
 * availability search, `GET /api/reservations/rules` and the UI all used 3,
 * so a booking the search refused was accepted on create.
 */
export const RESERVATION_MAX_MINUTES = MAX_RESERVATION_DURATION_MINUTES;
export const RESERVATION_INCREMENT_MINUTES = 30;
export const RESERVATION_MAX_DAYS_AHEAD = 30;

/**
 * ISO 8601 date-time with an explicit offset (Z or ±HH:mm), per the API's
 * date-time conventions. Timestamps without an offset are rejected so they are
 * never read in the server's local time zone.
 */
const ISO_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns the date when it is a real YYYY-MM-DD calendar date, else undefined. */
export function parseCalendarDate(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = DATE_ONLY.exec(value);

  if (!match) {
    return undefined;
  }

  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : undefined;
}

export type ReservationField = "roomId" | "startTime" | "endTime";

export type ReservationFieldErrors = Partial<Record<ReservationField, string>>;

export type ReservationInput = {
  roomId: string;
  startTime: Date;
  endTime: Date;
};

export type ReservationValidationResult =
  | { valid: true; value: ReservationInput }
  | { valid: false; errors: ReservationFieldErrors };

export type ReservationValidationOptions = {
  now?: Date;
  timeZone?: string;
};

/**
 * Parses an ISO timestamp with an offset. Returns undefined when the format is
 * wrong or the calendar date does not exist (e.g. 2026-02-30), which
 * `Date.parse` would otherwise roll over silently.
 */
export function parseIsoInstant(value: unknown): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = ISO_WITH_OFFSET.exec(value.trim());

  if (!match) {
    return undefined;
  }

  const [, y, mo, d, h, mi, s = "0", ms = "0", offset] = match;
  const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number);

  if (hour > 23 || minute > 59 || second > 59) {
    return undefined;
  }

  const wallClock = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, Number(ms.padEnd(3, "0"))),
  );

  if (
    wallClock.getUTCFullYear() !== year ||
    wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day
  ) {
    return undefined;
  }

  let offsetMinutes = 0;

  if (offset !== "Z") {
    const sign = offset.startsWith("-") ? -1 : 1;
    const [offsetHours, offsetMins] = offset.slice(1).split(":").map(Number);

    if (offsetHours > 14 || offsetMins > 59) {
      return undefined;
    }

    offsetMinutes = sign * (offsetHours * 60 + offsetMins);
  }

  return new Date(wallClock.getTime() - offsetMinutes * 60_000);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = minutes / 60;

  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * Validates the shape of a create-reservation request and the booking rules
 * that do not depend on the room: start before end, 30-minute boundaries,
 * 30 minutes to 4 hours, in the future, at most 30 days ahead, one campus day.
 *
 * Opening hours depend on the room; see `checkWithinOpeningHours`.
 */
export function validateReservationInput(
  body: unknown,
  { now = new Date(), timeZone = CAMPUS_TIMEZONE }: ReservationValidationOptions = {},
): ReservationValidationResult {
  const errors: ReservationFieldErrors = {};
  const input = (body ?? {}) as Record<string, unknown>;

  const roomId = typeof input.roomId === "string" ? input.roomId.trim() : "";

  if (!roomId) {
    errors.roomId = "Choose a room.";
  } else if (!isUuid(roomId)) {
    errors.roomId = "Choose a valid room.";
  }

  const startTime = parseIsoInstant(input.startTime);
  const endTime = parseIsoInstant(input.endTime);

  if (input.startTime === undefined || input.startTime === "") {
    errors.startTime = "Start time is required.";
  } else if (!startTime) {
    errors.startTime = "Enter a valid start time.";
  }

  if (input.endTime === undefined || input.endTime === "") {
    errors.endTime = "End time is required.";
  } else if (!endTime) {
    errors.endTime = "Enter a valid end time.";
  }

  if (startTime && endTime) {
    const start = toZonedDateTime(startTime, timeZone);
    const end = toZonedDateTime(endTime, timeZone);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / 60_000;
    const today = toZonedDateTime(now, timeZone).date;
    const lastBookableDate = addDays(today, RESERVATION_MAX_DAYS_AHEAD);

    if (start.seconds !== 0 || start.minutes % RESERVATION_INCREMENT_MINUTES !== 0) {
      errors.startTime = `Start time must be on the hour or half hour.`;
    } else if (startTime.getTime() <= now.getTime()) {
      errors.startTime = "Start time must be in the future.";
    } else if (start.date > lastBookableDate) {
      errors.startTime = `Reservations can be made up to ${RESERVATION_MAX_DAYS_AHEAD} days in advance.`;
    }

    if (end.seconds !== 0 || end.minutes % RESERVATION_INCREMENT_MINUTES !== 0) {
      errors.endTime = `End time must be on the hour or half hour.`;
    } else if (durationMinutes <= 0) {
      errors.endTime = "End time must be after the start time.";
    } else if (durationMinutes < RESERVATION_MIN_MINUTES) {
      errors.endTime = `Reservations must be at least ${formatDuration(RESERVATION_MIN_MINUTES)}.`;
    } else if (durationMinutes > RESERVATION_MAX_MINUTES) {
      errors.endTime = `Reservations can be at most ${formatDuration(RESERVATION_MAX_MINUTES)}.`;
    } else if (
      end.date !== start.date &&
      // Ending exactly at the next midnight still counts as the same day.
      !(end.date === addDays(start.date, 1) && end.minutes === 0)
    ) {
      errors.endTime = "Reservations must start and end on the same day.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: { roomId, startTime: startTime as Date, endTime: endTime as Date },
  };
}

/**
 * Checks the reservation against the room's campus-local opening hours.
 * Returns a message for the startTime field, or null when it fits.
 */
export function checkWithinOpeningHours(
  openingHours: OpeningHours,
  startTime: Date,
  endTime: Date,
  timeZone: string = CAMPUS_TIMEZONE,
): string | null {
  const start = toZonedDateTime(startTime, timeZone);
  const end = toZonedDateTime(endTime, timeZone);
  const hours = openingHours[start.weekday];
  const dayName = start.weekday[0].toUpperCase() + start.weekday.slice(1);

  if (!hours) {
    return `This room is closed on ${dayName}s.`;
  }

  const open = timeToMinutes(hours.open);
  const close = timeToMinutes(hours.close);
  // An end at exactly midnight belongs to the start day.
  const endMinutes = end.date === start.date ? end.minutes : 24 * 60;

  if (Number.isNaN(open) || Number.isNaN(close) || start.minutes < open || endMinutes > close) {
    return `This room is open ${minutesToTime(open)}–${minutesToTime(close)} on ${dayName}s.`;
  }

  return null;
}
