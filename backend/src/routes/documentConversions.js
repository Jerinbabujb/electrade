const router = require('express').Router();
const db     = require('../db');
const { v4: uuid } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

/**
 * POST /api/v1/documents/convert
 * Convert one document type to another:
 *   quotation  → tax_invoice
 *   quotation  → proforma
 *   quotation  → delivery_note
 *   proforma   → tax_invoice
 *   proforma   → delivery_note
 *   tax_invoice → credit_note  (full or partial credit)
 *
 * Body: { from_id, from_type, to_type, overrides: {} }
 */
router.post('/', authorize('admin','sales'), async (req, res, next) => {
  try {
    const { from_id, from_type, to_type, overrides = {} } = req.body;
    const co_id = req.user.company_id;

    // ── Load source document ──────────────────────────────
    let src, srcItems;

    if (from_type === 'invoice') {
      const { rows: [inv] } = await db.query(
        `SELECT * FROM invoices WHERE id = $1 AND company_id = $2`, [from_id, co_id]);
      if (!inv) return res.status(404).json({ error: { message: 'Source invoice not found' } });
      if (inv.converted_at)
        return res.status(409).json({ error: { message: `This document was already converted on ${new Date(inv.converted_at).toLocaleDateString()}` } });
      const { rows: items } = await db.query(
        `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY line_no`, [from_id]);
      src = inv; srcItems = items;
    } else if (from_type === 'delivery_note') {
      const { rows: [dn] } = await db.query(
        `SELECT * FROM delivery_notes WHERE id = $1 AND company_id = $2`, [from_id, co_id]);
      if (!dn) return res.status(404).json({ error: { message: 'Source DN not found' } });
      const { rows: items } = await db.query(
        `SELECT * FROM delivery_note_items WHERE dn_id = $1 ORDER BY line_no`, [from_id]);
      src = dn; srcItems = items;
    } else {
      return res.status(400).json({ error: { message: 'Unsupported from_type' } });
    }

    let result;
    const year = new Date().getFullYear();

    // ── Convert invoice/quotation/proforma → delivery_note ─
    if (to_type === 'delivery_note') {
      // Stock shortfall check (same logic as direct DN create)
      const finalItemsForCheck = (overrides.items && overrides.items.length > 0)
        ? overrides.items
        : srcItems.map(it => ({
            product_id:    it.product_id,
            qty_delivered: it.qty != null ? it.qty : it.qty_ordered,
          }));

      if (!overrides.force_overstock) {
        const shortfalls = [];
        for (const it of finalItemsForCheck) {
          if (it.product_id) {
            const { rows: [p] } = await db.query(
              `SELECT stock_qty, name, is_stock_tracked FROM products WHERE id = $1 AND company_id = $2`,
              [it.product_id, co_id]);
            if (p && p.is_stock_tracked && parseFloat(p.stock_qty) < parseFloat(it.qty_delivered)) {
              shortfalls.push({
                name:      p.name,
                available: parseFloat(p.stock_qty),
                requested: parseFloat(it.qty_delivered),
                shortfall: parseFloat(it.qty_delivered) - parseFloat(p.stock_qty),
              });
            }
          }
        }
        if (shortfalls.length > 0) {
          return res.status(409).json({
            code: 'STOCK_SHORTFALL',
            shortfalls,
            message: 'Some items exceed available stock. Confirm to proceed (stock will go negative until replenished).',
          });
        }
      }

      const { rows: [co] } = await db.query(
        `UPDATE companies SET next_dn_seq = next_dn_seq + 1
         WHERE id = $1 RETURNING dn_prefix, next_dn_seq - 1 AS seq`, [co_id]);
      const dn_no = `${co.dn_prefix}-${year}-${String(co.seq).padStart(4,'0')}`;

      result = await db.withTransaction(async (client) => {
        const { rows: [dn] } = await client.query(
          `INSERT INTO delivery_notes
             (id, company_id, dn_no, customer_id, dn_date, project_ref, po_reference,
              notes, delivery_address, delivered_by, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [uuid(), co_id, dn_no, overrides.customer_id || src.customer_id,
           overrides.dn_date || new Date(),
           overrides.project_ref  || src.po_reference || null,
           overrides.po_reference || src.po_reference || null,
           overrides.notes        || src.notes,
           overrides.delivery_address || null,
           overrides.delivered_by     || null,
           req.user.id]);

        // When overrides.items is provided (full item list from the DN form),
        // use it as the authoritative list — supports edited/added items.
        // Fall back to srcItems when no overrides provided.
        const finalItems = (overrides.items && overrides.items.length > 0)
          ? overrides.items
          : srcItems.map(it => ({
              product_id:    it.product_id,
              part_no:       it.part_no,
              description:   it.description,
              qty_ordered:   it.qty != null ? it.qty : it.qty_ordered,
              qty_delivered: it.qty != null ? it.qty : it.qty_ordered,
              unit:          it.unit,
              unit_price:    it.unit_price || 0,
            }));

        for (let i = 0; i < finalItems.length; i++) {
          const it = finalItems[i];
          await client.query(
            `INSERT INTO delivery_note_items
               (id, dn_id, product_id, line_no, part_no, description, qty_ordered, qty_delivered, unit, unit_price)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [uuid(), dn.id,
             it.product_id || null, i + 1,
             it.part_no    || '',
             it.description || '',
             parseFloat(it.qty_ordered)  || 0,
             parseFloat(it.qty_delivered) || parseFloat(it.qty_ordered) || 0,
             it.unit || 'pcs',
             parseFloat(it.unit_price)   || 0]);
        }

        await client.query(
          `INSERT INTO document_conversions
             (id, company_id, from_type, from_id, from_no, to_type, to_id, to_no, converted_by)
           VALUES ($1,$2,$3,$4,$5,'delivery_note',$6,$7,$8)`,
          [uuid(), co_id, from_type, from_id,
           src.invoice_no || src.dn_no, dn.id, dn.dn_no, req.user.id]);

        // Stamp source invoice as converted
        if (from_type === 'invoice') {
          await client.query(
            `UPDATE invoices SET converted_at = now(), converted_by_user = $1 WHERE id = $2`,
            [req.user.id, from_id]);
        }
        return dn;
      });

      return res.status(201).json({ data: result, to_type: 'delivery_note',
        message: `Delivery Note ${result.dn_no} created from ${src.invoice_no || src.dn_no}` });
    }

    // ── Convert quotation/proforma/DN → tax invoice ────────
    if (['tax_invoice','proforma','quotation','credit_note'].includes(to_type)) {
      const { rows: [co] } = await db.query(
        `UPDATE companies SET next_invoice_seq = next_invoice_seq + 1
         WHERE id = $1 RETURNING invoice_prefix, next_invoice_seq - 1 AS seq`, [co_id]);
      const invoice_no = `${co.invoice_prefix}-${year}-${String(co.seq).padStart(4,'0')}`;

      const multiplier = to_type === 'credit_note' ? -1 : 1;
      const items = srcItems.map(it => ({
        product_id:  it.product_id,
        part_no:     it.part_no,
        description: it.description,
        qty:         (it.qty || it.qty_delivered) * multiplier,
        unit:        it.unit,
        unit_price:  it.unit_price,
        discount:    it.discount || 0,
        vat_rate:    it.vat_rate || 10,
      }));

      // Derive invoice-level (overall) discount from source header total_discount
      // minus the sum of per-line discounts that are already on the items.
      const lineDiscSum  = items.reduce((s, i) => s + Number(i.discount || 0), 0);
      const invDisc      = Math.max(0, Number(src.total_discount || 0) - lineDiscSum);

      // VAT-compliant totals: apportion overall discount proportionally (NBR Article 27)
      const netAfterLineDisc = items.reduce((s, i) =>
        s + Math.abs(Number(i.qty)) * Number(i.unit_price) - Number(i.discount || 0), 0);
      let total_vat = 0;
      for (const it of items) {
        const lineNet     = Math.abs(Number(it.qty)) * Number(it.unit_price) - Number(it.discount || 0);
        const discShare   = netAfterLineDisc > 0 ? invDisc * (lineNet / netAfterLineDisc) : 0;
        total_vat += (lineNet - discShare) * Number(it.vat_rate || 10) / 100;
      }
      total_vat          *= multiplier;
      const subtotal      = netAfterLineDisc * multiplier;
      const total_discount = (lineDiscSum + invDisc) * multiplier;
      const grand_total   = (netAfterLineDisc - invDisc) * multiplier + total_vat;

      result = await db.withTransaction(async (client) => {
        // When converting a proforma/quotation → tax_invoice, carry the source doc no. as PO reference
        const derivedPoRef = overrides.po_reference
          || ((['quotation','proforma'].includes(src.type) && to_type === 'tax_invoice')
              ? src.invoice_no
              : src.po_reference)

        const { rows: [inv] } = await client.query(
          `INSERT INTO invoices
             (id, company_id, invoice_no, type, customer_id, invoice_date, due_date,
              po_reference, subtotal, total_discount, total_vat, grand_total, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [uuid(), co_id, invoice_no, to_type,
           overrides.customer_id || src.customer_id,
           overrides.invoice_date || new Date(),
           overrides.due_date || null,
           derivedPoRef,
           subtotal.toFixed(3), total_discount.toFixed(3),
           total_vat.toFixed(3), grand_total.toFixed(3),
           overrides.notes || src.notes, req.user.id]);

        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          await client.query(
            `INSERT INTO invoice_items
               (id, invoice_id, product_id, line_no, part_no, description, qty, unit, unit_price, discount, vat_rate)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [uuid(), inv.id, it.product_id||null, i+1,
             it.part_no, it.description, it.qty, it.unit,
             it.unit_price, it.discount, it.vat_rate]);
        }

        // If converting from DN, mark it as invoiced
        if (from_type === 'delivery_note') {
          await client.query(
            `UPDATE delivery_notes SET invoice_id = $1, status = 'invoiced' WHERE id = $2`,
            [inv.id, from_id]);
        }

        // If converting a quotation → tax_invoice, mark all linked DNs as invoiced
        if (from_type === 'invoice' && src.type === 'quotation' && to_type === 'tax_invoice') {
          await client.query(
            `UPDATE delivery_notes
             SET status = 'invoiced', invoice_id = $1
             WHERE linked_quotation_id = $2 AND company_id = $3 AND status = 'quoted'`,
            [inv.id, from_id, co_id]);
        }

        await client.query(
          `INSERT INTO document_conversions
             (id, company_id, from_type, from_id, from_no, to_type, to_id, to_no, converted_by)
           VALUES ($1,$2,$3,$4,$5,'invoice',$6,$7,$8)`,
          [uuid(), co_id, from_type, from_id,
           src.invoice_no || src.dn_no, inv.id, inv.invoice_no, req.user.id]);

        // Stamp source invoice as converted
        if (from_type === 'invoice') {
          await client.query(
            `UPDATE invoices SET converted_at = now(), converted_by_user = $1 WHERE id = $2`,
            [req.user.id, from_id]);
        }
        return inv;
      });

      return res.status(201).json({ data: result, to_type,
        message: `${to_type.replace('_',' ')} ${result.invoice_no} created from ${src.invoice_no || src.dn_no}` });
    }

    res.status(400).json({ error: { message: `Unsupported conversion: ${from_type} → ${to_type}` } });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/documents/convert/history/:id
 * Get full conversion chain for a document (shows all related documents)
 */
router.get('/history/:id', async (req, res, next) => {
  try {
    // Validate UUID format before querying to avoid pg error
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.json({ data: [] });
    const { rows } = await db.query(
      `SELECT dc.*,
              u.name AS converted_by_name
       FROM document_conversions dc
       LEFT JOIN users u ON u.id = dc.converted_by
       WHERE (dc.from_id = $1 OR dc.to_id = $1) AND dc.company_id = $2
       ORDER BY dc.converted_at`, [req.params.id, req.user.company_id]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
