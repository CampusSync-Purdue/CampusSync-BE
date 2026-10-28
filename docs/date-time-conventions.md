# CampusSync Date and Time Conventions

**Jira Issue:** CSYNC-31 — US-22: Define Time Zone and Date/Time Handling Conventions

## 1. Campus Time Zone

CampusSync uses the IANA time zone `America/Indiana/Indianapolis` for campus-local date and time calculations.

This time zone accounts for Eastern Standard Time (EST, UTC-05:00) and Eastern Daylight Time (EDT, UTC-04:00).

Fixed UTC offsets must not be used as substitutes for the campus time zone because offsets change during daylight saving time.

## 2. Database Storage

Reservation start and end timestamps are stored as absolute instants in PostgreSQL using `TIMESTAMPTZ`.

The existing `reservations` table uses:

- `start_time TIMESTAMPTZ`
- `end_time TIMESTAMPTZ`

Application services should convert timestamps to UTC when producing API responses and logs.

Database sessions should use UTC where possible for consistent timestamp representation.

Reservations must satisfy `end_time > start_time`.

Reservation intervals use half-open ranges `[start, end)`, allowing one reservation to begin at the exact instant another ends.

## 3. API Date and Time Format

API reservation timestamps use ISO 8601 UTC strings with a `Z` suffix.

Example:

`2026-10-21T18:00:00.000Z`

Incoming timestamps must specify a time zone using `Z` or an explicit UTC offset.

Timestamps without an offset must not be interpreted using the server's local time zone.

Date-only values use `YYYY-MM-DD`.

## 4. Display Convention

Reservation times are displayed in the campus time zone, not the browser's automatically detected time zone.

Example:

- UTC: `2026-10-21T18:00:00.000Z`
- Campus local: October 21, 2026, 2:00 PM EDT

User interfaces should show the local time and an appropriate time-zone abbreviation or offset.

## 5. Room Operating Hours

Room operating hours in `availability_hours` represent recurring local wall-clock times in `America/Indiana/Indianapolis`.

Times use the 24-hour `HH:mm` format.

Example:

    {
      "monday": {
        "open": "08:00",
        "close": "22:00"
      }
    }

Operating hours are not stored as UTC timestamps because they recur on local calendar days.

Room availability calculations must convert the relevant local date and operating hours to absolute instants before comparing them with reservations.

An empty `availability_hours` object does not automatically mean that a room is open 24 hours. Its meaning must be defined by the room availability feature.

Overnight operating hours require explicit handling by the availability service.

## 6. Daylight Saving Time

CampusSync must handle daylight saving time changes using the IANA time-zone database.

### Spring Forward

Some local times do not exist when clocks move forward.

For example, `2026-03-08 02:30` is not a valid local time in Indianapolis.

Nonexistent local times must be rejected rather than silently shifted.

### Fall Back

Some local times occur twice when clocks move backward.

For example, `2026-11-01 01:30` can refer to two different instants.

Ambiguous local times must not be resolved silently.

Clients must supply an explicit offset or select which occurrence is intended.

If an offset and a campus-local time are both supplied, the backend must verify that they describe the same local time in the campus time zone.

## 7. Reservation Duration

Reservation duration is calculated using elapsed time between UTC instants, not subtraction of local clock readings.

For example, a reservation spanning a daylight saving time change may have a different elapsed duration than its wall-clock appearance suggests.

## 8. Implementation and Testing

Shared backend date/time utilities should handle validation, conversion, and formatting.

Automated tests should cover:

- UTC to campus-local conversion
- Campus-local to UTC conversion
- Invalid or missing UTC offsets
- Spring-forward nonexistent times
- Fall-back ambiguous times
- Reservation durations across DST transitions

The frontend and backend should follow the same API conventions.

## 9. Scope

These conventions establish the date/time contract for future reservation and availability functionality.

CSYNC-31 does not implement the complete reservation booking system or room operating-hours enforcement.
