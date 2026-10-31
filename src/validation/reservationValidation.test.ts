import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_OPENING_HOURS } from "../db/seedRooms.js";
import { describeMaxDuration } from "../config/reservationRules.js";
import {
  checkWithinOpeningHours,
  parseCalendarDate,
  parseIsoInstant,
  RESERVATION_MAX_MINUTES,
  validateReservationInput,
  type ReservationFieldErrors,
} from "./reservationValidation.js";

const TZ = "America/Indiana/Indianapolis";
const ROOM_ID = "2f6b1c4e-8a3d-4f5b-9c71-0d2e3a4b5c01";
// Monday 26 October 2026, 08:00 in campus time (EDT, UTC-4).
const NOW = new Date("2026-10-26T12:00:00Z");

function validate(startTime: unknown, endTime: unknown, roomId: unknown = ROOM_ID) {
  return validateReservationInput({ roomId, startTime, endTime }, { now: NOW, timeZone: TZ });
}

function errorsOf(result: ReturnType<typeof validate>): ReservationFieldErrors {
  assert.equal(result.valid, false, "expected validation to fail");

  return result.valid ? {} : result.errors;
}

describe("parseIsoInstant", () => {
  it("accepts Z and explicit offsets", () => {
    assert.equal(parseIsoInstant("2026-10-27T14:00:00Z")?.toISOString(), "2026-10-27T14:00:00.000Z");
    assert.equal(parseIsoInstant("2026-10-27T10:00:00-04:00")?.toISOString(), "2026-10-27T14:00:00.000Z");
    assert.equal(parseIsoInstant("2026-10-27T10:00-04:00")?.toISOString(), "2026-10-27T14:00:00.000Z");
  });

  it("rejects timestamps without an offset", () => {
    assert.equal(parseIsoInstant("2026-10-27T10:00:00"), undefined);
  });

  it("rejects dates that do not exist", () => {
    assert.equal(parseIsoInstant("2026-02-30T10:00:00Z"), undefined);
    assert.equal(parseIsoInstant("2026-13-01T10:00:00Z"), undefined);
    assert.equal(parseIsoInstant("2026-10-27T24:00:00Z"), undefined);
  });

  it("rejects non-strings and junk", () => {
    assert.equal(parseIsoInstant(1793109600000), undefined);
    assert.equal(parseIsoInstant("tomorrow"), undefined);
  });
});

describe("parseCalendarDate", () => {
  it("accepts real YYYY-MM-DD dates", () => {
    assert.equal(parseCalendarDate("2026-10-27"), "2026-10-27");
    assert.equal(parseCalendarDate("2028-02-29"), "2028-02-29");
  });

  it("rejects impossible dates, other formats and non-strings", () => {
    assert.equal(parseCalendarDate("2026-02-30"), undefined);
    assert.equal(parseCalendarDate("2026-10-27T10:00:00Z"), undefined);
    assert.equal(parseCalendarDate("10/27/2026"), undefined);
    assert.equal(parseCalendarDate(["2026-10-27"]), undefined);
    assert.equal(parseCalendarDate(undefined), undefined);
  });
});

