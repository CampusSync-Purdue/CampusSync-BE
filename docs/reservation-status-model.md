# CampusSync Reservation Status Model

**Jira Issue:** CSYNC-33 — US-24: Define how reservations become completed

US-11 (View my bookings) and US-15 (View all reservations) both have to show
"completed" reservations, but no story said how a reservation leaves `active`.
This document settles that and is the reference both views follow.

## 1. The Statuses

A reservation is always in exactly one of three states.

| Status | Meaning | Stored in the database? |
| --- | --- | --- |
| `active` | Booked and not yet finished. Occupies the room for its time range. | Yes — the column default |
| `cancelled` | Called off by its owner or an administrator. Frees the time range. | Yes — written by a cancellation |
| `completed` | Ran to its end without being cancelled. | Derived at read time (see §3) |

The `reservations.status` column is constrained to these three values by
`reservations_status_check`.

## 2. What Moves Between Them

```
                  cancel (owner or administrator)
          ┌───────────────────────────────────────────► cancelled
          │                                              (terminal)
          │
   ────► active
          │
          │       end_time passes
          └───────────────────────────────────────────► completed
                                                         (terminal)
```

- **`active` → `cancelled`** — an explicit action, while the reservation is
  still active and has not yet ended. US-12 covers the owner cancelling;
  US-16 (CSYNC-25) covers an administrator cancelling.
- **`active` → `completed`** — the passage of time. No action, no writer.
- **`cancelled` → anything** — never happens. Cancellation is terminal.
- **`completed` → anything** — never happens. Completion is terminal.

A cancelled reservation therefore stays `cancelled` forever, including long
after its end time has passed. It must never be reported as `completed`.

## 3. Completion Is Derived, Not Stored

Two approaches were considered:

1. **Derive it** — treat any `active` reservation whose end time has passed as
   completed when it is read.
2. **Store it** — run a scheduled job that rewrites past `active` rows to
   `completed`.

**CampusSync derives it.** The reasons:

- No background writer exists whose failure could silently leave rows stale
  and the two views disagreeing.
- Completion is exact to the instant, rather than accurate only to whatever
  interval the job runs on.
- The database keeps a single meaning for a write: a row changes only when a
  person acts on it.

The trade-off is that `status = 'completed'` is not directly queryable in SQL;
a query for completed reservations is
`status = 'active' AND end_time <= now()`. The `completed` value is kept in the
column's constraint so that a materialising job can be introduced later
without a migration.

### Where this is implemented

`src/services/reservationStatus.ts` is the single place that performs the
derivation:

- `deriveReservationStatus(storedStatus, endTime, now)` — the status to show.
- `deriveReservationTimeframe(storedStatus, endTime, now)` — `upcoming` or
  `past`, for the two sections of the My Bookings page.
- `isCancellable(reservation, now)` — whether a cancellation is still allowed.

Every surface that reports a status must call these rather than reading
`reservations.status` directly, so the user view (US-11) and the
administrator view (US-15) can never disagree.

## 4. Timeframe

The My Bookings page splits reservations into **Upcoming** and **History**.

| Derived status | Section |
| --- | --- |
| `active` | Upcoming |
| `completed` | History |
| `cancelled` | History |

A cancelled reservation belongs to history even when its start time is still
in the future: it no longer holds the room, so it is not something the user is
expecting to attend.

## 5. Time Handling

All comparisons happen between absolute UTC instants, per
[`docs/date-time-conventions.md`](./date-time-conventions.md). The boundary
follows the half-open range `[start, end)` the schema's exclusion constraint
uses: a reservation ending at exactly the current instant is already
`completed`, which is also why a booking ending at 11:00 does not conflict
with one starting at 11:00.
