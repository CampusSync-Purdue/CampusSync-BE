# CampusSync Booking Rules

**Jira Issue:** CSYNC-19 — US-10: Enforce booking duration rules

## Maximum Reservation Duration

A single reservation may run for at most **3 hours (180 minutes)**.

The limit exists so that rooms are shared fairly: without it one booking can
hold a room for a whole day.

### Where it is configured

`src/config/reservationRules.ts` is the only place the limit is defined.
Nothing else hard-codes a duration — the server-side check and the limit
published to the browser both read from it, so the two cannot disagree.

Override it with an environment variable:

```env
MAX_RESERVATION_DURATION_MINUTES=180
```

An absent, malformed, or non-positive value falls back to the default. A typo
in configuration should not quietly allow unbounded bookings, so there is no
value that removes the limit.

### How it is measured

Duration is **elapsed time between absolute UTC instants**, never the
difference between two wall-clock readings. See
[`docs/date-time-conventions.md`](./date-time-conventions.md) section 7.

This matters across daylight saving transitions:

| Campus-local window | Looks like | Actually elapses |
| --- | --- | --- |
| 2026-03-08, 01:30 → 03:30 (spring forward) | 2 hours | 1 hour |
| 2026-11-01, 01:00 → 02:00 (fall back) | 1 hour | 2 hours |

The limit applies to the time the room is genuinely occupied, so the second
case is rejected against a 90-minute limit even though the clock shows an
hour.

### Where it is enforced

`validateReservationDuration` in `src/validation/reservationDuration.ts` is
the shared check. Every endpoint accepting a reservation window must call it.

| Surface | Status |
| --- | --- |
| Availability search (`GET /api/rooms/availability`) | Enforced — a window over the limit is rejected with 400 before any rooms are offered |
| Create a reservation (US-08, CSYNC-17) | **Not yet wired.** The endpoint does not exist yet; it must call `validateReservationDuration` when it is built |

The browser reads the limit from `GET /api/reservations/rules` and shows it
next to the booking controls, warning as soon as a selected range exceeds it.
That is a convenience: the server repeats the check and is the real guard.

### Rejection message

A rejected window is answered with 400 and a message naming the limit, for
example:

> A reservation may not be longer than 3 hours.

The message is reported against the end time, the field a caller can change.
