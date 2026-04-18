-- Migration 004: Replace single-value type-based role detection with explicit boolean flags.
--
-- Previously, type='supplier' meant "supplier only", and every other type value meant
-- "customer only". This breaks for dual-role entities (customer AND supplier).
--
-- After this migration:
--   is_customer = TRUE  — entity can appear on invoices, delivery notes, statements
--   is_supplier = TRUE  — entity can appear on purchases, purchase orders
--   Both can be TRUE simultaneously (dual-role / contra account entity)
--
-- The existing `type` column is kept for AR classification (retail, wholesale, etc.)
-- and is no longer used to determine role visibility.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_customer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_supplier BOOLEAN NOT NULL DEFAULT FALSE;

-- All non-supplier records are customers
UPDATE customers SET is_customer = TRUE WHERE type != 'supplier';

-- All supplier-type records are suppliers
UPDATE customers SET is_supplier = TRUE WHERE type = 'supplier';

-- Supplier-type records that already have AR invoices are also customers (dual-role)
UPDATE customers
SET is_customer = TRUE
WHERE type = 'supplier'
  AND id IN (SELECT DISTINCT customer_id FROM invoices);

-- Supplier-type records linked via linked_supplier_id also need is_supplier = TRUE
-- on the supplier side (already handled above), but ensure the customer side has is_customer
UPDATE customers
SET is_customer = TRUE
WHERE type != 'supplier'
  AND linked_supplier_id IS NOT NULL;
