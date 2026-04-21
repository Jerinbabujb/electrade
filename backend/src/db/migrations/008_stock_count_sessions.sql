-- Cycle count sessions: named, persistent draft sessions for gradual physical stock counting
CREATE TABLE IF NOT EXISTS stock_count_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  category_id  UUID        REFERENCES categories(id) ON DELETE SET NULL,
  status       TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','complete')),
  notes        TEXT,
  created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Per-product counts within a session
CREATE TABLE IF NOT EXISTS stock_count_session_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES stock_count_sessions(id) ON DELETE CASCADE,
  product_id   UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  system_qty   NUMERIC(12,3) NOT NULL DEFAULT 0,
  physical_qty NUMERIC(12,3),
  counted_at   TIMESTAMPTZ,
  UNIQUE (session_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_scs_company ON stock_count_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_scsi_session ON stock_count_session_items(session_id);
