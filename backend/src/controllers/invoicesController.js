const db   = require('../db');
const pdfSvc = require('../services/pdfService');
const emailSvc = require('../services/emailService');
const { v4: uuid } = require('uuid');
const audit = require('../utils/auditLog');

// ── VAT-compliant totals calculator (Bahrain NBR Article 27) ─
// Overall/invoice discount apportioned proportionally across lines,
// reducing each line's taxable base before VAT is applied.
function calcTotals(items, invDisc, shipping) {
  invDisc  = Number(invDisc)  || 0;
  shipping = Number(shipping) || 0;

  const lineNets = items.map(i =>
    Number(i.qty) * Number(i.unit_price) - Number(i.discount || 0));
  const netAfterLineDisc = lineNets.reduce((s, n) => s + n, 0);

  let total_vat = 0;
  for (let i = 0; i < items.length; i++) {
    const lineNet       = lineNets[i];
    const discShare     = netAfterLineDisc > 0 ? invDisc * (lineNet / netAfterLineDisc) : 0;
    const lineTaxable   = lineNet - discShare;
    total_vat += lineTaxable * Number(items[i].vat_rate) / 100;
  }

  const subtotal       = netAfterLineDisc;                         // net after line discounts
  const total_discount = items.reduce((s, i) => s + Number(i.discount || 0), 0) + invDisc;
  const grand_total    = netAfterLineDisc - invDisc + total_vat + shipping;

  return { subtotal, total_discount, total_vat, grand_total };
}

// ── Build shared WHERE clause for invoice filters ─────────
function buildInvoiceWhere(query, companyId) {
  const { status, customer_id, type, from, to, due_from, due_to, q } = query;
  const params = [companyId];
  const where  = ['i.company_id = $1'];
  if (status) {
    const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) { params.push(statuses[0]); where.push(`i.payment_status = $${params.length}`); }
    else { params.push(statuses); where.push(`i.payment_status = ANY($${params.length})`); }
  }
  if (type) {
    const types = type.split(',').map(t => t.trim()).filter(Boolean);
    if (types.length === 1) { params.push(types[0]); where.push(`i.type = $${params.length}`); }
    else { params.push(types); where.push(`i.type = ANY($${params.length})`); }
  }
  if (customer_id) { params.push(customer_id); where.push(`i.customer_id = $${params.length}`); }
  if (from)        { params.push(from);        where.push(`i.invoice_date >= $${params.length}`); }
  if (to)          { params.push(to);          where.push(`i.invoice_date <= $${params.length}`); }
  if (due_from)    { params.push(due_from);    where.push(`i.due_date >= $${params.length}`); }
  if (due_to)      { params.push(due_to);      where.push(`i.due_date <= $${params.length}`); }
  if (q)           { params.push(`%${q}%`);    where.push(`(i.invoice_no ILIKE $${params.length} OR c.name ILIKE $${params.length})`); }
  return { params, where };
}

