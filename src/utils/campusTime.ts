import type { DayOfWeek } from "../db/schema.js";

/** Wall-clock view of an instant in a given time zone. */
export type ZonedDateTime = {
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  /** Minutes since local midnight (0–1439). */
  minutes: number;
  seconds: number;
  weekday: DayOfWeek;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }

  return formatter;
}

/** Converts an instant to the wall-clock date and time in `timeZone`. */
export function toZonedDateTime(instant: Date, timeZone: string): ZonedDateTime {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    seconds: Number(parts.second),
    weekday: parts.weekday.toLowerCase() as DayOfWeek,
  };
}

/** "HH:mm" → minutes since midnight. Returns NaN for malformed input. */
export function timeToMinutes(time: string): number {
  const match = /^([01]\d|2[0-4]):([0-5]\d)$/.exec(time);

  if (!match) {
    return Number.NaN;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes since midnight → "HH:mm". */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Adds whole days to a YYYY-MM-DD date string. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Converts a wall-clock date and time in `timeZone` to an instant. Used by
 * tests and seeds; the API itself receives instants.
 */
export function zonedTimeToInstant(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const targetMinutes = timeToMinutes(time);
  const wallClockAsUtc = Date.UTC(year, month - 1, day) + targetMinutes * 60_000;

  // Start from the wall-clock value read as UTC, then correct by the zone's
  // offset. A second pass handles instants near a DST change.
  let guess = wallClockAsUtc;

  for (let pass = 0; pass < 2; pass += 1) {
    const zoned = toZonedDateTime(new Date(guess), timeZone);
    const [zy, zm, zd] = zoned.date.split("-").map(Number);
    const zonedAsUtc = Date.UTC(zy, zm - 1, zd) + zoned.minutes * 60_000;

    guess += wallClockAsUtc - zonedAsUtc;
  }

  return new Date(guess);
}
