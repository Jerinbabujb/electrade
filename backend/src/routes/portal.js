/**
 * Customer Self-Service Portal — token-gated, no user auth required
 *
 * POST /api/v1/portal/generate/:customerId  — create/refresh portal token  (authenticated)
 * GET  /api/v1/portal/:token                — public: customer statement + invoices
 * GET  /api/v1/portal/:token/invoices/:id/pdf — public PDF stream
 */

const { Router }              = require('express')
const db                      = require('../db')
const { authenticate }        = require('../middleware/auth')
const pdfSvc                  = require('../services/pdfService')

const r = Router()

// ── Generate / refresh a portal token for a customer (authenticated) ──────────
r.post('/generate/:customerId', authenticate, async (req, res, next) => {
  try {
    const { customerId } = req.params
    // Verify customer belongs to this company
    const { rows: [cust] } = await db.query(
      `SELECT id, name, email FROM customers WHERE id=$1 AND company_id=$2`,
      [customerId, req.user.company_id])
    if (!cust) return res.status(404).json({ error: { message: 'Customer not found' } })

    // Upsert token — regenerate on conflict
    const { rows: [tok] } = await db.query(`
      INSERT INTO customer_portal_tokens (customer_id, company_id)
      VALUES ($1, $2)
      ON CONFLICT (customer_id, company_id)
        DO UPDATE SET token = encode(gen_random_bytes(24), 'hex'), created_at = now()
      RETURNING token
    `, [customerId, req.user.company_id])

    const url = `${req.headers.origin || ''}/portal/${tok.token}`
    res.json({ data: { token: tok.token, url } })
  } catch (err) { next(err) }
})

// ── Public portal — returns customer data + invoices ──────────────────────────
r.get('/:token', async (req, res, next) => {
  try {
    const { rows: [tok] } = await db.query(
      `SELECT cpt.customer_id, cpt.company_id,
              c.name AS customer_name, c.email, c.phone, c.address,
              co.name AS company_name, co.logo, co.theme_color,
              co.address AS company_address, co.tel AS company_tel,
              co.email AS company_email, co.vat_number, co.cr_number,
              co.bank_name, co.bank_iban, co.bank_acct_name, co.bank_swift
       FROM customer_portal_tokens cpt
       JOIN customers c  ON c.id  = cpt.customer_id
       JOIN companies co ON co.id = cpt.company_id
       WHERE cpt.token = $1`,
      [req.params.token])
    if (!tok) return res.status(404).json({ error: { message: 'Invalid or expired portal link' } })

    // Invoices for this customer
    const { rows: invoices } = await db.query(`
      SELECT id, invoice_no, invoice_date, due_date, type,
             grand_total::numeric, balance_due::numeric, amount_paid::numeric,
             payment_status, po_reference, notes
      FROM invoices
      WHERE company_id     = $1
        AND customer_id    = $2
        AND type           = 'tax_invoice'
        AND payment_status != 'void'
      ORDER BY invoice_date DESC
      LIMIT 200
    `, [tok.company_id, tok.customer_id])

    // Statement totals
    const totals = invoices.reduce((acc, inv) => {
      acc.total_billed   += parseFloat(inv.grand_total   || 0)
      acc.total_paid     += parseFloat(inv.amount_paid   || 0)
      acc.total_outstanding += parseFloat(inv.balance_due || 0)
      return acc
    }, { total_billed: 0, total_paid: 0, total_outstanding: 0 })

    res.json({
      customer: {
        name:  tok.customer_name,
        email: tok.email,
        phone: tok.phone,
        address: tok.address,
      },
      company: {
        name:            tok.company_name,
        logo:            tok.logo,
        theme_color:     tok.theme_color,
        address:         tok.company_address,
        tel:             tok.company_tel,
        email:           tok.company_email,
        vat_number:      tok.vat_number,
        cr_number:       tok.cr_number,
        bank_name:       tok.bank_name,
        bank_iban:       tok.bank_iban,
        bank_acct_name:  tok.bank_acct_name,
        bank_swift:      tok.bank_swift,
      },
      invoices,
      totals,
    })
  } catch (err) { next(err) }
})

// ── Public PDF ─────────────────────────────────────────────────────────────────
r.get('/:token/invoices/:invoiceId/pdf', async (req, res, next) => {
  try {
    // Verify token and that invoice belongs to the portal's customer/company
    const { rows: [tok] } = await db.query(
      `SELECT cpt.customer_id, cpt.company_id
       FROM customer_portal_tokens cpt WHERE cpt.token = $1`,
      [req.params.token])
    if (!tok) return res.status(404).json({ error: { message: 'Invalid portal link' } })

    const { rows: [inv] } = await db.query(`
      SELECT i.*, c.name AS customer_name, c.address AS customer_address,
             c.phone AS customer_phone, c.vat_number AS customer_vat,
             c.cr_number AS customer_cr
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      WHERE i.id = $1 AND i.company_id = $2 AND i.customer_id = $3
    `, [req.params.invoiceId, tok.company_id, tok.customer_id])
    if (!inv) return res.status(404).json({ error: { message: 'Invoice not found' } })

    const items = await db.query(
      `SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY line_no`, [inv.id])
    const { rows: [co] } = await db.query(
      `SELECT * FROM companies WHERE id=$1`, [tok.company_id])

    const pdf = await pdfSvc.generateInvoicePdf({ ...inv, items: items.rows, company: co })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${inv.invoice_no}.pdf"`)
    res.send(pdf)
  } catch (err) { next(err) }
})

module.exports = r