// ── List invoices ──────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || 50),  500);
    const offset = Math.max(parseInt(req.query.offset || 0),   0);
    const { params, where } = buildInvoiceWhere(req.query, req.user.company_id);

    const whereStr = where.join(' AND ');
    const [{ rows }, { rows: [countRow] }] = await Promise.all([
      db.query(`
        SELECT i.*, c.name AS customer_name, c.vat_number AS customer_vat,
               COALESCE(json_agg(dn.dn_no) FILTER (WHERE dn.id IS NOT NULL), '[]') AS linked_dns,
               (SELECT json_agg(json_build_object('to_no', dc.to_no, 'to_type', dc.to_type, 'to_id', dc.to_id))
                FROM document_conversions dc WHERE dc.from_id = i.id AND dc.company_id = i.company_id) AS conversions_out,
               (SELECT json_agg(json_build_object('from_no', dc.from_no, 'from_type', dc.from_type, 'from_id', dc.from_id))
                FROM document_conversions dc WHERE dc.to_id = i.id AND dc.company_id = i.company_id) AS conversions_in
        FROM   invoices i
        JOIN   customers c ON c.id = i.customer_id
        LEFT JOIN delivery_notes dn ON dn.invoice_id = i.id
        WHERE  ${whereStr}
        GROUP BY i.id, c.name, c.vat_number
        ORDER BY i.invoice_date DESC, i.invoice_no DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]),
      db.query(`
        SELECT COUNT(DISTINCT i.id)::int AS total
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        WHERE ${whereStr}`,
        params),
    ]);

    res.json({ data: rows, total: countRow.total });
  } catch (err) { next(err); }
};

// ── Export invoices to CSV ─────────────────────────────────
exports.exportCsv = async (req, res, next) => {
  try {
    const { params, where } = buildInvoiceWhere(req.query, req.user.company_id);
    const { rows } = await db.query(`
      SELECT i.invoice_no, i.type, i.invoice_date, i.due_date,
             c.name AS customer_name, c.vat_number AS customer_vat,
             i.subtotal, i.total_discount, i.total_vat, i.grand_total,
             i.amount_paid, i.balance_due, i.payment_status,
             i.po_reference, i.notes
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      WHERE ${where.join(' AND ')}
      ORDER BY i.invoice_date DESC, i.invoice_no DESC`,
      params);

    const fmt = (v) => (v == null ? '' : String(v));
    const esc = (v) => `"${fmt(v).replace(/"/g, '""')}"`;

    const headers = [
      'Invoice No','Type','Date','Due Date','Customer','Customer VAT',
      'Net BHD','Discount BHD','VAT BHD','Total BHD','Paid BHD','Balance BHD','Status',
      'PO Reference','Notes',
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoices-${new Date().toISOString().slice(0,10)}.csv"`);
    res.write('\uFEFF'); // BOM — Excel opens UTF-8 correctly
    res.write(headers.join(',') + '\r\n');

    for (const r of rows) {
      res.write([
        esc(r.invoice_no), esc(r.type),
        fmt(r.invoice_date ? r.invoice_date.toISOString().slice(0,10) : ''),
        fmt(r.due_date     ? r.due_date.toISOString().slice(0,10)     : ''),
        esc(r.customer_name), esc(r.customer_vat),
        fmt(r.subtotal), fmt(r.total_discount), fmt(r.total_vat),
        fmt(r.grand_total), fmt(r.amount_paid), fmt(r.balance_due),
        fmt(r.payment_status), esc(r.po_reference), esc(r.notes),
      ].join(',') + '\r\n');
    }
    res.end();
  } catch (err) { next(err); }
};

// ── Get single invoice with items + DNs ────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const { rows: [inv] } = await db.query(
      `SELECT i.*, c.name AS customer_name, c.address AS customer_address,
              c.vat_number AS customer_vat, c.cr_number AS customer_cr,
              c.tel AS customer_tel
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.id = $1 AND i.company_id = $2`, [req.params.id, req.user.company_id]);
    if (!inv) return res.status(404).json({ error: { message: 'Invoice not found' } });

    const { rows: items } = await db.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY line_no`, [req.params.id]);
    const { rows: dns } = await db.query(
      `SELECT id, dn_no, dn_date, project_ref FROM delivery_notes WHERE invoice_id = $1`, [req.params.id]);
    const { rows: pays } = await db.query(
      `SELECT * FROM payments WHERE reference_id = $1 ORDER BY payment_date`, [req.params.id]);

    res.json({ data: { ...inv, items, linked_dns: dns, payments: pays } });
  } catch (err) { next(err); }
};

// ── Create invoice ─────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { customer_id, type = 'tax_invoice', invoice_date, due_date,
            po_reference, items = [], shipping = 0, invoice_discount = 0,
            notes, internal_notes, valid_until } = req.body;

    // Quotations and proformas start as 'draft'; everything else starts as 'unpaid'
    const isDraft = ['quotation', 'proforma'].includes(type);

    const result = await db.withTransaction(async (client) => {
      const seqCol    = type === 'quotation' ? 'next_quotation_seq'
                      : type === 'proforma'  ? 'next_proforma_seq'
                      :                        'next_invoice_seq';
      const prefixCol = type === 'quotation' ? 'quotation_prefix'
                      : type === 'proforma'  ? 'proforma_prefix'
                      :                        'invoice_prefix';
      const { rows: [co] } = await client.query(
        `UPDATE companies SET ${seqCol} = ${seqCol} + 1
         WHERE id = $1 RETURNING ${prefixCol} AS prefix, ${seqCol} - 1 AS seq`, [req.user.company_id]);
      const invoice_no = `${co.prefix}-${new Date().getFullYear()}-${String(co.seq).padStart(4,'0')}`;

      const { subtotal, total_discount, total_vat, grand_total } = calcTotals(items, invoice_discount, shipping);

      const { rows: [inv] } = await client.query(
        `INSERT INTO invoices (id, company_id, invoice_no, type, customer_id, invoice_date, due_date,
           po_reference, subtotal, total_discount, total_vat, shipping, grand_total, notes, internal_notes,
           valid_until, payment_status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::invoice_status,$18) RETURNING *`,
        [uuid(), req.user.company_id, invoice_no, type, customer_id, invoice_date || new Date(),
         due_date, po_reference, subtotal.toFixed(3), total_discount.toFixed(3),
         total_vat.toFixed(3), Number(shipping||0).toFixed(3), grand_total.toFixed(3),
         notes, internal_notes, valid_until || null,
         isDraft ? 'draft' : 'unpaid', req.user.id]);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO invoice_items (id, invoice_id, product_id, line_no, part_no, description,
             qty, unit, unit_price, discount, vat_rate, unit_cost)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             COALESCE((SELECT cost_price FROM products WHERE id=$3), 0))`,
          [uuid(), inv.id, it.product_id||null, i+1, it.part_no, it.description,
           it.qty, it.unit, it.unit_price, it.discount||0, it.vat_rate||10]);
      }
      return inv;
    });

    res.status(201).json({ data: result, message: `${type} ${result.invoice_no} created` });
  } catch (err) { next(err); }
};

