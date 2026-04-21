-- ============================================================
-- ElecTrade Pro — PostgreSQL Database Schema
-- Al Manama Electrical Trading Co. W.L.L
-- Version 1.0 | April 2025
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role        AS ENUM ('admin','sales','storekeeper','accountant');
CREATE TYPE customer_type    AS ENUM ('retail','wholesale','contractor','government','supplier');
CREATE TYPE invoice_type     AS ENUM ('tax_invoice','quotation','proforma','credit_note','receipt','delivery_note');
CREATE TYPE invoice_status   AS ENUM ('draft','unpaid','partial','paid','overdue','void');
CREATE TYPE dn_status        AS ENUM ('pending_invoice','invoiced','cancelled');
CREATE TYPE movement_type    AS ENUM ('purchase_in','dn_out','dn_reversal','invoice_out','return_in','adjustment','opening');
CREATE TYPE payment_method   AS ENUM ('cash','bank_transfer','cheque','card','other');
CREATE TYPE payment_status   AS ENUM ('unpaid','partial','paid');
CREATE TYPE match_status     AS ENUM ('matched','unmatched','manually_matched');
CREATE TYPE doc_type         AS ENUM ('invoice','delivery_note','purchase','expense','manual');
CREATE TYPE category_type    AS ENUM ('product','customer','expense');
CREATE TYPE unit_type        AS ENUM ('pcs','mtr','box','reel','kg','set','pack','ltr','m2','m3');

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE companies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(200) NOT NULL,
  name_ar           VARCHAR(200),
  cr_number         VARCHAR(50)  NOT NULL,
  vat_number        VARCHAR(50)  NOT NULL,
  address           TEXT,
  tel               VARCHAR(30),
  email             VARCHAR(150),
  logo_url          TEXT,
  logo              TEXT,
  default_vat_rate  NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  default_currency  VARCHAR(5)   NOT NULL DEFAULT 'BHD',
  invoice_prefix    VARCHAR(10)  NOT NULL DEFAULT 'INV',
  dn_prefix         VARCHAR(10)  NOT NULL DEFAULT 'DN',
  po_prefix         VARCHAR(10)  NOT NULL DEFAULT 'PUR',
  next_invoice_seq  INTEGER      NOT NULL DEFAULT 1,
  next_dn_seq       INTEGER      NOT NULL DEFAULT 1,
  next_pur_seq      INTEGER      NOT NULL DEFAULT 1,
  bank_name         VARCHAR(100),
  bank_acct_name    VARCHAR(200),
  bank_iban         VARCHAR(50),
  bank_swift        VARCHAR(20),
  vat_quarter_start SMALLINT     NOT NULL DEFAULT 1, -- 1=Jan, 4=Apr
  theme_color       VARCHAR(7)   DEFAULT '#1a5fa8',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role   NOT NULL DEFAULT 'sales',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_company ON users(company_id);

-- ============================================================
-- USER_COMPANIES  (junction: one user can access many companies)
-- ============================================================
CREATE TABLE user_companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        user_role NOT NULL DEFAULT 'sales',
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);
CREATE INDEX idx_user_companies_user    ON user_companies(user_id);
CREATE INDEX idx_user_companies_company ON user_companies(company_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name    TEXT,
  action       TEXT NOT NULL,        -- e.g. 'invoice.void', 'user.role_change'
  entity_type  TEXT NOT NULL,        -- e.g. 'invoice', 'user', 'company'
  entity_id    TEXT,
  entity_label TEXT,                 -- human-readable: invoice_no, user name…
  old_value    JSONB,
  new_value    JSONB,
  ip           TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_company_created ON audit_log(company_id, created_at DESC);
CREATE INDEX audit_log_entity          ON audit_log(company_id, entity_type, entity_id);

-- ============================================================
-- AUTOMATION SETTINGS (per-company)
-- ============================================================
CREATE TABLE automation_settings (
  company_id                    UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  overdue_enabled               BOOLEAN NOT NULL DEFAULT false,
  overdue_interval_days         INT     NOT NULL DEFAULT 7,
  lowstock_enabled              BOOLEAN NOT NULL DEFAULT false,
  lowstock_alert_email          TEXT,
  overdue_last_run              TIMESTAMPTZ,
  overdue_last_count            INT     NOT NULL DEFAULT 0,
  lowstock_last_run             TIMESTAMPTZ,
  lowstock_last_count           INT     NOT NULL DEFAULT 0,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CUSTOMER PORTAL TOKENS
-- ============================================================
CREATE TABLE customer_portal_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, company_id)
);
CREATE INDEX cpt_token ON customer_portal_tokens(token);

