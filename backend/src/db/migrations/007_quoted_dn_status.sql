-- Migration 007: Add 'quoted' status to delivery_notes + link back to quotation.
--
-- New workflow: DN → Quotation → LPO → Tax Invoice
--
-- When 1+ pending_invoice DNs are selected and "Create Quotation" is triggered:
--   - A quotation (type='quotation') is created from their combined line items.
--   - Each DN's status is changed to 'quoted' and linked_quotation_id is set.
--
-- When the quotation is converted to a Tax Invoice:
--   - The linked DNs are updated to status='invoiced' automatically.

ALTER TYPE dn_status ADD VALUE IF NOT EXISTS 'quoted';

ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS linked_quotation_id UUID REFERENCES invoices(id);

CREATE INDEX IF NOT EXISTS idx_dn_quotation ON delivery_notes(linked_quotation_id);
