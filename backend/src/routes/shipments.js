/**
 * Landed Cost / Shipments routes
 *
 * Cost model:
 *   ① Product cost      — in product_currency (e.g. USD, CNY), converted via product_xrate
 *   ② Freight           — prepaid (foreign currency) or collect (BHD), own xrate
 *   ③ Insurance         — in insurance_currency (usually USD), own xrate
 *   ④ Local charges     — all in BHD:
 *        customs_duty | import_vat | clearing_fee | local_transport
 *        apmt_charges | demurrage  | delivery_order | other_local
 *
 * Payment tracking:
 *   shipment_payments — advance / balance / full payments with bank charges
 */
const router = require('express').Router();
const db     = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { v4: uuid } = require('uuid');

router.use(authenticate);
router.use(authorize('admin', 'storekeeper', 'accountant'));

// ── Idempotent migration ──────────────────────────────────────
async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS shipments (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      shipment_no      VARCHAR(30) NOT NULL,
      description      VARCHAR(300),
      supplier         VARCHAR(200),
      origin_country   VARCHAR(100),
      shipment_date    DATE,
      arrival_date     DATE,
      status           VARCHAR(20) NOT NULL DEFAULT 'draft',
      product_currency  VARCHAR(10)   NOT NULL DEFAULT 'USD',
      product_xrate     NUMERIC(12,6) NOT NULL DEFAULT 1,
      freight_amount    NUMERIC(14,3) NOT NULL DEFAULT 0,
      freight_prepaid   BOOLEAN       NOT NULL DEFAULT true,
      freight_currency  VARCHAR(10)   NOT NULL DEFAULT 'USD',
      freight_xrate     NUMERIC(12,6) NOT NULL DEFAULT 1,
      insurance         NUMERIC(14,3) NOT NULL DEFAULT 0,
      insurance_currency VARCHAR(10)  NOT NULL DEFAULT 'USD',
      insurance_xrate   NUMERIC(12,6) NOT NULL DEFAULT 1,
      customs_duty      NUMERIC(14,3) NOT NULL DEFAULT 0,
      import_vat        NUMERIC(14,3) NOT NULL DEFAULT 0,
      clearing_fee      NUMERIC(14,3) NOT NULL DEFAULT 0,
      local_transport   NUMERIC(14,3) NOT NULL DEFAULT 0,
      apmt_charges      NUMERIC(14,3) NOT NULL DEFAULT 0,
      demurrage         NUMERIC(14,3) NOT NULL DEFAULT 0,
      delivery_order    NUMERIC(14,3) NOT NULL DEFAULT 0,
      other_local       NUMERIC(14,3) NOT NULL DEFAULT 0,
      allocation_method VARCHAR(10) NOT NULL DEFAULT 'value',
      notes             TEXT,
      created_by        UUID REFERENCES users(id),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(company_id, shipment_no)
    );

    CREATE TABLE IF NOT EXISTS shipment_items (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id         UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      company_id          UUID NOT NULL REFERENCES companies(id),
      product_id          UUID REFERENCES products(id),
      sku                 VARCHAR(100),
      product_name        VARCHAR(300),
      qty                 NUMERIC(14,3) NOT NULL DEFAULT 0,
      unit_cost           NUMERIC(14,5) NOT NULL DEFAULT 0,
      weight_kg           NUMERIC(10,3),
      alloc_freight       NUMERIC(14,6) DEFAULT 0,
      alloc_insurance     NUMERIC(14,6) DEFAULT 0,
      alloc_customs       NUMERIC(14,6) DEFAULT 0,
      alloc_local_other   NUMERIC(14,6) DEFAULT 0,
      unit_product_cost   NUMERIC(14,5) DEFAULT 0,
      unit_landed_cost    NUMERIC(14,5) DEFAULT 0,
      total_landed_cost   NUMERIC(14,3) DEFAULT 0,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS shipment_payments (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id     UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      company_id      UUID NOT NULL REFERENCES companies(id),
      payment_date    DATE NOT NULL,
      payment_type    VARCHAR(20) NOT NULL DEFAULT 'advance',
      -- Amount in the payment currency (usually product_currency or BHD)
      amount          NUMERIC(14,3) NOT NULL,
      currency        VARCHAR(10)   NOT NULL DEFAULT 'USD',
      -- Exchange rate AT TIME OF PAYMENT (may differ from invoice rate)
      exchange_rate   NUMERIC(12,6) NOT NULL DEFAULT 1,
      amount_bhd      NUMERIC(14,3) NOT NULL DEFAULT 0,
      -- Bank charges for the transfer (always BHD)
      bank_charges    NUMERIC(14,3) NOT NULL DEFAULT 0,
      reference_no    VARCHAR(100),
      notes           TEXT,
      created_by      UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
migrate().catch(console.error);

// ── Helpers ───────────────────────────────────────────────────
const pf = (v, fb = 0) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };

async function nextShipmentNo(co) {
  const { rows: [r] } = await db.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(shipment_no,'[^0-9]','','g') AS int)),0)+1 AS n
     FROM shipments WHERE company_id=$1`, [co]);
  return `SHP-${String(r.n).padStart(4, '0')}`;
}

async function recalculate(shipmentId, co) {
  const { rows: [s] } = await db.query(
    `SELECT * FROM shipments WHERE id=$1 AND company_id=$2`, [shipmentId, co]);
  if (!s) return null;
  const { rows: items } = await db.query(
    `SELECT * FROM shipment_items WHERE shipment_id=$1`, [shipmentId]);
  if (!items.length) return s;

  const freightBhd    = pf(s.freight_amount) * (s.freight_prepaid ? pf(s.freight_xrate, 1) : 1);
  const insuranceBhd  = pf(s.insurance)      * pf(s.insurance_xrate, 1);
  const customsBhd    = pf(s.customs_duty)   + pf(s.import_vat);
  const localOtherBhd = pf(s.clearing_fee)  + pf(s.local_transport)
                      + pf(s.apmt_charges)  + pf(s.demurrage)
                      + pf(s.delivery_order)+ pf(s.other_local);
  const prodXrate = pf(s.product_xrate, 1);
  const method    = s.allocation_method;

  const bases = items.map(item => {
    const q = pf(item.qty), uc = pf(item.unit_cost);
    if (method === 'qty')    return q;
    if (method === 'weight') return pf(item.weight_kg);
    return q * uc * prodXrate;
  });
  const totalBase = bases.reduce((s, b) => s + b, 0);

  for (let i = 0; i < items.length; i++) {
    const item  = items[i];
    const qty   = pf(item.qty), uc = pf(item.unit_cost);
    const share = totalBase > 0 ? bases[i] / totalBase : 0;
    const perUnit = c => totalBase > 0 ? (c * share) / Math.max(qty, 1) : 0;
    const af  = perUnit(freightBhd);
    const ai  = perUnit(insuranceBhd);
    const ac  = perUnit(customsBhd);
    const alo = perUnit(localOtherBhd);
    const unit_product_cost = uc * prodXrate;
    const unit_landed_cost  = unit_product_cost + af + ai + ac + alo;
    await db.query(
      `UPDATE shipment_items SET
         alloc_freight=$1, alloc_insurance=$2, alloc_customs=$3, alloc_local_other=$4,
         unit_product_cost=$5, unit_landed_cost=$6, total_landed_cost=$7
       WHERE id=$8`,
      [af, ai, ac, alo,
       unit_product_cost.toFixed(5), unit_landed_cost.toFixed(5),
       (unit_landed_cost * qty).toFixed(3), item.id]);
  }
  await db.query(`UPDATE shipments SET status='calculated', updated_at=now() WHERE id=$1`, [shipmentId]);
  return true;
}

// ── SHIPMENT CRUD ─────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const { rows } = await db.query(
      `SELECT s.*,
         (SELECT COUNT(*)                           FROM shipment_items    WHERE shipment_id=s.id) AS item_count,
         (SELECT COALESCE(SUM(total_landed_cost),0) FROM shipment_items    WHERE shipment_id=s.id) AS total_landed,
         (SELECT COALESCE(SUM(amount_bhd+bank_charges),0) FROM shipment_payments WHERE shipment_id=s.id) AS total_paid_bhd,
         (SELECT COALESCE(SUM(bank_charges),0)      FROM shipment_payments WHERE shipment_id=s.id) AS total_bank_charges
       FROM shipments s WHERE s.company_id=$1 ORDER BY s.created_at DESC`, [co]);
    res.json({ data: rows });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const f  = req.body;
    const shipment_no = await nextShipmentNo(co);
    const id = uuid();
    await db.query(
      `INSERT INTO shipments
         (id,company_id,shipment_no,description,supplier,origin_country,shipment_date,arrival_date,
          product_currency,product_xrate,
          freight_amount,freight_prepaid,freight_currency,freight_xrate,
          insurance,insurance_currency,insurance_xrate,
          customs_duty,import_vat,clearing_fee,local_transport,
          apmt_charges,demurrage,delivery_order,other_local,
          allocation_method,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
      [id,co,shipment_no,
       f.description||null, f.supplier||null, f.origin_country||null,
       f.shipment_date||null, f.arrival_date||null,
       f.product_currency||'USD', f.product_xrate||1,
       f.freight_amount||0, f.freight_prepaid!==false, f.freight_currency||'USD', f.freight_xrate||1,
       f.insurance||0, f.insurance_currency||'USD', f.insurance_xrate||1,
       f.customs_duty||0, f.import_vat||0, f.clearing_fee||0, f.local_transport||0,
       f.apmt_charges||0, f.demurrage||0, f.delivery_order||0, f.other_local||0,
       f.allocation_method||'value', f.notes||null, req.user.id]);
    const { rows: [row] } = await db.query(`SELECT * FROM shipments WHERE id=$1`, [id]);
    res.status(201).json({ data: row });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const { rows: [s] } = await db.query(
      `SELECT * FROM shipments WHERE id=$1 AND company_id=$2`, [req.params.id, co]);
    if (!s) return res.status(404).json({ error: { message: 'Not found' } });
    const { rows: items } = await db.query(
      `SELECT si.*, p.cost_price AS current_cost
       FROM shipment_items si LEFT JOIN products p ON p.id=si.product_id
       WHERE si.shipment_id=$1 ORDER BY si.created_at`, [req.params.id]);
    const { rows: payments } = await db.query(
      `SELECT * FROM shipment_payments WHERE shipment_id=$1 ORDER BY payment_date, created_at`,
      [req.params.id]);
    res.json({ data: { ...s, items, payments } });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const f  = req.body;
    await db.query(
      `UPDATE shipments SET
         description=$1, supplier=$2, origin_country=$3, shipment_date=$4, arrival_date=$5,
         product_currency=$6, product_xrate=$7,
         freight_amount=$8, freight_prepaid=$9, freight_currency=$10, freight_xrate=$11,
         insurance=$12, insurance_currency=$13, insurance_xrate=$14,
         customs_duty=$15, import_vat=$16, clearing_fee=$17, local_transport=$18,
         apmt_charges=$19, demurrage=$20, delivery_order=$21, other_local=$22,
         allocation_method=$23, notes=$24,
         status = CASE WHEN status='applied' THEN 'applied' ELSE 'draft' END,
         updated_at=now()
       WHERE id=$25 AND company_id=$26`,
      [f.description||null, f.supplier||null, f.origin_country||null,
       f.shipment_date||null, f.arrival_date||null,
       f.product_currency||'USD', f.product_xrate||1,
       f.freight_amount||0, f.freight_prepaid!==false, f.freight_currency||'USD', f.freight_xrate||1,
       f.insurance||0, f.insurance_currency||'USD', f.insurance_xrate||1,
       f.customs_duty||0, f.import_vat||0, f.clearing_fee||0, f.local_transport||0,
       f.apmt_charges||0, f.demurrage||0, f.delivery_order||0, f.other_local||0,
       f.allocation_method||'value', f.notes||null,
       req.params.id, co]);
    const { rows: [row] } = await db.query(`SELECT * FROM shipments WHERE id=$1`, [req.params.id]);
    res.json({ data: row });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const { rows: [s] } = await db.query(
      `SELECT status FROM shipments WHERE id=$1 AND company_id=$2`, [req.params.id, co]);
    if (!s) return res.status(404).json({ error: { message: 'Not found' } });
    if (s.status === 'applied') return res.status(400).json({ error: { message: 'Cannot delete an applied shipment' } });
    await db.query(`DELETE FROM shipments WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

// ── ITEMS ─────────────────────────────────────────────────────

router.post('/:id/items', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const { product_id, sku, product_name, qty, unit_cost, weight_kg } = req.body;
    if (!qty || pf(qty) <= 0) return res.status(400).json({ error: { message: 'qty required' } });
    let rSku = sku, rName = product_name;
    if (product_id) {
      const { rows: [p] } = await db.query(`SELECT sku,name FROM products WHERE id=$1 AND company_id=$2`, [product_id, co]);
      if (p) { rSku = p.sku; rName = p.name; }
    }
    const id = uuid();
    await db.query(
      `INSERT INTO shipment_items (id,shipment_id,company_id,product_id,sku,product_name,qty,unit_cost,weight_kg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, req.params.id, co, product_id||null, rSku||null, rName||null, qty, unit_cost||0, weight_kg||null]);
    await db.query(`UPDATE shipments SET status='draft', updated_at=now() WHERE id=$1`, [req.params.id]);
    const { rows: [item] } = await db.query(`SELECT * FROM shipment_items WHERE id=$1`, [id]);
    res.status(201).json({ data: item });
  } catch (e) { next(e); }
});