-- ============================================================
-- INVITE TOKENS (email invitation to join a company)
-- ============================================================
CREATE TABLE invite_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'sales',
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invite_token_idx ON invite_tokens(token);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        VARCHAR(100)  NOT NULL,
  type        category_type NOT NULL,
  parent_id   UUID          REFERENCES categories(id),
  sort_order  SMALLINT      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_cat_company ON categories(company_id, type);

-- ============================================================
-- CUSTOMERS & SUPPLIERS
-- ============================================================
CREATE TABLE customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code                VARCHAR(20)   NOT NULL,
  name                VARCHAR(200)  NOT NULL,
  type                customer_type NOT NULL DEFAULT 'retail',
  cr_number           VARCHAR(50),
  vat_number          VARCHAR(50),
  address             TEXT,
  tel                 VARCHAR(30),
  email               VARCHAR(150),
  credit_limit        NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  payment_terms_days  INTEGER       NOT NULL DEFAULT 30,
  price_tier          SMALLINT      NOT NULL DEFAULT 1 CHECK (price_tier BETWEEN 1 AND 4),
  category_id         UUID          REFERENCES categories(id),
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);
CREATE INDEX idx_cust_company ON customers(company_id);
CREATE INDEX idx_cust_name    ON customers(company_id, name);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID       NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sku               VARCHAR(50) NOT NULL,
  barcode           VARCHAR(50),
  name              VARCHAR(200) NOT NULL,
  description       TEXT,
  category_id       UUID        REFERENCES categories(id),
  brand             VARCHAR(100),
  country_of_origin VARCHAR(60),
  unit              unit_type   NOT NULL DEFAULT 'pcs',
  box_qty           NUMERIC(10,3) NOT NULL DEFAULT 1,
  voltage_rating    VARCHAR(30),
  ampere_rating     VARCHAR(30),
  wattage           VARCHAR(30),
  cost_price        NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  price_1           NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  price_2           NUMERIC(15,3)          DEFAULT 0.000,
  price_3           NUMERIC(15,3)          DEFAULT 0.000,
  price_4           NUMERIC(15,3)          DEFAULT 0.000,
  vat_rate          NUMERIC(5,2)  NOT NULL DEFAULT 10.00,
  stock_qty         NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  stock_min         NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  is_stock_tracked  BOOLEAN      NOT NULL DEFAULT true,
  is_sales_item     BOOLEAN      NOT NULL DEFAULT true,
  is_purchase_item  BOOLEAN      NOT NULL DEFAULT true,
  is_active         BOOLEAN      NOT NULL DEFAULT true,
  notes             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(company_id, sku)
);
CREATE INDEX idx_prod_company  ON products(company_id);
CREATE INDEX idx_prod_barcode  ON products(company_id, barcode);
CREATE INDEX idx_prod_category ON products(category_id);

