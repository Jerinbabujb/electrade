/**
 * Contra Accounts — AR/AP netting for entities that are both customer and supplier.
 *
 * Two entity patterns are supported:
 *   - "linked_pair"   : separate customer + supplier records linked by linked_supplier_id
 *   - "single_record" : one supplier record that SI used for both invoices and purchases
 *     (common when the same company sells to you AND buys from you)
 *
 * Routes:
 *   GET  /contra-accounts                        — all pairs/single-records with AR, AP, net
 *   GET  /contra-accounts/:customerId/invoices   — open invoices for the AR side
 *   GET  /contra-accounts/:customerId/purchases  — open purchases for the AP side
 *   GET  /contra-accounts/:customerId/entries    — contra entry history
 *   POST /contra-accounts/:customerId/entries    — apply a contra entry
 *   DELETE /contra-accounts/entries/:entryId     — reverse a contra entry
 */

const { Router } = require('express')
const { v4: uuid } = require('uuid')
const db  = require('../db')
const { authenticate, authorize } = require('../middleware/auth')

const r = Router()
r.use(authenticate)

// ── Helper: resolve the supplier-side ID for a given entity ID ────────────────
// For linked_pair: returns linked_supplier_id.
// For dual-role single record (is_supplier=true): returns the entity's own ID.
async function resolveSupplierSide(customerId, companyId) {
  const { rows: [c] } = await db.query(
    `SELECT id, is_supplier, linked_supplier_id FROM customers WHERE id=$1 AND company_id=$2`,
    [customerId, companyId]
  )
  if (!c) return null
  if (c.linked_supplier_id) return c.linked_supplier_id  // linked_pair
  if (c.is_supplier)        return c.id                  // dual-role single record
  return null
}

// ── List all contra-eligible entities with balances ───────────────────────────
r.get('/', async (req, res, next) => {
  try {
    const co = req.user.company_id
    const { rows } = await db.query(`
      -- Case 1: linked pairs — separate customer + supplier records
      SELECT
        c.id            AS customer_id,
        c.code          AS customer_code,
        c.name          AS customer_name,
        c.vat_number    AS customer_vat,
        s.id            AS supplier_id,
        s.code          AS supplier_code,
        s.name          AS supplier_name,
        'linked_pair'   AS record_type,
        COALESCE(ar.ar_balance,   0)                               AS ar_balance,
        COALESCE(ap.ap_balance,   0)                               AS ap_balance,
        COALESCE(ar.ar_balance,0) - COALESCE(ap.ap_balance,0)     AS net_position,
        COALESCE(ar.invoice_count,0)                               AS open_invoices,
        COALESCE(ap.purchase_count,0)                              AS open_purchases
      FROM customers c
      JOIN customers s ON s.id = c.linked_supplier_id
      LEFT JOIN (
        SELECT customer_id, SUM(balance_due) AS ar_balance, COUNT(*) AS invoice_count
        FROM invoices
        WHERE type = 'tax_invoice' AND payment_status IN ('unpaid','partial','overdue')
        GROUP BY customer_id
      ) ar ON ar.customer_id = c.id
      LEFT JOIN (
        SELECT supplier_id, SUM(grand_total - amount_paid) AS ap_balance, COUNT(*) AS purchase_count
        FROM purchases WHERE payment_status IN ('unpaid','partial')
        GROUP BY supplier_id
      ) ap ON ap.supplier_id = s.id
      WHERE c.company_id = $1 AND c.type != 'supplier'

      UNION ALL

      -- Case 2: dual-role single records — is_customer AND is_supplier on the same record
      SELECT
        s.id            AS customer_id,
        s.code          AS customer_code,
        s.name          AS customer_name,
        s.vat_number    AS customer_vat,
        s.id            AS supplier_id,
        s.code          AS supplier_code,
        s.name          AS supplier_name,
        'single_record' AS record_type,
        COALESCE(ar.ar_balance,   0)                               AS ar_balance,
        COALESCE(ap.ap_balance,   0)                               AS ap_balance,
        COALESCE(ar.ar_balance,0) - COALESCE(ap.ap_balance,0)     AS net_position,
        COALESCE(ar.invoice_count,0)                               AS open_invoices,
        COALESCE(ap.purchase_count,0)                              AS open_purchases
      FROM customers s
      LEFT JOIN (
        SELECT customer_id, SUM(balance_due) AS ar_balance, COUNT(*) AS invoice_count
        FROM invoices
        WHERE type = 'tax_invoice' AND payment_status IN ('unpaid','partial','overdue')
        GROUP BY customer_id
      ) ar ON ar.customer_id = s.id
      LEFT JOIN (
        SELECT supplier_id, SUM(grand_total - amount_paid) AS ap_balance, COUNT(*) AS purchase_count
        FROM purchases WHERE payment_status IN ('unpaid','partial')
        GROUP BY supplier_id
      ) ap ON ap.supplier_id = s.id
      WHERE s.company_id = $1
        AND s.is_customer = TRUE
        AND s.is_supplier = TRUE
        AND s.linked_supplier_id IS NULL   -- exclude those already covered by linked_pair above

      ORDER BY customer_name
    `, [co])

    res.json({ data: rows })
  } catch (err) { next(err) }
})

