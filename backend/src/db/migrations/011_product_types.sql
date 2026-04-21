-- Migration 011: product_type column + nullable DN product_id for free-text lines

-- 1. Add product_type to products (stock / non_stock / service)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) NOT NULL DEFAULT 'stock';

-- Back-fill: existing non-tracked products become 'non_stock'
UPDATE products SET product_type = 'non_stock' WHERE is_stock_tracked = false AND product_type = 'stock';

-- 2. Allow free-text line items on delivery notes (no catalog product required)
ALTER TABLE delivery_note_items
  ALTER COLUMN product_id DROP NOT NULL;

-- 3. Update dn_item_stock_out: skip items with no product or non-tracked products
CREATE OR REPLACE FUNCTION dn_item_stock_out() RETURNS TRIGGER AS $$
DECLARE
  v_dn       delivery_notes%ROWTYPE;
  v_tracked  BOOLEAN;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT is_stock_tracked INTO v_tracked FROM products WHERE id = NEW.product_id;
  IF NOT COALESCE(v_tracked, true) THEN RETURN NEW; END IF;
  SELECT * INTO v_dn FROM delivery_notes WHERE id = NEW.dn_id;
  INSERT INTO stock_movements(company_id, product_id, movement_type, qty, ref_type, ref_id, ref_no, created_by)
  VALUES (v_dn.company_id, NEW.product_id, 'dn_out', -NEW.qty_delivered,
          'delivery_note', v_dn.id, v_dn.dn_no, v_dn.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Update dn_cancel_stock_reversal: only reverse tracked products
CREATE OR REPLACE FUNCTION dn_cancel_stock_reversal() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    INSERT INTO stock_movements(company_id, product_id, movement_type, qty, ref_type, ref_id, ref_no, notes)
    SELECT OLD.company_id, dni.product_id, 'dn_reversal', dni.qty_delivered,
           'delivery_note', OLD.id, OLD.dn_no, 'Stock reversed — DN cancelled'
    FROM   delivery_note_items dni
    JOIN   products p ON p.id = dni.product_id
    WHERE  dni.dn_id = OLD.id
      AND  dni.product_id IS NOT NULL
      AND  p.is_stock_tracked = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
