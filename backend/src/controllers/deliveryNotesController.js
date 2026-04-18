const db  = require('../db');
const pdfSvc = require('../services/pdfService');
const { v4: uuid } = require('uuid');

// ── List DNs ───────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { status, customer_id, from, to, q } = req.query;
    const params = [req.user.company_id];
    let where = ['dn.company_id = $1'];
    if (status)      { params.push(status);     where.push(`dn.status = $${params.length}`); }
    if (customer_id) { params.push(customer_id);where.push(`dn.customer_id = $${params.length}`); }
    if (from)        { params.push(from);        where.push(`dn.dn_date >= $${params.length}`); }
    if (to)          { params.push(to);          where.push(`dn.dn_date <= $${params.length}`); }
    if (q)           { params.push(`%${q}%`);    where.push(`(dn.dn_no ILIKE $${params.length} OR c.name ILIKE $${params.length} OR dn.project_ref ILIKE $${params.length})`); }

    const sql = `
      SELECT dn.*, c.name AS customer_name,
             COUNT(dni.id)::int AS item_count,
             SUM(dni.qty_delivered * dni.unit_price) AS net_value,
             i.invoice_no AS linked_invoice_no,
             q.invoice_no AS linked_quotation_no
      FROM delivery_notes dn
      JOIN customers c ON c.id = dn.customer_id
      LEFT JOIN delivery_note_items dni ON dni.dn_id = dn.id
      LEFT JOIN invoices i ON i.id = dn.invoice_id
      LEFT JOIN invoices q ON q.id = dn.linked_quotation_id
      WHERE ${where.join(' AND ')}
      GROUP BY dn.id, c.name, i.invoice_no, q.invoice_no
      ORDER BY dn.dn_date DESC`;
    const { rows } = await db.query(sql, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
};

// ── Get single DN ──────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const { rows: [dn] } = await db.query(
      `SELECT dn.*, c.name AS customer_name, c.address AS customer_address,
              c.vat_number AS customer_vat, c.cr_number AS customer_cr,
              i.invoice_no AS linked_invoice_no
       FROM delivery_notes dn
       JOIN customers c ON c.id = dn.customer_id
       LEFT JOIN invoices i ON i.id = dn.invoice_id
       WHERE dn.id = $1 AND dn.company_id = $2`, [req.params.id, req.user.company_id]);
    if (!dn) return res.status(404).json({ error: { message: 'Delivery note not found' } });

    const { rows: items } = await db.query(
      `SELECT dni.*, p.name AS product_name, p.sku
       FROM delivery_note_items dni
       LEFT JOIN products p ON p.id = dni.product_id
       WHERE dni.dn_id = $1 ORDER BY dni.line_no`, [req.params.id]);

    res.json({ data: { ...dn, items } });
  } catch (err) { next(err); }
};