// ── Consolidate DNs → single invoice ───────────────────────
exports.createFromDNs = async (req, res, next) => {
  try {
    const { dn_ids = [], customer_id, po_reference, invoice_date, due_date, notes } = req.body;
    if (!dn_ids.length) return res.status(400).json({ error: { message: 'Select at least one DN' } });

    const result = await db.withTransaction(async (client) => {
      // Validate all DNs belong to this company + customer and are pending
      const { rows: dns } = await client.query(
        `SELECT dn.*, array_agg(row_to_json(dni)) AS items_json
         FROM delivery_notes dn
         JOIN delivery_note_items dni ON dni.dn_id = dn.id
         WHERE dn.id = ANY($1) AND dn.company_id = $2
           AND dn.customer_id = $3 AND dn.status = 'pending_invoice'
         GROUP BY dn.id`,
        [dn_ids, req.user.company_id, customer_id]);

      if (dns.length !== dn_ids.length) {
        throw Object.assign(new Error('One or more DNs are invalid, already invoiced, or belong to a different customer'), { status: 400 });
      }

      // Build consolidated item list from all DN items
      const allItems = dns.flatMap(dn => dn.items_json.map(item => ({
        product_id:  item.product_id,
        part_no:     item.part_no,
        description: `[${dn.dn_no}] ${item.description || ''}`,
        qty:         item.qty_delivered,
        unit:        item.unit,
        unit_price:  item.unit_price,
        discount:    0,
        vat_rate:    10,
      })));

      // Generate invoice number
      const { rows: [co] } = await client.query(
        `UPDATE companies SET next_invoice_seq = next_invoice_seq + 1
         WHERE id = $1 RETURNING invoice_prefix, next_invoice_seq - 1 AS seq`, [req.user.company_id]);
      const invoice_no = `${co.invoice_prefix}-${new Date().getFullYear()}-${String(co.seq).padStart(4,'0')}`;

      const subtotal    = allItems.reduce((s, i) => s + i.qty * i.unit_price, 0);
      const total_vat   = allItems.reduce((s, i) => s + i.qty * i.unit_price * i.vat_rate / 100, 0);
      const grand_total = subtotal + total_vat;

      const { rows: [inv] } = await client.query(
        `INSERT INTO invoices (id, company_id, invoice_no, type, customer_id, invoice_date, due_date,
           po_reference, subtotal, total_discount, total_vat, shipping, grand_total, notes, created_by)
         VALUES ($1,$2,$3,'tax_invoice',$4,$5,$6,$7,$8,0,$9,0,$10,$11,$12) RETURNING *`,
        [uuid(), req.user.company_id, invoice_no, customer_id,
         invoice_date || new Date(), due_date, po_reference,
         subtotal.toFixed(3), total_vat.toFixed(3), grand_total.toFixed(3),
         notes, req.user.id]);

      for (let i = 0; i < allItems.length; i++) {
        const it = allItems[i];
        await client.query(
          `INSERT INTO invoice_items (id, invoice_id, product_id, line_no, part_no, description, qty, unit, unit_price, discount, vat_rate, unit_cost)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             COALESCE((SELECT cost_price FROM products WHERE id=$3), 0))`,
          [uuid(), inv.id, it.product_id||null, i+1, it.part_no, it.description,
           it.qty, it.unit, it.unit_price, 0, it.vat_rate]);
      }

      // Link all DNs to this invoice + mark as invoiced
      await client.query(
        `UPDATE delivery_notes SET invoice_id = $1, status = 'invoiced' WHERE id = ANY($2)`,
        [inv.id, dn_ids]);

      // Record conversions
      for (const dn of dns) {
        await client.query(
          `INSERT INTO document_conversions (id, company_id, from_type, from_id, from_no, to_type, to_id, to_no, converted_by)
           VALUES ($1,$2,'delivery_note',$3,$4,'invoice',$5,$6,$7)`,
          [uuid(), req.user.company_id, dn.id, dn.dn_no, inv.id, inv.invoice_no, req.user.id]);
      }

      return { invoice: inv, dn_count: dns.length, dn_numbers: dns.map(d => d.dn_no) };
    });

    res.status(201).json({ data: result, message: `Invoice ${result.invoice.invoice_no} created from ${result.dn_count} delivery notes` });
  } catch (err) { next(err); }
};

