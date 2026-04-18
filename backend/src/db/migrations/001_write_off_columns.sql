-- Add write-off tracking columns to invoices.
-- These were added to schema.sql on 2026-04-15 but may be missing
-- from databases created before that date.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS write_off_amount NUMERIC(15,3),
  ADD COLUMN IF NOT EXISTS write_off_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS write_off_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS write_off_reason TEXT;
