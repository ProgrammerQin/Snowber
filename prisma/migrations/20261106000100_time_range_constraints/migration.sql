-- Hand-written migration: constraints Prisma's schema language cannot express.
-- Prisma DateTime columns are TIMESTAMP(3) WITHOUT TIME ZONE, so ranges use tsrange.

-- btree_gist lets a GiST index combine "=" on an id column with "&&" (overlap) on a range.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- A cleaner cannot post two shifts that overlap.
ALTER TABLE "Shift"
  ADD CONSTRAINT "Shift_no_overlap"
  EXCLUDE USING gist ("cleanerId" WITH =, tsrange("startsAt", "endsAt") WITH &&);

-- The same tool cannot be approved for two overlapping rentals.
-- Requested, rejected, returned and cancelled rentals are ignored.
ALTER TABLE "ToolRental"
  ADD CONSTRAINT "ToolRental_no_overlap"
  EXCLUDE USING gist ("toolId" WITH =, tsrange("startsAt", "endsAt") WITH &&)
  WHERE (status = 'APPROVED');

-- Sanity checks.
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_valid_range" CHECK ("endsAt" > "startsAt");
ALTER TABLE "ServiceWindow" ADD CONSTRAINT "ServiceWindow_valid_range" CHECK ("endsAt" > "startsAt");
ALTER TABLE "ToolRental" ADD CONSTRAINT "ToolRental_valid_range" CHECK ("endsAt" > "startsAt");
ALTER TABLE "ServiceWindow" ADD CONSTRAINT "ServiceWindow_multiplier_range" CHECK ("multiplierBps" BETWEEN 5000 AND 30000);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Job" ADD CONSTRAINT "Job_amounts_nonnegative" CHECK ("priceCents" >= 0 AND "tipCents" >= 0);