// ── Create DN — stock deducted via DB trigger ──────────────
exports.create = async (req, res, next) => {
  try {
    const { customer_id, dn_date, delivery_address, project_ref,
            po_reference, delivered_by, items = [], notes } = req.body;
    if (!items.length) return res.status(400).json({ error: { message: 'Add at least one item' } });

    // Check stock availability before committing
    for (const item of items) {
      if (item.product_id) {
        const { rows: [p] } = await db.query(
          `SELECT stock_qty, name FROM products WHERE id = $1 AND company_id = $2`,
          [item.product_id, req.user.company_id]);
        if (p && parseFloat(p.stock_qty) < parseFloat(item.qty_delivered)) {
          return res.status(400).json({
            error: { message: `Insufficient stock for "${p.name}". Available: ${p.stock_qty}, Requested: ${item.qty_delivered}` }
          });
        }
      }
    }

    const result = await db.withTransaction(async (client) => {
      // Generate DN number
      const { rows: [co] } = await client.query(
        `UPDATE companies SET next_dn_seq = next_dn_seq + 1
         WHERE id = $1 RETURNING dn_prefix, next_dn_seq - 1 AS seq`, [req.user.company_id]);
      const dn_no = `${co.dn_prefix}-${new Date().getFullYear()}-${String(co.seq).padStart(4,'0')}`;

      const { rows: [dn] } = await client.query(
        `INSERT INTO delivery_notes (id, company_id, dn_no, customer_id, dn_date, delivery_address,
           project_ref, po_reference, delivered_by, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [uuid(), req.user.company_id, dn_no, customer_id,
         dn_date || new Date(), delivery_address, project_ref,
         po_reference, delivered_by, notes, req.user.id]);

      // Insert items — DB trigger fires dn_item_stock_out() per row
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO delivery_note_items
             (id, dn_id, product_id, line_no, part_no, description, qty_ordered, qty_delivered, unit, unit_price)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [uuid(), dn.id, it.product_id||null, i+1, it.part_no,
           it.description, it.qty_ordered || it.qty_delivered, it.qty_delivered,
           it.unit, it.unit_price || 0]);
      }
      return dn;
    });

    res.status(201).json({ data: result, message: `${result.dn_no} created — stock deducted` });
  } catch (err) { next(err); }
};

// ── Cancel DN — stock reversed via DB trigger ──────────────
exports.cancel = async (req, res, next) => {
  try {
    const { rows: [dn] } = await db.query(
      `UPDATE delivery_notes
       SET status = 'cancelled', cancelled_at = now()
       WHERE id = $1 AND company_id = $2 AND status IN ('pending_invoice','quoted')
       RETURNING dn_no`,
      [req.params.id, req.user.company_id]);
    // DB trigger trg_dn_cancel_reversal fires automatically on status change
    if (!dn) return res.status(400).json({ error: { message: 'DN not found or already invoiced/cancelled' } });
    res.json({ message: `${dn.dn_no} cancelled — stock reversed` });
  } catch (err) { next(err); }
};

// ── Convert DN → Invoice (single DN) ─────────────────────
exports.convertToInvoice = async (req, res, next) => {
  req.body.dn_ids = [req.params.id];
  req.body.customer_id = req.body.customer_id;
  // Delegate to invoice controller's createFromDNs
  const invCtrl = require('./invoicesController');
  return invCtrl.createFromDNs(req, res, next);
};

// ── Create Quotation from 1+ pending DNs ──────────────────
exports.quoteFromDNs = async (req, res, next) => {
  try {
    const { dn_ids, quotation_date, valid_until, notes } = req.body;
    if (!Array.isArray(dn_ids) || dn_ids.length === 0)
      return res.status(400).json({ error: { message: 'Select at least one delivery note' } });

    // Load & validate DNs
    const { rows: dns } = await db.query(
      `SELECT dn.*, c.name AS customer_name
       FROM delivery_notes dn
       JOIN customers c ON c.id = dn.customer_id
       WHERE dn.id = ANY($1::uuid[]) AND dn.company_id = $2 AND dn.status = 'pending_invoice'`,
      [dn_ids, req.user.company_id]);
    if (dns.length !== dn_ids.length)
      return res.status(400).json({ error: { message: 'One or more DNs not found or not in pending_invoice status' } });

    const uniqueCustomers = [...new Set(dns.map(d => d.customer_id))];
    if (uniqueCustomers.length > 1)
      return res.status(400).json({ error: { message: 'All selected DNs must belong to the same customer' } });

    // Fetch all items from the selected DNs, picking up per-product VAT rate
    const { rows: allItems } = await db.query(
      `SELECT dni.*, COALESCE(p.vat_rate, 10) AS vat_rate
       FROM delivery_note_items dni
       LEFT JOIN products p ON p.id = dni.product_id
       WHERE dni.dn_id = ANY($1::uuid[]) ORDER BY dni.dn_id, dni.line_no`,
      [dn_ids]);
    if (!allItems.length)
      return res.status(400).json({ error: { message: 'Selected DNs have no line items' } });

    const result = await db.withTransaction(async (client) => {
      // Allocate quotation number using the quotation sequence + prefix
      const { rows: [co] } = await client.query(
        `UPDATE companies SET next_quotation_seq = next_quotation_seq + 1
         WHERE id = $1 RETURNING quotation_prefix, next_quotation_seq - 1 AS seq`,
        [req.user.company_id]);
      const year = new Date().getFullYear();
      const invoice_no = `${co.quotation_prefix}-${year}-${String(co.seq).padStart(4,'0')}`;

      // Calculate totals using per-item VAT rates (from products, defaulting to 10%)
      let subtotal = 0, total_vat = 0;
      for (const it of allItems) {
        const net = parseFloat(it.qty_delivered) * parseFloat(it.unit_price);
        subtotal  += net;
        total_vat += net * parseFloat(it.vat_rate) / 100;
      }
      const grand_total = subtotal + total_vat;

      // Insert quotation invoice
      const { rows: [inv] } = await client.query(
        `INSERT INTO invoices
           (id, company_id, invoice_no, type, customer_id, invoice_date,
            valid_until, subtotal, total_discount, total_vat, grand_total, notes, created_by)
         VALUES ($1,$2,$3,'quotation',$4,$5,$6,$7,0,$8,$9,$10,$11) RETURNING *`,
        [uuid(), req.user.company_id, invoice_no, uniqueCustomers[0],
         quotation_date || new Date(), valid_until || null,
         subtotal.toFixed(3), total_vat.toFixed(3), grand_total.toFixed(3),
         notes || null, req.user.id]);

      // Insert invoice line items from merged DN items
      for (let i = 0; i < allItems.length; i++) {
        const it = allItems[i];
        await client.query(
          `INSERT INTO invoice_items
             (id, invoice_id, product_id, line_no, part_no, description, qty, unit, unit_price, discount, vat_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10)`,
          [uuid(), inv.id, it.product_id || null, i + 1,
           it.part_no || '', it.description || '',
           parseFloat(it.qty_delivered), it.unit || 'pcs',
           parseFloat(it.unit_price) || 0, parseFloat(it.vat_rate)]);
      }

      // Mark DNs as quoted and link them to the new quotation
      await client.query(
        `UPDATE delivery_notes SET status = 'quoted', linked_quotation_id = $1
         WHERE id = ANY($2::uuid[]) AND company_id = $3`,
        [inv.id, dn_ids, req.user.company_id]);

      // Record document_conversions entry per DN
      for (const dn of dns) {
        await client.query(
          `INSERT INTO document_conversions
             (id, company_id, from_type, from_id, from_no, to_type, to_id, to_no, converted_by)
           VALUES ($1,$2,'delivery_note',$3,$4,'invoice',$5,$6,$7)`,
          [uuid(), req.user.company_id, dn.id, dn.dn_no, inv.id, inv.invoice_no, req.user.id]);
      }

      return { ...inv, customer_name: dns[0].customer_name };
    });

    res.status(201).json({
      data: result,
      message: `Quotation ${result.invoice_no} created from ${dns.length} DN${dns.length > 1 ? 's' : ''}`,
    });
  } catch (err) { next(err); }
};

// ── Print DN PDF ───────────────────────────────────────────
exports.getPdf = async (req, res, next) => {
  try {
    let dnData
    const mockRes = { json: (d) => { dnData = d.data } }
    await exports.getOne({ ...req }, mockRes, next);
    // Attach company data for PDF rendering
    const { rows: [co] } = await db.query(
      `SELECT name, name_ar, address, tel, email, vat_number, cr_number,
              bank_name, bank_iban, bank_swift, logo, theme_color
       FROM companies WHERE id = $1`, [req.user.company_id]);
    const pdfBuffer = await pdfSvc.generateDnPdf({ ...dnData, company: co });
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};