// ── Write off invoice ──────────────────────────────────────
exports.writeOff = async (req, res, next) => {
  try {
    const { reason, notes, amount } = req.body;
    if (!reason) return res.status(400).json({ error: { message: 'Write-off reason is required' } });

    const result = await db.withTransaction(async (client) => {
      const { rows: [inv] } = await client.query(
        `SELECT id, invoice_no, grand_total, amount_paid, balance_due, payment_status, type, write_off_date
         FROM invoices WHERE id = $1 AND company_id = $2`,
        [req.params.id, req.user.company_id]);
      if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
      if (inv.type !== 'tax_invoice')
        throw Object.assign(new Error('Only tax invoices can be written off'), { status: 400 });
      if (['void'].includes(inv.payment_status))
        throw Object.assign(new Error('Cannot write off a voided invoice'), { status: 400 });
      if (inv.write_off_date)
        throw Object.assign(new Error('Invoice has already been written off'), { status: 400 });

      const writeOffAmount = amount ? parseFloat(amount) : parseFloat(inv.balance_due);
      if (writeOffAmount <= 0)
        throw Object.assign(new Error('Write-off amount must be greater than zero'), { status: 400 });

      // Insert a payment record with method='write_off' — this triggers status recalculation
      await client.query(
        `INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
         VALUES ($1,$2,'invoice',$3,CURRENT_DATE,$4,'write_off',$5,$6)`,
        [uuid(), req.user.company_id, req.params.id, writeOffAmount.toFixed(3),
         notes || reason, req.user.id]);

      // Record write-off audit trail on the invoice
      const { rows: [updated] } = await client.query(
        `UPDATE invoices SET
           write_off_amount = $1, write_off_date = now(),
           write_off_by = $2, write_off_reason = $3, updated_at = now()
         WHERE id = $4 RETURNING invoice_no`,
        [writeOffAmount.toFixed(3), req.user.id, reason, req.params.id]);

      return { invoice_no: updated.invoice_no, write_off_amount: writeOffAmount };
    });

    res.json({ message: `${result.invoice_no} written off (BHD ${result.write_off_amount.toFixed(3)})` });
  } catch (err) { next(err); }
};

// ── Reverse write-off ──────────────────────────────────────
exports.reverseWriteOff = async (req, res, next) => {
  try {
    const result = await db.withTransaction(async (client) => {
      const { rows: [inv] } = await client.query(
        `SELECT id, invoice_no, write_off_date FROM invoices
         WHERE id = $1 AND company_id = $2`,
        [req.params.id, req.user.company_id]);
      if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
      if (!inv.write_off_date) throw Object.assign(new Error('Invoice has no write-off to reverse'), { status: 400 });

      // Delete the write-off payment — trigger will recalculate status
      await client.query(
        `DELETE FROM payments WHERE reference_id = $1 AND method = 'write_off'`,
        [req.params.id]);

      // Clear write-off columns
      await client.query(
        `UPDATE invoices SET write_off_amount=NULL, write_off_date=NULL,
           write_off_by=NULL, write_off_reason=NULL, updated_at=now()
         WHERE id = $1`,
        [req.params.id]);

      // Trigger doesn't fire on DELETE — manually recalc status
      await client.query(
        `UPDATE invoices SET
           amount_paid    = (SELECT COALESCE(SUM(amount),0) FROM payments WHERE reference_id = $1),
           payment_status = CASE
             WHEN (grand_total - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE reference_id = $1)) <= 0
               THEN 'paid'::invoice_status
             WHEN (SELECT COALESCE(SUM(amount),0) FROM payments WHERE reference_id = $1) > 0
               THEN 'partial'::invoice_status
             WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE
               THEN 'overdue'::invoice_status
             ELSE 'unpaid'::invoice_status
           END,
           updated_at = now()
         WHERE id = $1`,
        [req.params.id]);

      return inv.invoice_no;
    });

    res.json({ message: `Write-off on ${result} has been reversed` });
  } catch (err) { next(err); }
};