-- ============================================================
-- STOCK MOVEMENTS (immutable audit log)
-- ============================================================
CREATE TABLE stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID          NOT NULL REFERENCES companies(id),
  product_id     UUID          NOT NULL REFERENCES products(id),
  movement_type  movement_type NOT NULL,
  qty            NUMERIC(15,3) NOT NULL, -- positive=in, negative=out
  ref_type       doc_type,
  ref_id         UUID,
  ref_no         VARCHAR(30),
  notes          TEXT,
  created_by     UUID          REFERENCES users(id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_sm_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX idx_sm_ref     ON stock_movements(ref_type, ref_id);

-- Trigger: recalculate stock_qty after every stock movement
CREATE OR REPLACE FUNCTION recalc_stock_qty() RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET    stock_qty = (
           SELECT COALESCE(SUM(qty), 0)
           FROM   stock_movements
           WHERE  product_id = NEW.product_id
         ),
         updated_at = now()
  WHERE  id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_qty
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION recalc_stock_qty();

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID         NOT NULL REFERENCES companies(id),
  invoice_no      VARCHAR(30)  NOT NULL,
  type            invoice_type NOT NULL DEFAULT 'tax_invoice',
  customer_id     UUID         NOT NULL REFERENCES customers(id),
  invoice_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  po_reference    VARCHAR(100),
  subtotal        NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  total_discount  NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  total_vat       NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  shipping        NUMERIC(15,3)          DEFAULT 0.000,
  grand_total     NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  amount_paid     NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  balance_due     NUMERIC(15,3) GENERATED ALWAYS AS (grand_total - amount_paid) STORED,
  payment_status  invoice_status NOT NULL DEFAULT 'unpaid',
  notes           TEXT,
  internal_notes  TEXT,
  valid_until     DATE,
  converted_at    TIMESTAMPTZ,
  converted_by_user UUID REFERENCES users(id),
  write_off_amount  NUMERIC(15,3),
  write_off_date    TIMESTAMPTZ,
  write_off_by      UUID         REFERENCES users(id),
  write_off_reason  TEXT,
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(company_id, invoice_no)
);
CREATE INDEX idx_inv_company    ON invoices(company_id, invoice_date DESC);
CREATE INDEX idx_inv_customer   ON invoices(customer_id);
CREATE INDEX idx_inv_status     ON invoices(company_id, payment_status);
CREATE INDEX idx_inv_due        ON invoices(due_date) WHERE payment_status NOT IN ('paid','void');

-- Trigger: auto-update payment_status after payment insert
CREATE OR REPLACE FUNCTION update_invoice_status() RETURNS TRIGGER AS $$
DECLARE v_inv invoices%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM invoices WHERE id = NEW.reference_id;
  UPDATE invoices SET
    amount_paid     = (SELECT COALESCE(SUM(amount),0) FROM payments WHERE reference_id = NEW.reference_id),
    payment_status  = CASE
      WHEN (grand_total - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE reference_id = NEW.reference_id)) <= 0
        THEN 'paid'::invoice_status
      WHEN (SELECT COALESCE(SUM(amount),0) FROM payments WHERE reference_id = NEW.reference_id) > 0
        THEN 'partial'::invoice_status
      WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE
        THEN 'overdue'::invoice_status
      ELSE 'unpaid'::invoice_status
    END,
    updated_at = now()
  WHERE id = NEW.reference_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INVOICE LINE ITEMS
-- ============================================================
CREATE TABLE invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID         NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  UUID         REFERENCES products(id),
  line_no     SMALLINT     NOT NULL,
  part_no     VARCHAR(50),
  description VARCHAR(500) NOT NULL,
  qty         NUMERIC(15,3) NOT NULL,
  unit        VARCHAR(20),
  unit_price  NUMERIC(15,3) NOT NULL,
  discount    NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  vat_rate    NUMERIC(5,2)  NOT NULL DEFAULT 10.00,
  unit_cost   NUMERIC(15,3) NOT NULL DEFAULT 0.000,   -- snapshot of cost_price at invoice time
  net_amount  NUMERIC(15,3) GENERATED ALWAYS AS ((qty * unit_price) - discount) STORED,
  vat_amount  NUMERIC(15,3) GENERATED ALWAYS AS (((qty * unit_price) - discount) * vat_rate / 100) STORED,
  line_total  NUMERIC(15,3) GENERATED ALWAYS AS (((qty * unit_price) - discount) * (1 + vat_rate / 100)) STORED
);
CREATE INDEX idx_ii_invoice ON invoice_items(invoice_id);

