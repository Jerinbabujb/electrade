-- Per-company module visibility toggle
ALTER TABLE companies ADD COLUMN IF NOT EXISTS hidden_modules TEXT[] NOT NULL DEFAULT '{}';