describe("validateReservationInput", () => {
  it("accepts a valid one-hour booking tomorrow", () => {
    const result = validate("2026-10-27T10:00:00-04:00", "2026-10-27T11:00:00-04:00");

    assert.equal(result.valid, true);
    assert.ok(result.valid);
    assert.equal(result.value.roomId, ROOM_ID);
    assert.equal(result.value.startTime.toISOString(), "2026-10-27T14:00:00.000Z");
    assert.equal(result.value.endTime.toISOString(), "2026-10-27T15:00:00.000Z");
  });

  it("reports every missing field", () => {
    const errors = errorsOf(validateReservationInput(undefined, { now: NOW, timeZone: TZ }));

    assert.equal(errors.roomId, "Choose a room.");
    assert.equal(errors.startTime, "Start time is required.");
    assert.equal(errors.endTime, "End time is required.");
  });

  it("rejects a malformed room id", () => {
    const errors = errorsOf(validate("2026-10-27T14:00:00Z", "2026-10-27T15:00:00Z", "room-101"));

    assert.equal(errors.roomId, "Choose a valid room.");
  });

  it("rejects an impossible calendar date", () => {
    const errors = errorsOf(validate("2026-02-30T14:00:00Z", "2026-02-30T15:00:00Z"));

    assert.equal(errors.startTime, "Enter a valid start time.");
    assert.equal(errors.endTime, "Enter a valid end time.");
  });

  it("rejects an end time before or equal to the start", () => {
    assert.equal(
      errorsOf(validate("2026-10-27T15:00:00Z", "2026-10-27T14:00:00Z")).endTime,
      "End time must be after the start time.",
    );
    assert.equal(
      errorsOf(validate("2026-10-27T15:00:00Z", "2026-10-27T15:00:00Z")).endTime,
      "End time must be after the start time.",
    );
  });

  it("requires 30-minute boundaries", () => {
    assert.match(
      errorsOf(validate("2026-10-27T14:15:00Z", "2026-10-27T15:00:00Z")).startTime ?? "",
      /hour or half hour/,
    );
    assert.match(
      errorsOf(validate("2026-10-27T14:00:00Z", "2026-10-27T15:10:00Z")).endTime ?? "",
      /hour or half hour/,
    );
    assert.match(
      errorsOf(validate("2026-10-27T14:00:30Z", "2026-10-27T15:00:00Z")).startTime ?? "",
      /hour or half hour/,
    );
  });

  it("accepts the 30-minute minimum and the configured maximum", () => {
    const end = new Date(
      Date.parse("2026-10-27T14:00:00Z") + RESERVATION_MAX_MINUTES * 60_000,
    ).toISOString();

    assert.equal(validate("2026-10-27T14:00:00Z", "2026-10-27T14:30:00Z").valid, true);
    assert.equal(validate("2026-10-27T14:00:00Z", end).valid, true);
  });

  it("rejects bookings longer than the configured maximum", () => {
    // The limit lives in config/reservationRules.ts, so this asserts the
    // policy rather than a number repeated here.
    const tooLong = new Date(
      Date.parse("2026-10-27T14:00:00Z") + (RESERVATION_MAX_MINUTES + 30) * 60_000,
    ).toISOString();

    assert.equal(
      errorsOf(validate("2026-10-27T14:00:00Z", tooLong)).endTime,
      `Reservations can be at most ${describeMaxDuration(RESERVATION_MAX_MINUTES)}.`,
    );
  });

  it("rejects a start time that is not in the future", () => {
    assert.equal(
      errorsOf(validate("2026-10-26T12:00:00Z", "2026-10-26T13:00:00Z")).startTime,
      "Start time must be in the future.",
    );
    assert.equal(
      errorsOf(validate("2026-10-25T14:00:00Z", "2026-10-25T15:00:00Z")).startTime,
      "Start time must be in the future.",
    );
  });

  it("allows booking up to 30 days ahead and no further", () => {
    // 25 Nov is today + 30 days; 26 Nov is one day too far.
    assert.equal(validate("2026-11-25T15:00:00Z", "2026-11-25T16:00:00Z").valid, true);
    assert.equal(
      errorsOf(validate("2026-11-26T15:00:00Z", "2026-11-26T16:00:00Z")).startTime,
      "Reservations can be made up to 30 days in advance.",
    );
  });

  it("uses campus dates, not UTC dates, for the advance limit", () => {
    // 25 Nov 22:00 campus time is already 26 Nov in UTC.
    const result = validate("2026-11-25T22:00:00-05:00", "2026-11-25T23:00:00-05:00");

    assert.equal(result.valid, true);
  });

  it("rejects a booking that spans two campus days", () => {
    assert.equal(
      errorsOf(validate("2026-10-27T22:30:00-04:00", "2026-10-28T00:30:00-04:00")).endTime,
      "Reservations must start and end on the same day.",
    );
  });

  it("ignores client-supplied userId and status", () => {
    const result = validateReservationInput(
      {
        roomId: ROOM_ID,
        startTime: "2026-10-27T14:00:00Z",
        endTime: "2026-10-27T15:00:00Z",
        userId: "someone-else",
        status: "cancelled",
      },
      { now: NOW, timeZone: TZ },
    );

    assert.ok(result.valid);
    assert.deepEqual(Object.keys(result.value).sort(), ["endTime", "roomId", "startTime"]);
  });
});

describe("checkWithinOpeningHours", () => {
  const at = (iso: string) => new Date(iso);

  it("accepts bookings from opening time to closing time", () => {
    assert.equal(
      checkWithinOpeningHours(DEFAULT_OPENING_HOURS, at("2026-10-27T08:00:00-04:00"), at("2026-10-27T09:00:00-04:00"), TZ),
      null,
    );
    assert.equal(
      checkWithinOpeningHours(DEFAULT_OPENING_HOURS, at("2026-10-27T19:00:00-04:00"), at("2026-10-27T20:00:00-04:00"), TZ),
      null,
    );
  });

  it("rejects bookings that start before opening", () => {
    assert.equal(
      checkWithinOpeningHours(DEFAULT_OPENING_HOURS, at("2026-10-27T07:30:00-04:00"), at("2026-10-27T08:30:00-04:00"), TZ),
      "This room is open 08:00–20:00 on Tuesdays.",
    );
  });

  it("rejects bookings that end after closing", () => {
    assert.equal(
      checkWithinOpeningHours(DEFAULT_OPENING_HOURS, at("2026-10-27T19:30:00-04:00"), at("2026-10-27T20:30:00-04:00"), TZ),
      "This room is open 08:00–20:00 on Tuesdays.",
    );
  });

  it("rejects days with no opening hours", () => {
    const weekdaysOnly = { monday: { open: "08:00", close: "20:00" } };

    assert.equal(
      checkWithinOpeningHours(weekdaysOnly, at("2026-10-27T10:00:00-04:00"), at("2026-10-27T11:00:00-04:00"), TZ),
      "This room is closed on Tuesdays.",
    );
  });

  it("evaluates hours in campus time across the DST change", () => {
    // 2 Nov 2026 is after DST ends (EST, UTC-5): 13:00Z is 08:00 campus time.
    assert.equal(
      checkWithinOpeningHours(DEFAULT_OPENING_HOURS, at("2026-11-02T13:00:00Z"), at("2026-11-02T14:00:00Z"), TZ),
      null,
    );
    // 12:30Z is 07:30 EST, before opening (it would be 08:30 under EDT).
    assert.equal(
      checkWithinOpeningHours(DEFAULT_OPENING_HOURS, at("2026-11-02T12:30:00Z"), at("2026-11-02T13:30:00Z"), TZ),
      "This room is open 08:00–20:00 on Mondays.",
    );
  });
});