-- ============================================================
-- DELIVERY NOTES
-- ============================================================
CREATE TABLE delivery_notes (
  id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID      NOT NULL REFERENCES companies(id),
  dn_no            VARCHAR(30) NOT NULL,
  customer_id      UUID      NOT NULL REFERENCES customers(id),
  dn_date          DATE      NOT NULL DEFAULT CURRENT_DATE,
  delivery_address TEXT,
  project_ref      VARCHAR(200),
  po_reference     VARCHAR(100),
  delivered_by     VARCHAR(100),
  invoice_id       UUID      REFERENCES invoices(id),
  status           dn_status NOT NULL DEFAULT 'pending_invoice',
  notes            TEXT,
  created_by       UUID      REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at     TIMESTAMPTZ,
  UNIQUE(company_id, dn_no)
);
CREATE INDEX idx_dn_company    ON delivery_notes(company_id, dn_date DESC);
CREATE INDEX idx_dn_customer   ON delivery_notes(customer_id);
CREATE INDEX idx_dn_status     ON delivery_notes(company_id, status);
CREATE INDEX idx_dn_invoice    ON delivery_notes(invoice_id);

-- ============================================================
-- DELIVERY NOTE LINE ITEMS
-- Triggers stock_movements on INSERT
-- ============================================================
CREATE TABLE delivery_note_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dn_id          UUID          NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  product_id     UUID          NOT NULL REFERENCES products(id),
  line_no        SMALLINT      NOT NULL,
  part_no        VARCHAR(50),
  description    VARCHAR(500),
  qty_ordered    NUMERIC(15,3) NOT NULL,
  qty_delivered  NUMERIC(15,3) NOT NULL,
  unit           VARCHAR(20),
  unit_price     NUMERIC(15,3) NOT NULL DEFAULT 0.000
);
CREATE INDEX idx_dni_dn ON delivery_note_items(dn_id);

-- Trigger: deduct stock when DN item is inserted
CREATE OR REPLACE FUNCTION dn_item_stock_out() RETURNS TRIGGER AS $$
DECLARE v_dn delivery_notes%ROWTYPE;
BEGIN
  SELECT * INTO v_dn FROM delivery_notes WHERE id = NEW.dn_id;
  INSERT INTO stock_movements(company_id, product_id, movement_type, qty, ref_type, ref_id, ref_no, created_by)
  VALUES (v_dn.company_id, NEW.product_id, 'dn_out', -NEW.qty_delivered, 'delivery_note', v_dn.id, v_dn.dn_no, v_dn.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dn_stock_out
AFTER INSERT ON delivery_note_items
FOR EACH ROW EXECUTE FUNCTION dn_item_stock_out();

-- Trigger: reverse stock when DN is cancelled
CREATE OR REPLACE FUNCTION dn_cancel_stock_reversal() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    INSERT INTO stock_movements(company_id, product_id, movement_type, qty, ref_type, ref_id, ref_no, notes)
    SELECT OLD.company_id, dni.product_id, 'dn_reversal', dni.qty_delivered,
           'delivery_note', OLD.id, OLD.dn_no, 'Stock reversed — DN cancelled'
    FROM   delivery_note_items dni
    WHERE  dni.dn_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dn_cancel_reversal
AFTER UPDATE OF status ON delivery_notes
FOR EACH ROW EXECUTE FUNCTION dn_cancel_stock_reversal();

-- ============================================================
-- PURCHASES
-- ============================================================
CREATE TABLE purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID    NOT NULL REFERENCES companies(id),
  purchase_no         VARCHAR(30) NOT NULL,
  supplier_id         UUID    NOT NULL REFERENCES customers(id),
  supplier_invoice_no VARCHAR(100),
  purchase_date       DATE    NOT NULL DEFAULT CURRENT_DATE,
  subtotal            NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  total_vat           NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  grand_total         NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  amount_paid         NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  payment_status      payment_status NOT NULL DEFAULT 'unpaid',
  notes               TEXT,
  created_by          UUID    REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, purchase_no)
);