// ── Void invoice ───────────────────────────────────────────
exports.void = async (req, res, next) => {
  try {
    const { rows: [inv] } = await db.query(
      `UPDATE invoices SET payment_status = 'void', updated_at = now()
       WHERE id = $1 AND company_id = $2 RETURNING invoice_no`, [req.params.id, req.user.company_id]);
    if (!inv) return res.status(404).json({ error: { message: 'Invoice not found' } });
    await audit.log(db, req, 'invoice.void', 'invoice', req.params.id, inv.invoice_no);
    res.json({ message: `Invoice ${inv.invoice_no} voided` });
  } catch (err) { next(err); }
};

// ── Issue draft quotation/proforma → unpaid ────────────────
exports.issue = async (req, res, next) => {
  try {
    const { rows: [inv] } = await db.query(
      `SELECT id, type, payment_status, invoice_no FROM invoices
       WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.company_id]);
    if (!inv) return res.status(404).json({ error: { message: 'Document not found' } });
    if (!['quotation','proforma'].includes(inv.type))
      return res.status(400).json({ error: { message: 'Only quotations and proformas can be issued' } });
    if (inv.payment_status !== 'draft')
      return res.status(400).json({ error: { message: `Document is already ${inv.payment_status}` } });

    const { rows: [updated] } = await db.query(
      `UPDATE invoices SET payment_status = 'unpaid', updated_at = now()
       WHERE id = $1 AND company_id = $2 RETURNING *`,
      [req.params.id, req.user.company_id]);
    res.json({ data: updated, message: `${inv.invoice_no} issued successfully` });
  } catch (err) { next(err); }
};

// ── Update invoice ─────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const { po_reference, due_date, notes, internal_notes,
            items = [], shipping = 0, invoice_discount = 0, valid_until } = req.body;

    const result = await db.withTransaction(async (client) => {
      // Recalculate totals from updated items
      const { subtotal, total_discount, total_vat, grand_total } = calcTotals(items, invoice_discount, shipping);

      const { rows: [inv] } = await client.query(
        `UPDATE invoices SET po_reference=$1, due_date=$2, notes=$3, internal_notes=$4,
           subtotal=$5, total_discount=$6, total_vat=$7, shipping=$8, grand_total=$9,
           valid_until=$10, updated_at=now()
         WHERE id=$11 AND company_id=$12 AND payment_status NOT IN ('paid','void') RETURNING *`,
        [po_reference, due_date, notes, internal_notes,
         subtotal.toFixed(3), total_discount.toFixed(3), total_vat.toFixed(3),
         Number(shipping).toFixed(3), grand_total.toFixed(3),
         valid_until || null,
         req.params.id, req.user.company_id]);
      if (!inv) throw Object.assign(new Error('Invoice not found or not editable'), { status: 404 });

      // Replace line items
      await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [req.params.id]);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO invoice_items (id, invoice_id, product_id, line_no, part_no, description,
             qty, unit, unit_price, discount, vat_rate, unit_cost)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             COALESCE((SELECT cost_price FROM products WHERE id=$3), 0))`,
          [uuid(), req.params.id, it.product_id||null, i+1, it.part_no, it.description,
           Number(it.qty), it.unit, Number(it.unit_price), Number(it.discount||0), Number(it.vat_rate||10)]);
      }
      return inv;
    });

    res.json({ data: result });
  } catch (err) { next(err); }
};