router.put('/:id/items/:itemId', async (req, res, next) => {
  try {
    const { qty, unit_cost, weight_kg, product_id, sku, product_name } = req.body;
    await db.query(
      `UPDATE shipment_items SET product_id=$1,sku=$2,product_name=$3,qty=$4,unit_cost=$5,weight_kg=$6
       WHERE id=$7 AND shipment_id=$8`,
      [product_id||null, sku||null, product_name||null, qty, unit_cost??0, weight_kg||null,
       req.params.itemId, req.params.id]);
    await db.query(`UPDATE shipments SET status='draft', updated_at=now() WHERE id=$1`, [req.params.id]);
    const { rows: [item] } = await db.query(`SELECT * FROM shipment_items WHERE id=$1`, [req.params.itemId]);
    res.json({ data: item });
  } catch (e) { next(e); }
});

router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    await db.query(`DELETE FROM shipment_items WHERE id=$1 AND shipment_id=$2`, [req.params.itemId, req.params.id]);
    await db.query(`UPDATE shipments SET status='draft', updated_at=now() WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

// ── PAYMENTS ──────────────────────────────────────────────────

router.post('/:id/payments', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const { payment_date, payment_type, amount, currency, exchange_rate, bank_charges, reference_no, notes } = req.body;
    if (!payment_date || !amount) return res.status(400).json({ error: { message: 'payment_date and amount required' } });
    const xr = pf(exchange_rate, 1);
    const cur = currency || 'USD';
    // If currency is BHD, amount_bhd = amount directly; otherwise convert
    const amount_bhd = cur === 'BHD' ? pf(amount) : pf(amount) * xr;
    const id = uuid();
    await db.query(
      `INSERT INTO shipment_payments
         (id,shipment_id,company_id,payment_date,payment_type,
          amount,currency,exchange_rate,amount_bhd,bank_charges,reference_no,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, req.params.id, co, payment_date, payment_type||'advance',
       amount, cur, xr, amount_bhd.toFixed(3), pf(bank_charges)||0,
       reference_no||null, notes||null, req.user.id]);
    const { rows: [row] } = await db.query(`SELECT * FROM shipment_payments WHERE id=$1`, [id]);
    res.status(201).json({ data: row });
  } catch (e) { next(e); }
});

