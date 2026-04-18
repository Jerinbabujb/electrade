const router = require('express').Router();
const db     = require('../db');
const { v4: uuid } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');

// ── Auto-migration ─────────────────────────────────────────
async function migrate() {
  await db.query(`
    ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS po_order_prefix   VARCHAR(10) NOT NULL DEFAULT 'PO',
      ADD COLUMN IF NOT EXISTS next_po_order_seq INTEGER     NOT NULL DEFAULT 1;

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      po_no           VARCHAR(50) NOT NULL,
      supplier_id     UUID NOT NULL REFERENCES customers(id),
      po_date         DATE NOT NULL DEFAULT CURRENT_DATE,
      expected_date   DATE,
      status          VARCHAR(20) NOT NULL DEFAULT 'draft',
      notes           TEXT,
      internal_notes  TEXT,
      subtotal        NUMERIC(15,3) NOT NULL DEFAULT 0,
      total_vat       NUMERIC(15,3) NOT NULL DEFAULT 0,
      grand_total     NUMERIC(15,3) NOT NULL DEFAULT 0,
      converted_to_purchase_id UUID,
      created_by      UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_po_company ON purchase_orders(company_id);
    CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      po_id       UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      product_id  UUID REFERENCES products(id),
      line_no     INT NOT NULL,
      part_no     VARCHAR(100),
      description TEXT,
      qty         NUMERIC(15,3) NOT NULL DEFAULT 1,
      unit        VARCHAR(20) DEFAULT 'pcs',
      unit_price  NUMERIC(15,3) NOT NULL DEFAULT 0,
      vat_rate    NUMERIC(5,2) DEFAULT 10
    );
  `);
}
migrate().catch(e => console.error('[purchaseOrders] migration error:', e.message));

router.use(authenticate);

// ── List ───────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { q, status, supplier_id } = req.query;
    const params = [req.user.company_id];
    const where = ['po.company_id = $1'];
    if (status)      { params.push(status);      where.push(`po.status = $${params.length}`); }
    if (supplier_id) { params.push(supplier_id); where.push(`po.supplier_id = $${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(po.po_no ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }
    const { rows } = await db.query(
      `SELECT po.*, c.name AS supplier_name
       FROM purchase_orders po
       JOIN customers c ON c.id = po.supplier_id
       WHERE ${where.join(' AND ')}
       ORDER BY po.po_date DESC, po.po_no DESC
       LIMIT 200`, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ── Get one ────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [po] } = await db.query(
      `SELECT po.*, c.name AS supplier_name, c.address AS supplier_address,
              c.tel AS supplier_tel, c.email AS supplier_email, c.vat_number AS supplier_vat
       FROM purchase_orders po
       JOIN customers c ON c.id = po.supplier_id
       WHERE po.id = $1 AND po.company_id = $2`, [req.params.id, req.user.company_id]);
    if (!po) return res.status(404).json({ error: { message: 'PO not found' } });
    const { rows: items } = await db.query(
      `SELECT * FROM purchase_order_items WHERE po_id = $1 ORDER BY line_no`, [req.params.id]);
    res.json({ data: { ...po, items } });
  } catch (err) { next(err); }
});

// ── Create ─────────────────────────────────────────────────
router.post('/', authorize('admin','sales'), async (req, res, next) => {
  try {
    const { supplier_id, po_date, expected_date, notes, internal_notes, items = [] } = req.body;
    if (!supplier_id) return res.status(400).json({ error: { message: 'Supplier is required' } });

    const result = await db.withTransaction(async (client) => {
      const { rows: [co] } = await client.query(
        `UPDATE companies SET next_po_order_seq = next_po_order_seq + 1
         WHERE id = $1 RETURNING po_order_prefix, next_po_order_seq - 1 AS seq`, [req.user.company_id]);
      const po_no = `${co.po_order_prefix}-${new Date().getFullYear()}-${String(co.seq).padStart(4,'0')}`;

      const subtotal   = items.reduce((s, i) => s + Number(i.qty||0) * Number(i.unit_price||0), 0);
      const total_vat  = items.reduce((s, i) => s + Number(i.qty||0) * Number(i.unit_price||0) * Number(i.vat_rate||10) / 100, 0);
      const grand_total = subtotal + total_vat;

      const { rows: [po] } = await client.query(
        `INSERT INTO purchase_orders
           (id, company_id, po_no, supplier_id, po_date, expected_date, notes, internal_notes,
            subtotal, total_vat, grand_total, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [uuid(), req.user.company_id, po_no, supplier_id,
         po_date || new Date(), expected_date || null, notes, internal_notes,
         subtotal.toFixed(3), total_vat.toFixed(3), grand_total.toFixed(3), req.user.id]);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO purchase_order_items
             (id, po_id, product_id, line_no, part_no, description, qty, unit, unit_price, vat_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [uuid(), po.id, it.product_id||null, i+1, it.part_no, it.description,
           Number(it.qty||0), it.unit||'pcs', Number(it.unit_price||0), Number(it.vat_rate||10)]);
      }
      return po;
    });
    res.status(201).json({ data: result, message: `Purchase Order ${result.po_no} created` });
  } catch (err) { next(err); }
});