// ── Add payment ────────────────────────────────────────────
exports.addPayment = async (req, res, next) => {
  try {
    // Verify invoice belongs to this company before recording payment
    const { rows: [inv] } = await db.query(
      `SELECT id FROM invoices WHERE id = $1 AND company_id = $2`,
      [req.params.id, req.user.company_id]);
    if (!inv) return res.status(404).json({ error: { message: 'Invoice not found' } });

    const { amount, method, payment_date, reference_no, reference, notes } = req.body;
    const ref = reference_no || reference || null;
    const { rows: [pay] } = await db.query(
      `INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, reference_no, notes, created_by)
       VALUES ($1,$2,'invoice',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [uuid(), req.user.company_id, req.params.id, payment_date || new Date(),
       amount, method || 'bank_transfer', ref, notes, req.user.id]);
    await audit.log(db, req, 'invoice.payment_added', 'invoice', req.params.id, null,
      null, { amount, method: method || 'bank_transfer', payment_date });
    res.status(201).json({ data: pay, message: 'Payment recorded' });
  } catch (err) { next(err); }
};

exports.getPayments = async (req, res, next) => {
  try {
    // Join through invoices to enforce company_id scoping
    const { rows } = await db.query(
      `SELECT p.* FROM payments p
       JOIN invoices i ON i.id = p.reference_id
       WHERE p.reference_id = $1 AND i.company_id = $2
       ORDER BY p.payment_date DESC`,
      [req.params.id, req.user.company_id]);
    res.json({ data: rows });
  } catch (err) { next(err); }
};

// ── Update payment ──────────────────────────────────────────
exports.updatePayment = async (req, res, next) => {
  try {
    // Verify invoice + payment belong to this company
    const { rows: [existing] } = await db.query(
      `SELECT p.* FROM payments p
       JOIN invoices i ON i.id = p.reference_id
       WHERE p.id = $1 AND p.reference_id = $2 AND i.company_id = $3`,
      [req.params.paymentId, req.params.id, req.user.company_id]);
    if (!existing) return res.status(404).json({ error: { message: 'Payment not found' } });

    const { amount, method, payment_date, reference_no, reference, notes } = req.body;
    const ref = reference_no || reference || existing.reference_no;
    const { rows: [pay] } = await db.query(
      `UPDATE payments
       SET amount=$1, method=$2, payment_date=$3, reference_no=$4, notes=$5
       WHERE id=$6 RETURNING *`,
      [amount ?? existing.amount,
       method || existing.method,
       payment_date || existing.payment_date,
       ref,
       notes ?? existing.notes,
       req.params.paymentId]);
    await audit.log(db, req, 'invoice.payment_updated', 'invoice', req.params.id,
      null, null, { amount: pay.amount, method: pay.method, payment_date: pay.payment_date });
    res.json({ data: pay, message: 'Payment updated' });
  } catch (err) { next(err); }
};

// ── Delete payment ──────────────────────────────────────────
exports.deletePayment = async (req, res, next) => {
  try {
    // Verify invoice + payment belong to this company
    const { rows: [existing] } = await db.query(
      `SELECT p.* FROM payments p
       JOIN invoices i ON i.id = p.reference_id
       WHERE p.id = $1 AND p.reference_id = $2 AND i.company_id = $3`,
      [req.params.paymentId, req.params.id, req.user.company_id]);
    if (!existing) return res.status(404).json({ error: { message: 'Payment not found' } });

    await db.query(`DELETE FROM payments WHERE id = $1`, [req.params.paymentId]);
    await audit.log(db, req, 'invoice.payment_deleted', 'invoice', req.params.id,
      null, null, { amount: existing.amount, payment_date: existing.payment_date });
    res.json({ message: 'Payment deleted' });
  } catch (err) { next(err); }
};

// ── Bulk payment — one payment per invoice in a single transaction ──
exports.bulkPayment = async (req, res, next) => {
  try {
    const { payments, payment_date, method, reference_no, notes } = req.body;
    if (!Array.isArray(payments) || payments.length === 0)
      return res.status(400).json({ error: { message: 'payments array required' } });

    // Verify all submitted invoice_ids belong to this company
    const invoiceIds = [...new Set(payments.map(p => p.invoice_id).filter(Boolean))];
    const { rows: owned } = await db.query(
      `SELECT id FROM invoices WHERE id = ANY($1::uuid[]) AND company_id = $2`,
      [invoiceIds, req.user.company_id]);
    const ownedSet = new Set(owned.map(r => r.id));

    const inserted = await db.withTransaction(async (client) => {
      const rows = [];
      for (const p of payments) {
        const amt = parseFloat(p.amount);
        if (!p.invoice_id || !amt || amt <= 0) continue;
        if (!ownedSet.has(p.invoice_id)) continue;  // skip invoices from other companies
        const { rows: [pay] } = await client.query(
          `INSERT INTO payments
             (id, company_id, reference_type, reference_id, payment_date, amount, method, reference_no, notes, created_by)
           VALUES ($1,$2,'invoice',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [uuid(), req.user.company_id, p.invoice_id,
           payment_date || new Date(), amt,
           method || 'bank_transfer', reference_no || null, notes || null,
           req.user.id]);
        rows.push(pay);
      }
      return rows;
    });

    res.status(201).json({ data: inserted, message: `${inserted.length} payment(s) recorded` });
  } catch (err) { next(err); }
};

