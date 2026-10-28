-- Hand-written migration: Drizzle's schema DSL cannot express extensions or
-- EXCLUDE constraints.
--
-- Active reservations for the same room may not overlap. The time range is
-- half-open, so a booking ending at 11:00 does not conflict with one starting
-- at 11:00. Cancelled and completed reservations are ignored.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_overlap" EXCLUDE USING gist (
  "room_id" WITH =,
  tstzrange("start_time", "end_time", '[)') WITH &&
) WHERE ("status" = 'active');