// ── Open invoices for the AR side ─────────────────────────────────────────────
r.get('/:customerId/invoices', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT id, invoice_no, invoice_date, due_date,
             grand_total, amount_paid, balance_due, payment_status
      FROM invoices
      WHERE customer_id = $1
        AND company_id  = $2
        AND type            = 'tax_invoice'
        AND payment_status IN ('unpaid','partial','overdue')
      ORDER BY invoice_date
    `, [req.params.customerId, req.user.company_id])
    res.json({ data: rows })
  } catch (err) { next(err) }
})

// ── Open purchases for the AP side ────────────────────────────────────────────
r.get('/:customerId/purchases', async (req, res, next) => {
  try {
    const supplierId = await resolveSupplierSide(req.params.customerId, req.user.company_id)
    if (!supplierId) return res.json({ data: [] })

    const { rows } = await db.query(`
      SELECT id, purchase_no, supplier_invoice_no, purchase_date,
             grand_total, amount_paid,
             (grand_total - amount_paid) AS balance_due, payment_status
      FROM purchases
      WHERE supplier_id = $1
        AND company_id  = $2
        AND payment_status IN ('unpaid','partial')
      ORDER BY purchase_date
    `, [supplierId, req.user.company_id])
    res.json({ data: rows })
  } catch (err) { next(err) }
})

// ── Contra entry history ───────────────────────────────────────────────────────
r.get('/:customerId/entries', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        p.id,
        p.payment_date  AS entry_date,
        p.amount,
        p.notes,
        p.created_at,
        i.invoice_no,
        i.id            AS invoice_id,
        pu.purchase_no,
        pu.supplier_invoice_no,
        pu.id           AS purchase_id,
        u.name          AS created_by_name
      FROM payments p
      JOIN invoices  i  ON i.id  = p.reference_id
      JOIN payments  p2 ON p2.notes LIKE 'contra:' || p.id || '%'
                       AND p2.reference_type = 'purchase'
      JOIN purchases pu ON pu.id = p2.reference_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.reference_type = 'invoice'
        AND p.method         = 'contra'
        AND i.customer_id    = $1
        AND p.company_id     = $2
      ORDER BY p.payment_date DESC, p.created_at DESC
    `, [req.params.customerId, req.user.company_id])
    res.json({ data: rows })
  } catch (err) { next(err) }
})