router.delete('/:id/payments/:paymentId', async (req, res, next) => {
  try {
    await db.query(`DELETE FROM shipment_payments WHERE id=$1 AND shipment_id=$2`,
      [req.params.paymentId, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

// ── CALCULATE / APPLY ─────────────────────────────────────────

router.post('/:id/calculate', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    await recalculate(req.params.id, co);
    const { rows: [s] } = await db.query(`SELECT * FROM shipments WHERE id=$1`, [req.params.id]);
    const { rows: items } = await db.query(
      `SELECT si.*, p.cost_price AS current_cost
       FROM shipment_items si LEFT JOIN products p ON p.id=si.product_id
       WHERE si.shipment_id=$1 ORDER BY si.created_at`, [req.params.id]);
    const { rows: payments } = await db.query(
      `SELECT * FROM shipment_payments WHERE shipment_id=$1 ORDER BY payment_date`, [req.params.id]);
    res.json({ data: { ...s, items, payments } });
  } catch (e) { next(e); }
});

router.post('/:id/apply', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const { rows: [s] } = await db.query(
      `SELECT * FROM shipments WHERE id=$1 AND company_id=$2`, [req.params.id, co]);
    if (!s) return res.status(404).json({ error: { message: 'Not found' } });
    if (s.status === 'draft') return res.status(400).json({ error: { message: 'Calculate first before applying' } });
    const { rows: items } = await db.query(
      `SELECT * FROM shipment_items WHERE shipment_id=$1 AND product_id IS NOT NULL`, [req.params.id]);
    let updated = 0;
    for (const item of items) {
      if (pf(item.unit_landed_cost) > 0) {
        await db.query(`UPDATE products SET cost_price=$1, updated_at=now() WHERE id=$2 AND company_id=$3`,
          [item.unit_landed_cost, item.product_id, co]);
        updated++;
      }
    }
    await db.query(`UPDATE shipments SET status='applied', updated_at=now() WHERE id=$1`, [req.params.id]);
    res.json({ message: `Applied — ${updated} product cost prices updated`, data: { updated } });
  } catch (e) { next(e); }
});

module.exports = router;