CREATE TABLE purchase_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID          NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id  UUID          REFERENCES products(id),
  line_no     SMALLINT      NOT NULL,
  part_no     VARCHAR(50),
  description VARCHAR(500)  NOT NULL,
  qty         NUMERIC(15,3) NOT NULL,
  unit        VARCHAR(20),
  unit_price  NUMERIC(15,3) NOT NULL,
  vat_rate    NUMERIC(5,2)  NOT NULL DEFAULT 10.00,
  net_amount  NUMERIC(15,3) GENERATED ALWAYS AS (qty * unit_price) STORED,
  vat_amount  NUMERIC(15,3) GENERATED ALWAYS AS (qty * unit_price * vat_rate / 100) STORED,
  line_total  NUMERIC(15,3) GENERATED ALWAYS AS (qty * unit_price * (1 + vat_rate / 100)) STORED
);

-- Trigger: add stock_in on purchase save
CREATE OR REPLACE FUNCTION purchase_item_stock_in() RETURNS TRIGGER AS $$
DECLARE v_pur purchases%ROWTYPE;
BEGIN
  SELECT * INTO v_pur FROM purchases WHERE id = NEW.purchase_id;
  IF NEW.product_id IS NOT NULL THEN
    INSERT INTO stock_movements(company_id, product_id, movement_type, qty, ref_type, ref_id, ref_no, created_by)
    VALUES (v_pur.company_id, NEW.product_id, 'purchase_in', NEW.qty, 'purchase', v_pur.id, v_pur.purchase_no, v_pur.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchase_stock_in
AFTER INSERT ON purchase_items
FOR EACH ROW EXECUTE FUNCTION purchase_item_stock_in();

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID           NOT NULL REFERENCES companies(id),
  reference_type doc_type       NOT NULL,
  reference_id   UUID           NOT NULL,
  payment_date   DATE           NOT NULL DEFAULT CURRENT_DATE,
  amount         NUMERIC(15,3)  NOT NULL,
  method         payment_method NOT NULL DEFAULT 'bank_transfer',
  reference_no   VARCHAR(100),
  notes          TEXT,
  created_by     UUID           REFERENCES users(id),
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX idx_pay_ref ON payments(reference_type, reference_id);

CREATE TRIGGER trg_invoice_payment_status
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
WHEN (NEW.reference_type = 'invoice')
EXECUTE FUNCTION update_invoice_status();

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID    NOT NULL REFERENCES companies(id),
  expense_no   VARCHAR(30) NOT NULL,
  category_id  UUID    REFERENCES categories(id),
  supplier_id  UUID    REFERENCES customers(id),
  expense_date DATE    NOT NULL DEFAULT CURRENT_DATE,
  description  VARCHAR(300) NOT NULL,
  net_amount   NUMERIC(15,3) NOT NULL,
  vat_amount   NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  total_amount NUMERIC(15,3) NOT NULL,
  receipt_url  TEXT,
  notes        TEXT,
  created_by   UUID    REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, expense_no)
);

-- ============================================================
-- RECURRING EXPENSE TEMPLATES
-- ============================================================
CREATE TYPE recur_frequency AS ENUM ('weekly','monthly','quarterly','yearly');

CREATE TABLE recurring_expense_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID    NOT NULL REFERENCES companies(id),
  category_id     UUID    REFERENCES categories(id),
  supplier_id     UUID    REFERENCES customers(id),
  description     VARCHAR(300) NOT NULL,
  net_amount      NUMERIC(15,3) NOT NULL,
  vat_amount      NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  total_amount    NUMERIC(15,3) NOT NULL,
  frequency       recur_frequency NOT NULL DEFAULT 'monthly',
  day_of_month    SMALLINT DEFAULT 1,          -- 1-28, used for monthly/quarterly/yearly
  next_due_date   DATE    NOT NULL,
  end_date        DATE,                        -- NULL = runs forever
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated  DATE,
  notes           TEXT,
  created_by      UUID    REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recur_exp_company ON recurring_expense_templates(company_id, is_active, next_due_date);