// ── Apply a contra entry ──────────────────────────────────────────────────────
r.post('/:customerId/entries', authorize('admin', 'sales'), async (req, res, next) => {
  const client = await db.getClient()
  try {
    const { invoice_id, purchase_id, amount, entry_date, notes } = req.body
    const co = req.user.company_id

    if (!invoice_id || !purchase_id || !amount || amount <= 0)
      return res.status(400).json({ error: { message: 'invoice_id, purchase_id and a positive amount are required' } })

    await client.query('BEGIN')

    // Resolve the supplier-side ID (linked or dual-role self)
    const { rows: [cust] } = await client.query(
      `SELECT is_supplier, linked_supplier_id FROM customers WHERE id=$1 AND company_id=$2`,
      [req.params.customerId, co]
    )
    if (!cust) throw Object.assign(new Error('Customer not found'), { status: 404 })

    const supplierId = cust.linked_supplier_id || (cust.is_supplier ? req.params.customerId : null)
    if (!supplierId) throw Object.assign(new Error('No supplier side found for this entity'), { status: 400 })

    // Validate invoice
    const { rows: [inv] } = await client.query(
      `SELECT id, balance_due FROM invoices
       WHERE id=$1 AND customer_id=$2 AND company_id=$3
         AND type='tax_invoice' AND payment_status IN ('unpaid','partial','overdue')`,
      [invoice_id, req.params.customerId, co]
    )
    if (!inv) throw Object.assign(new Error('Invoice not found or already paid'), { status: 400 })

    // Validate purchase
    const { rows: [pur] } = await client.query(
      `SELECT id, grand_total, amount_paid, payment_status FROM purchases
       WHERE id=$1 AND supplier_id=$2 AND company_id=$3 AND payment_status IN ('unpaid','partial')`,
      [purchase_id, supplierId, co]
    )
    if (!pur) throw Object.assign(new Error('Purchase not found or already paid'), { status: 400 })

    const invBalance = parseFloat(inv.balance_due)
    const purBalance = parseFloat(pur.grand_total) - parseFloat(pur.amount_paid)
    const amt        = parseFloat(amount)

    if (amt > invBalance + 0.005)
      throw Object.assign(new Error(`Amount ${amt.toFixed(3)} exceeds invoice balance ${invBalance.toFixed(3)}`), { status: 400 })
    if (amt > purBalance + 0.005)
      throw Object.assign(new Error(`Amount ${amt.toFixed(3)} exceeds purchase balance ${purBalance.toFixed(3)}`), { status: 400 })

    const date     = entry_date || new Date().toISOString().slice(0, 10)
    const invPayId = uuid()
    const purPayId = uuid()
    const noteInv  = notes ? `contra:${purPayId} ${notes}` : `contra:${purPayId}`
    const notePur  = notes ? `contra:${invPayId} ${notes}` : `contra:${invPayId}`

    // Invoice-side payment — DB trigger auto-recalculates invoice status
    await client.query(
      `INSERT INTO payments (id,company_id,reference_type,reference_id,payment_date,amount,method,notes,created_by)
       VALUES ($1,$2,'invoice',$3,$4,$5,'contra',$6,$7)`,
      [invPayId, co, invoice_id, date, amt, noteInv, req.user.id]
    )

    // Purchase-side payment
    await client.query(
      `INSERT INTO payments (id,company_id,reference_type,reference_id,payment_date,amount,method,notes,created_by)
       VALUES ($1,$2,'purchase',$3,$4,$5,'contra',$6,$7)`,
      [purPayId, co, purchase_id, date, amt, notePur, req.user.id]
    )

    // Update purchase totals (trigger only covers invoices)
    const newPaid      = parseFloat(pur.amount_paid) + amt
    const newPurBal    = parseFloat(pur.grand_total) - newPaid
    const newPurStatus = newPurBal <= 0.005 ? 'paid' : newPaid > 0 ? 'partial' : pur.payment_status
    await client.query(
      `UPDATE purchases SET amount_paid=$1, payment_status=$2 WHERE id=$3`,
      [newPaid.toFixed(3), newPurStatus, purchase_id]
    )

    await client.query('COMMIT')
    res.status(201).json({
      data: { invoice_payment_id: invPayId, purchase_payment_id: purPayId, amount: amt, entry_date: date },
      message: `Contra entry of BHD ${amt.toFixed(3)} applied successfully`,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

// ── Reverse a contra entry ────────────────────────────────────────────────────
r.delete('/entries/:entryId', authorize('admin'), async (req, res, next) => {
  const client = await db.getClient()
  try {
    const co = req.user.company_id

    const { rows: [invPay] } = await client.query(
      `SELECT p.*, i.customer_id FROM payments p
       JOIN invoices i ON i.id = p.reference_id
       WHERE p.id=$1 AND p.company_id=$2 AND p.method='contra' AND p.reference_type='invoice'`,
      [req.params.entryId, co]
    )
    if (!invPay) return res.status(404).json({ error: { message: 'Contra entry not found' } })

    const { rows: [purPay] } = await client.query(
      `SELECT * FROM payments
       WHERE notes LIKE $1 AND reference_type='purchase' AND company_id=$2 AND method='contra'`,
      [`contra:${req.params.entryId}%`, co]
    )

    await client.query('BEGIN')

    await client.query(`DELETE FROM payments WHERE id=$1`, [invPay.id])

    if (purPay) {
      const { rows: [pur] } = await client.query(
        `SELECT grand_total, amount_paid FROM purchases WHERE id=$1`, [purPay.reference_id]
      )
      if (pur) {
        const newPaid   = Math.max(0, parseFloat(pur.amount_paid) - parseFloat(purPay.amount))
        const newBal    = parseFloat(pur.grand_total) - newPaid
        const newStatus = newBal <= 0.005 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'
        await client.query(
          `UPDATE purchases SET amount_paid=$1, payment_status=$2 WHERE id=$3`,
          [newPaid.toFixed(3), newStatus, purPay.reference_id]
        )
      }
      await client.query(`DELETE FROM payments WHERE id=$1`, [purPay.id])
    }

    await client.query('COMMIT')
    res.json({ message: 'Contra entry reversed successfully' })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

module.exports = r
