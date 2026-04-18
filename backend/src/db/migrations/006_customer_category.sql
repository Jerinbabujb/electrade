-- Migration 006: Decouple AR classification from role detection.
--
-- The `type` column conflates two concerns:
--   - Role: is this entity a customer, supplier, or both?   → now handled by is_customer/is_supplier
--   - Classification: how is the customer categorised for AR? → this migration adds customer_category
--
-- `customer_category` holds the AR-side classification (retail, wholesale, contractor, government).
-- It is only meaningful when is_customer = TRUE. Pure suppliers leave it NULL.
-- The `type` column is kept for backward compatibility but is no longer used for classification.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_category VARCHAR(20) DEFAULT NULL;

-- Backfill: non-supplier records carry their type value as category
UPDATE customers
  SET customer_category = type::text
  WHERE type != 'supplier';

-- Dual-role entities (type='supplier' but is_customer=TRUE) default to 'retail'.
-- Users can update this via the Customers module.
UPDATE customers
  SET customer_category = 'retail'
  WHERE type = 'supplier' AND is_customer = TRUE AND customer_category IS NULL;
