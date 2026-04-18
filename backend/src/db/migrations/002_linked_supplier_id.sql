-- Link a customer record to its corresponding supplier record (same real-world entity)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS linked_supplier_id UUID REFERENCES customers(id) ON DELETE SET NULL;