// ── Update ─────────────────────────────────────────────────
router.put('/:id', authorize('admin','sales'), async (req, res, next) => {
  try {
    const { supplier_id, po_date, expected_date, notes, internal_notes, items = [] } = req.body;

    const result = await db.withTransaction(async (client) => {
      const subtotal   = items.reduce((s, i) => s + Number(i.qty||0) * Number(i.unit_price||0), 0);
      const total_vat  = items.reduce((s, i) => s + Number(i.qty||0) * Number(i.unit_price||0) * Number(i.vat_rate||10) / 100, 0);
      const grand_total = subtotal + total_vat;

      const { rows: [po] } = await client.query(
        `UPDATE purchase_orders SET
           supplier_id=$1, po_date=COALESCE($2::date, po_date), expected_date=$3,
           notes=$4, internal_notes=$5,
           subtotal=$6, total_vat=$7, grand_total=$8, updated_at=now()
         WHERE id=$9 AND company_id=$10 AND status IN ('draft','sent') RETURNING *`,
        [supplier_id, po_date||null, expected_date||null, notes, internal_notes,
         subtotal.toFixed(3), total_vat.toFixed(3), grand_total.toFixed(3),
         req.params.id, req.user.company_id]);
      if (!po) throw Object.assign(new Error('PO not found or not editable'), { status: 404 });

      await client.query(`DELETE FROM purchase_order_items WHERE po_id = $1`, [req.params.id]);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO purchase_order_items
             (id, po_id, product_id, line_no, part_no, description, qty, unit, unit_price, vat_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [uuid(), po.id, it.product_id||null, i+1, it.part_no, it.description,
           Number(it.qty||0), it.unit||'pcs', Number(it.unit_price||0), Number(it.vat_rate||10)]);
      }
      return po;
    });
    res.json({ data: result });
  } catch (err) { next(err); }
});

// ── Update status (send / receive / cancel) ────────────────
router.patch('/:id/status', authorize('admin','sales'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['draft','sent','partially_received','received','cancelled'];
    if (!allowed.includes(status))
      return res.status(400).json({ error: { message: `Invalid status: ${status}` } });

    const { rows: [po] } = await db.query(
      `UPDATE purchase_orders SET status=$1, updated_at=now()
       WHERE id=$2 AND company_id=$3 RETURNING *`,
      [status, req.params.id, req.user.company_id]);
    if (!po) return res.status(404).json({ error: { message: 'PO not found' } });
    res.json({ data: po, message: `PO ${po.po_no} marked as ${status}` });
  } catch (err) { next(err); }
});

// ── Convert PO → Purchase Invoice ─────────────────────────
router.post('/:id/to-invoice', authorize('admin','sales'), async (req, res, next) => {
  try {
    const { rows: [po] } = await db.query(
      `SELECT po.*, c.name AS supplier_name
       FROM purchase_orders po JOIN customers c ON c.id = po.supplier_id
       WHERE po.id = $1 AND po.company_id = $2`, [req.params.id, req.user.company_id]);
    if (!po) return res.status(404).json({ error: { message: 'PO not found' } });
    if (po.converted_to_purchase_id)
      return res.status(409).json({ error: { message: 'This PO has already been converted to a purchase invoice' } });

    const { rows: items } = await db.query(
      `SELECT * FROM purchase_order_items WHERE po_id = $1 ORDER BY line_no`, [req.params.id]);

    const result = await db.withTransaction(async (client) => {
      // Generate purchase number
      const { rows: [co] } = await client.query(
        `UPDATE companies SET next_pur_seq = next_pur_seq + 1
         WHERE id = $1 RETURNING po_prefix, next_pur_seq - 1 AS seq`, [req.user.company_id]);
      const purchase_no = `${co.po_prefix}-${new Date().getFullYear()}-${String(co.seq).padStart(4,'0')}`;

      const subtotal   = items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
      const total_vat  = items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price) * Number(i.vat_rate) / 100, 0);
      const grand_total = subtotal + total_vat;

      const { rows: [pur] } = await client.query(
        `INSERT INTO purchases
           (id, company_id, purchase_no, supplier_id, purchase_date, supplier_invoice_no,
            subtotal, total_vat, grand_total, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [uuid(), req.user.company_id, purchase_no, po.supplier_id,
         req.body.purchase_date || new Date(), po.po_no,
         subtotal.toFixed(3), total_vat.toFixed(3), grand_total.toFixed(3),
         po.notes, req.user.id]);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO purchase_items
             (id, purchase_id, product_id, line_no, part_no, description, qty, unit, unit_price, vat_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [uuid(), pur.id, it.product_id||null, i+1, it.part_no, it.description,
           it.qty, it.unit, it.unit_price, it.vat_rate]);
      }

      // Stamp the PO as converted
      await client.query(
        `UPDATE purchase_orders SET converted_to_purchase_id=$1, status='received', updated_at=now()
         WHERE id=$2`, [pur.id, req.params.id]);

      return pur;
    });
    res.status(201).json({ data: result, message: `Purchase Invoice ${result.purchase_no} created from ${po.po_no}` });
  } catch (err) { next(err); }
});

// ── Delete (draft only) ────────────────────────────────────
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const { rows: [po] } = await db.query(
      `DELETE FROM purchase_orders WHERE id=$1 AND company_id=$2 AND status='draft' RETURNING po_no`,
      [req.params.id, req.user.company_id]);
    if (!po) return res.status(404).json({ error: { message: 'PO not found or not deletable (must be draft)' } });
    res.json({ message: `Purchase Order ${po.po_no} deleted` });
  } catch (err) { next(err); }
});

module.exports = router;
