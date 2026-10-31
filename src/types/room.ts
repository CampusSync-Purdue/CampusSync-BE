export type Room = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  amenities: string[];
  active: boolean;
};

/** Days as they appear as keys in `rooms.availability_hours`. */
export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/**
 * One day's opening and closing time, as campus-local 24-hour `HH:mm` wall
 * clock values. See `docs/date-time-conventions.md` section 5.
 *
 * A `close` at or before `open` denotes hours running past midnight into the
 * following day, for example `{ open: "20:00", close: "02:00" }`.
 */
export type DayOperatingHours = {
  open: string;
  close: string;
};

/**
 * A room's recurring weekly operating hours. A day that is absent means the
 * room does not open that day.
 */
export type OperatingHours = Partial<Record<Weekday, DayOperatingHours>>;

/**
 * A room as stored in the `rooms` table.
 *
 * This is distinct from the legacy `Room` type above, which describes the
 * in-memory shape the browse endpoint (US-04) still returns. The two converge
 * when the catalog moves onto the database.
 */
export type RoomRecord = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  description: string;
  amenities: string[];
  availabilityHours: OperatingHours;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** The room fields returned by the availability search and room catalog. */
export type RoomSummary = Pick<
  RoomRecord,
  "id" | "name" | "location" | "capacity" | "description" | "amenities"
> & {
  availabilityHours: OperatingHours;
};
