import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  minutesToTime,
  timeToMinutes,
  toZonedDateTime,
  zonedTimeToInstant,
} from "./campusTime.js";

const TZ = "America/Indiana/Indianapolis";

describe("toZonedDateTime", () => {
  it("applies daylight saving time (EDT, UTC-4) in summer", () => {
    const zoned = toZonedDateTime(new Date("2026-07-15T14:30:00Z"), TZ);

    assert.deepEqual(zoned, {
      date: "2026-07-15",
      minutes: 10 * 60 + 30,
      seconds: 0,
      weekday: "wednesday",
    });
  });

  it("applies standard time (EST, UTC-5) in winter", () => {
    const zoned = toZonedDateTime(new Date("2026-12-01T13:00:00Z"), TZ);

    assert.equal(zoned.date, "2026-12-01");
    assert.equal(zoned.minutes, 8 * 60);
    assert.equal(zoned.weekday, "tuesday");
  });

  it("reports the campus date, not the UTC date, late in the evening", () => {
    const zoned = toZonedDateTime(new Date("2026-10-27T02:00:00Z"), TZ);

    assert.equal(zoned.date, "2026-10-26");
    assert.equal(zoned.minutes, 22 * 60);
  });
});

describe("zonedTimeToInstant", () => {
  it("round-trips campus wall-clock times in both seasons", () => {
    assert.equal(
      zonedTimeToInstant("2026-07-15", "10:30", TZ).toISOString(),
      "2026-07-15T14:30:00.000Z",
    );
    assert.equal(
      zonedTimeToInstant("2026-12-01", "08:00", TZ).toISOString(),
      "2026-12-01T13:00:00.000Z",
    );
  });
});

describe("time helpers", () => {
  it("converts between HH:mm and minutes", () => {
    assert.equal(timeToMinutes("08:00"), 480);
    assert.equal(timeToMinutes("20:00"), 1200);
    assert.ok(Number.isNaN(timeToMinutes("8:00")));
    assert.equal(minutesToTime(510), "08:30");
  });

  it("adds days across month and year boundaries", () => {
    assert.equal(addDays("2026-10-26", 30), "2026-11-25");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  });
});