// ── Generate PDF (HTML page, user prints to PDF in browser) ─
exports.getPdf = async (req, res, next) => {
  try {
    const { rows: [inv] } = await db.query(
      `SELECT i.*, c.name AS customer_name, c.address AS customer_address,
              c.vat_number AS customer_vat, c.cr_number AS customer_cr,
              c.tel AS customer_tel,
              co.name AS company_name, co.name_ar, co.address AS company_address,
              co.tel AS company_tel, co.vat_number, co.cr_number,
              co.bank_name, co.bank_iban, co.bank_swift, co.logo AS company_logo, co.theme_color AS company_theme,
              co.pdf_settings AS company_pdf_settings
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       JOIN companies co ON co.id = i.company_id
       WHERE i.id = $1 AND i.company_id = $2`,
      [req.params.id, req.user.company_id]);
    if (!inv) return res.status(404).json({ error: { message: 'Invoice not found' } });
    const { rows: items } = await db.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY line_no`, [req.params.id]);
    const { rows: dns } = await db.query(
      `SELECT id, dn_no FROM delivery_notes WHERE invoice_id = $1`, [req.params.id]);
    const html = await pdfSvc.generateInvoicePdf({
      ...inv,
      items,
      linked_dns: dns,
      company: {
        name: inv.company_name, name_ar: inv.name_ar,
        address: inv.company_address, tel: inv.company_tel,
        vat_number: inv.vat_number, cr_number: inv.cr_number,
        bank_name: inv.bank_name, bank_iban: inv.bank_iban, bank_swift: inv.bank_swift,
        logo: inv.company_logo, theme_color: inv.company_theme,
        pdf_settings: inv.company_pdf_settings,
      }
    });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${inv.invoice_no}.pdf"`);
    res.send(html);
  } catch (err) { next(err); }
};

// ── Browser print (9.5"×11" dot-matrix) ───────────────────
exports.getPrint = async (req, res, next) => {
  try {
    const { rows: [inv] } = await db.query(
      `SELECT i.*, c.name AS customer_name, c.address AS customer_address,
              c.vat_number AS customer_vat, c.cr_number AS customer_cr,
              c.tel AS customer_tel,
              co.name AS company_name, co.name_ar, co.address AS company_address,
              co.tel AS company_tel, co.vat_number, co.cr_number,
              co.bank_name, co.bank_iban, co.bank_swift, co.logo AS company_logo, co.theme_color AS company_theme,
              co.pdf_settings AS company_pdf_settings
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       JOIN companies co ON co.id = i.company_id
       WHERE i.id = $1 AND i.company_id = $2`,
      [req.params.id, req.user.company_id]);
    if (!inv) return res.status(404).json({ error: { message: 'Invoice not found' } });
    const { rows: items } = await db.query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY line_no`, [req.params.id]);
    const { rows: dns } = await db.query(
      `SELECT id, dn_no FROM delivery_notes WHERE invoice_id = $1`, [req.params.id]);
    const html = pdfSvc.invoicePrintHtml({
      ...inv, items, linked_dns: dns,
      company: {
        name: inv.company_name, name_ar: inv.name_ar,
        address: inv.company_address, tel: inv.company_tel,
        vat_number: inv.vat_number, cr_number: inv.cr_number,
        bank_name: inv.bank_name, bank_iban: inv.bank_iban, bank_swift: inv.bank_swift,
        logo: inv.company_logo, theme_color: inv.company_theme,
        pdf_settings: inv.company_pdf_settings,
      }
    });
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Security-Policy', "script-src 'unsafe-inline'; script-src-attr 'unsafe-inline'");
    res.send(html);
  } catch (err) { next(err); }
};

// ── Send payment reminder ──────────────────────────────────
exports.sendReminder = async (req, res, next) => {
  try {
    const { rows: [inv] } = await db.query(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.id = $1 AND i.company_id = $2`, [req.params.id, req.user.company_id]);
    if (!inv) return res.status(404).json({ error: { message: 'Invoice not found' } });
    if (inv.payment_status === 'paid') return res.status(400).json({ error: { message: 'Invoice is already fully paid' } });
    const toEmail = req.body.to || inv.customer_email;
    if (!toEmail) return res.status(400).json({ error: { message: 'No email address available for this customer' } });
    await emailSvc.sendPaymentReminder(inv, toEmail);
    res.json({ message: `Payment reminder sent to ${toEmail}` });
  } catch (err) { next(err); }
};

