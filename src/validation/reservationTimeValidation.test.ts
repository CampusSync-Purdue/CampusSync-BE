import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PAST_RESERVATION_MESSAGE,
  validateReservationStartTime,
} from "./reservationTimeValidation.js";

describe("validateReservationStartTime", () => {
  const now = new Date("2026-10-26T20:00:00.000Z");

  it("accepts a future start time", () => {
    const error = validateReservationStartTime("2026-10-26T20:30:00.000Z", now);

    assert.equal(error, null);
  });

  it("rejects a start time in the past", () => {
    const error = validateReservationStartTime("2026-10-26T19:30:00.000Z", now);

    assert.equal(error, PAST_RESERVATION_MESSAGE);
  });

  it("rejects a start time exactly equal to now", () => {
    const error = validateReservationStartTime("2026-10-26T20:00:00.000Z", now);

    assert.equal(error, PAST_RESERVATION_MESSAGE);
  });
});