-- ============================================================
-- BANK ACCOUNTS & RECONCILIATION
-- ============================================================
CREATE TABLE bank_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID    NOT NULL REFERENCES companies(id),
  bank_name        VARCHAR(100) NOT NULL,
  account_name     VARCHAR(200) NOT NULL,
  account_number   VARCHAR(50),
  iban             VARCHAR(50),
  currency         VARCHAR(5)    NOT NULL DEFAULT 'BHD',
  current_balance  NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE bank_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id  UUID         NOT NULL REFERENCES bank_accounts(id),
  transaction_date DATE         NOT NULL,
  description      VARCHAR(300) NOT NULL,
  debit            NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  credit           NUMERIC(15,3) NOT NULL DEFAULT 0.000,
  balance          NUMERIC(15,3),
  ref_type         doc_type,
  ref_id           UUID,
  ref_no           VARCHAR(50),
  match_status     match_status NOT NULL DEFAULT 'unmatched',
  imported_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_bt_account ON bank_transactions(bank_account_id, transaction_date DESC);
CREATE INDEX idx_bt_match   ON bank_transactions(bank_account_id, match_status);

-- ============================================================
-- CHEQUE REGISTER
-- ============================================================
CREATE TYPE cheque_direction AS ENUM ('issued', 'received');
CREATE TYPE cheque_status    AS ENUM ('pending', 'cleared', 'bounced', 'cancelled');

CREATE TABLE cheques (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID             NOT NULL REFERENCES companies(id),
  cheque_no    VARCHAR(50)      NOT NULL,
  bank_name    VARCHAR(100),
  direction    cheque_direction NOT NULL,
  party_id     UUID             REFERENCES customers(id),
  party_name   VARCHAR(200),
  amount       NUMERIC(15,3)   NOT NULL,
  cheque_date  DATE             NOT NULL,
  issue_date   DATE             NOT NULL DEFAULT CURRENT_DATE,
  status       cheque_status    NOT NULL DEFAULT 'pending',
  purchase_id  UUID             REFERENCES purchases(id),
  invoice_id   UUID             REFERENCES invoices(id),
  notes        TEXT,
  created_by   UUID             REFERENCES users(id),
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX idx_cheques_co_date ON cheques(company_id, cheque_date);
CREATE INDEX idx_cheques_status  ON cheques(company_id, direction, status);

-- ============================================================
-- HR — EMPLOYEES & PAYROLL
-- ============================================================
CREATE TYPE emp_status      AS ENUM ('active','on_leave','terminated');
CREATE TYPE payroll_status  AS ENUM ('draft','approved','paid');

CREATE TABLE employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID            NOT NULL REFERENCES companies(id),
  emp_no            VARCHAR(20)     NOT NULL,
  full_name         VARCHAR(200)    NOT NULL,
  nationality       VARCHAR(60),
  id_number         VARCHAR(50),     -- CPR / national ID
  position          VARCHAR(100),
  department        VARCHAR(100),
  join_date         DATE,
  status            emp_status      NOT NULL DEFAULT 'active',
  -- Salary components (monthly, BHD)
  basic_salary      NUMERIC(12,3)   NOT NULL DEFAULT 0,
  housing_allow     NUMERIC(12,3)   NOT NULL DEFAULT 0,
  transport_allow   NUMERIC(12,3)   NOT NULL DEFAULT 0,
  other_allow       NUMERIC(12,3)   NOT NULL DEFAULT 0,
  -- GOSI / SIO settings
  is_bahraini           BOOLEAN         NOT NULL DEFAULT false,  -- true=Bahraini (7%/12%), false=Expat (1%/3%)
  gosi_eligible         BOOLEAN         NOT NULL DEFAULT true,
  employer_covers_gosi  BOOLEAN         NOT NULL DEFAULT false, -- employer absorbs employee 1% (expat only)
  annual_leave_days     INTEGER         NOT NULL DEFAULT 30,    -- annual entitlement in calendar days
  -- Bank / payment
  bank_name         VARCHAR(100),
  bank_iban         VARCHAR(50),
  notes             TEXT,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE(company_id, emp_no)
);
CREATE INDEX idx_emp_co ON employees(company_id, status);