// ── Send email ─────────────────────────────────────────────
exports.sendEmail = async (req, res, next) => {
  try {
    const { rows: [inv] } = await db.query(
      `SELECT i.*, c.name AS customer_name, c.email AS customer_email
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.id = $1 AND i.company_id = $2`, [req.params.id, req.user.company_id]);
    if (!inv) return res.status(404).json({ error: { message: 'Invoice not found' } });
    await emailSvc.sendInvoice(inv, req.body.to || inv.customer_email);
    res.json({ message: `Invoice emailed to ${req.body.to || inv.customer_email}` });
  } catch (err) { next(err); }
};


// ── Clone invoice — creates a draft copy with a new invoice_no ─────────────
exports.clone = async (req, res, next) => {
  try {
    const { rows: [src] } = await db.query(
      `SELECT i.*, array_agg(
         json_build_object(
           'product_id',  ii.product_id,
           'line_no',     ii.line_no,
           'part_no',     ii.part_no,
           'description', ii.description,
           'qty',         ii.qty,
           'unit',        ii.unit,
           'unit_price',  ii.unit_price,
           'discount',    ii.discount,
           'vat_rate',    ii.vat_rate
         ) ORDER BY ii.line_no
       ) AS items
       FROM invoices i
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE i.id = $1 AND i.company_id = $2
       GROUP BY i.id`,
      [req.params.id, req.user.company_id]);
    if (!src) return res.status(404).json({ error: { message: 'Invoice not found' } });

    const type    = src.type;
    const isDraft = ['quotation','proforma'].includes(type);
    const seqCol  = type === 'quotation' ? 'next_quotation_seq'
                  : type === 'proforma'  ? 'next_proforma_seq'
                  :                        'next_invoice_seq';
    const prefCol = type === 'quotation' ? 'quotation_prefix'
                  : type === 'proforma'  ? 'proforma_prefix'
                  :                        'invoice_prefix';

    const result = await db.withTransaction(async (client) => {
      const { rows: [co] } = await client.query(
        `UPDATE companies SET ${seqCol} = ${seqCol} + 1
         WHERE id = $1 RETURNING ${prefCol} AS prefix, ${seqCol} - 1 AS seq`,
        [req.user.company_id]);
      const invoice_no = `${co.prefix}-${new Date().getFullYear()}-${String(co.seq).padStart(4,'0')}`;

      const { rows: [inv] } = await client.query(
        `INSERT INTO invoices
           (id, company_id, invoice_no, type, customer_id,
            invoice_date, due_date, po_reference,
            subtotal, total_discount, total_vat, shipping, grand_total,
            notes, internal_notes, valid_until, payment_status, created_by)
         VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [uuid(), req.user.company_id, invoice_no, type, src.customer_id,
         src.due_date, src.po_reference,
         src.subtotal, src.total_discount, src.total_vat, src.shipping, src.grand_total,
         src.notes, src.internal_notes, src.valid_until,
         isDraft ? 'draft' : 'draft',
         req.user.id]);

      const items = src.items.filter(Boolean);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO invoice_items
             (id, invoice_id, product_id, line_no, part_no, description,
              qty, unit, unit_price, discount, vat_rate, unit_cost)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             COALESCE((SELECT cost_price FROM products WHERE id=$3), 0))`,
          [uuid(), inv.id, it.product_id||null, i+1, it.part_no, it.description,
           it.qty, it.unit, it.unit_price, it.discount||0, it.vat_rate||10]);
      }
      return inv;
    });

    await audit.log(db, req, 'invoice.cloned', 'invoice', result.id, result.invoice_no,
      { source_id: req.params.id });
    res.status(201).json({ data: result, message: `Cloned as draft ${result.invoice_no}` });
  } catch (err) { next(err); }
};
