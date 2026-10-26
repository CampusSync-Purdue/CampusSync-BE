export const PAST_RESERVATION_MESSAGE =
  "The reservation start time must be in the future.";

/**
 * Validates that a reservation start instant is strictly in the future.
 *
 * The start time is expected to be an absolute UTC timestamp so that the
 * comparison is independent of the caller's local time zone.
 */
export function validateReservationStartTime(
  startUtc: string,
  now: Date = new Date(),
): string | null {
  const start = new Date(startUtc);

  if (Number.isNaN(start.getTime())) {
    return "Enter a valid reservation start time.";
  }

  return start.getTime() <= now.getTime() ? PAST_RESERVATION_MESSAGE : null;
}