CREATE TABLE payroll_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID            NOT NULL REFERENCES companies(id),
  run_month     INTEGER         NOT NULL CHECK (run_month BETWEEN 1 AND 12),
  run_year      INTEGER         NOT NULL,
  status        payroll_status  NOT NULL DEFAULT 'draft',
  notes         TEXT,
  created_by    UUID            REFERENCES users(id),
  approved_by   UUID            REFERENCES users(id),
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE(company_id, run_year, run_month)
);

CREATE TABLE payslips (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           UUID            NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  company_id       UUID            NOT NULL REFERENCES companies(id),
  employee_id      UUID            NOT NULL REFERENCES employees(id),
  -- Earnings (snapshot at time of run)
  basic_salary     NUMERIC(12,3)   NOT NULL DEFAULT 0,
  housing_allow    NUMERIC(12,3)   NOT NULL DEFAULT 0,
  transport_allow  NUMERIC(12,3)   NOT NULL DEFAULT 0,
  other_allow      NUMERIC(12,3)   NOT NULL DEFAULT 0,
  overtime_pay     NUMERIC(12,3)   NOT NULL DEFAULT 0,
  bonus            NUMERIC(12,3)   NOT NULL DEFAULT 0,
  gross_pay        NUMERIC(12,3)   NOT NULL DEFAULT 0,
  -- Deductions
  gosi_employee    NUMERIC(12,3)   NOT NULL DEFAULT 0,   -- employee share (7% Bahraini / 1% expat, or 0 if employer covers)
  gosi_employer    NUMERIC(12,3)   NOT NULL DEFAULT 0,   -- employer GOSI cost (12% / 3%)
  eosb_rate        NUMERIC(5,2)    NOT NULL DEFAULT 0,   -- 4.2 or 8.4 (expat EOSB %)
  eosb_contribution NUMERIC(12,3)  NOT NULL DEFAULT 0,   -- monthly EOSB employer contribution
  absence_deduct   NUMERIC(12,3)   NOT NULL DEFAULT 0,
  loan_deduct      NUMERIC(12,3)   NOT NULL DEFAULT 0,
  other_deduct     NUMERIC(12,3)   NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12,3)   NOT NULL DEFAULT 0,
  net_pay          NUMERIC(12,3)   NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE(run_id, employee_id)
);
CREATE INDEX idx_payslips_run ON payslips(run_id);
CREATE INDEX idx_payslips_emp ON payslips(employee_id, created_at DESC);

-- ============================================================
-- EMPLOYEE LEAVE RECORDS
-- ============================================================
CREATE TABLE employee_leaves (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID         NOT NULL REFERENCES companies(id),
  employee_id     UUID         NOT NULL REFERENCES employees(id),
  leave_type      VARCHAR(30)  NOT NULL DEFAULT 'annual',
  start_date      DATE         NOT NULL,
  end_date        DATE,
  resume_date     DATE,
  days_requested  NUMERIC(5,1) NOT NULL DEFAULT 0,
  days_taken      NUMERIC(5,1),
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  notes           TEXT,
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_leave_type   CHECK (leave_type IN ('annual','sick','unpaid','emergency','maternity','paternity','other')),
  CONSTRAINT chk_leave_status CHECK (status IN ('active','resumed','cancelled'))
);
CREATE INDEX idx_leaves_emp ON employee_leaves(employee_id, start_date DESC);
CREATE INDEX idx_leaves_co  ON employee_leaves(company_id, status);

-- ============================================================
-- TASKS & TICKETING
-- ============================================================
CREATE TYPE task_status   AS ENUM ('open','in_progress','on_hold','completed','cancelled');
CREATE TYPE task_priority AS ENUM ('low','medium','high','urgent');

CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_no         VARCHAR(20)   NOT NULL,
  title           VARCHAR(300)  NOT NULL,
  description     TEXT,
  category        VARCHAR(100),
  priority        task_priority NOT NULL DEFAULT 'medium',
  status          task_status   NOT NULL DEFAULT 'open',
  assigned_to     UUID          REFERENCES users(id),
  created_by      UUID          REFERENCES users(id),
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  -- Recurring
  is_recurring    BOOLEAN       NOT NULL DEFAULT false,
  recur_freq      VARCHAR(20)   NOT NULL DEFAULT 'none', -- none/daily/weekly/monthly
  recur_interval  SMALLINT      NOT NULL DEFAULT 1,
  recur_end_date  DATE,
  recur_parent_id UUID          REFERENCES tasks(id),
  recur_next_date DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(company_id, task_no)
);
CREATE INDEX idx_tasks_co     ON tasks(company_id, status, due_date);
CREATE INDEX idx_tasks_assign ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_recur  ON tasks(company_id, is_recurring, recur_next_date) WHERE is_recurring = true AND recur_parent_id IS NULL;

