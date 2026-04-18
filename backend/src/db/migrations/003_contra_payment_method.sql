-- Add 'contra' as a payment method for AR/AP netting entries
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'contra';
