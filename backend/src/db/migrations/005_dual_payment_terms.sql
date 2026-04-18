-- Migration 005: Dual payment terms + purchase due dates
--
-- Problem: a single payment_terms_days field can't represent both sides of a
-- dual-role entity (e.g. AL MOOSAWI may owe us on Net 30 but we owe them on Net 60).
-- Also, purchases had no due_date — AP aging was computed from purchase_date alone,
-- which is inaccurate when payment terms vary.
--
-- Changes:
--   customers.supplier_payment_terms_days  — AP/purchase terms (NULL = same as payment_terms_days)
--   purchases.due_date                     — explicit AP due date, auto-filled on creation

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS supplier_payment_terms_days INTEGER DEFAULT NULL;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;

-- Backfill purchase due dates from purchase_date + supplier's payment terms
-- Uses COALESCE(supplier_payment_terms_days, payment_terms_days, 30)
UPDATE purchases p
SET due_date = p.purchase_date + (
  COALESCE(
    (SELECT c.supplier_payment_terms_days FROM customers c WHERE c.id = p.supplier_id),
    (SELECT c.payment_terms_days          FROM customers c WHERE c.id = p.supplier_id),
    30
  ) * INTERVAL '1 day'
)
WHERE due_date IS NULL;