CREATE TABLE task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  company_id  UUID         NOT NULL REFERENCES companies(id),
  comment     TEXT         NOT NULL,
  created_by  UUID         REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_comments ON task_comments(task_id, created_at);

-- ============================================================
-- QUOTATION → DN → INVOICE CONVERSION TRACKING
-- ============================================================
CREATE TABLE document_conversions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID     NOT NULL REFERENCES companies(id),
  from_type      doc_type NOT NULL,
  from_id        UUID     NOT NULL,
  from_no        VARCHAR(30),
  to_type        doc_type NOT NULL,
  to_id          UUID     NOT NULL,
  to_no          VARCHAR(30),
  converted_by   UUID     REFERENCES users(id),
  converted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dc_from ON document_conversions(from_type, from_id);
CREATE INDEX idx_dc_to   ON document_conversions(to_type, to_id);

-- ============================================================
-- SEED DATA — Default categories for electrical trading
-- ============================================================
INSERT INTO categories (id, company_id, name, type, sort_order)
SELECT gen_random_uuid(), c.id, cat.name, 'product'::category_type, cat.ord
FROM   companies c,
       (VALUES
         ('Cables & Wires',          1),
         ('Switchgear & MCBs',       2),
         ('Lighting & Fixtures',     3),
         ('Conduits & Fittings',     4),
         ('Sockets & Switches',      5),
         ('Distribution Panels',     6),
         ('Tools & Equipment',       7),
         ('Safety & PPE',            8),
         ('Transformers',            9),
         ('Accessories & Sundries', 10)
       ) AS cat(name, ord);

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Outstanding invoices
CREATE VIEW v_outstanding_invoices AS
SELECT i.*, c.name AS customer_name, c.vat_number AS customer_vat
FROM   invoices i
JOIN   customers c ON c.id = i.customer_id
WHERE  i.payment_status NOT IN ('paid','void');

-- Pending DN (not yet invoiced)
CREATE VIEW v_pending_dns AS
SELECT dn.*, c.name AS customer_name
FROM   delivery_notes dn
JOIN   customers c ON c.id = dn.customer_id
WHERE  dn.status = 'pending_invoice';

-- Low stock
CREATE VIEW v_low_stock AS
SELECT p.*, cat.name AS category_name
FROM   products p
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE  p.is_stock_tracked = true
AND    p.stock_qty <= p.stock_min
AND    p.is_active = true;

-- VAT report (output VAT from invoices)
CREATE VIEW v_vat_output AS
SELECT i.company_id, i.invoice_date, i.invoice_no, i.type,
       c.name AS customer_name, c.vat_number AS customer_vat,
       i.subtotal AS net_amount, i.total_vat AS vat_amount, i.grand_total
FROM   invoices i
JOIN   customers c ON c.id = i.customer_id
WHERE  i.type = 'tax_invoice' AND i.payment_status != 'void';

-- VAT report (input VAT from purchases + expenses)
CREATE VIEW v_vat_input AS
SELECT p.company_id, p.purchase_date AS txn_date, p.purchase_no AS ref_no,
       'purchase'::text AS source,
       s.name AS supplier_name, p.subtotal AS net_amount, p.total_vat AS vat_amount
FROM   purchases p JOIN customers s ON s.id = p.supplier_id
UNION ALL
SELECT e.company_id, e.expense_date, e.expense_no,
       'expense'::text,
       COALESCE(s.name, 'Direct Expense'), e.net_amount, e.vat_amount
FROM   expenses e LEFT JOIN customers s ON s.id = e.supplier_id
WHERE  e.vat_amount > 0;
