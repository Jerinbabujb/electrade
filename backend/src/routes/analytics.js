/**
 * Analytics — Business Insights (Phase 1)
 *
 * GET /api/v1/analytics/stock-velocity   — fast/slow/dormant movers
 * GET /api/v1/analytics/gross-margin     — margin by category
 * GET /api/v1/analytics/top-customers    — customer revenue + est. margin
 * GET /api/v1/analytics/supplier-pricing — cheapest supplier per product
 */

const { Router } = require('express')
const db = require('../db')
const { authenticate } = require('../middleware/auth')

const r = Router()
r.use(authenticate)

// ── Stock Velocity ────────────────────────────────────────────────────────────
// ?days=90&category_id=<uuid>
r.get('/stock-velocity', async (req, res, next) => {
  try {
    const co   = req.user.company_id
    const days = Math.max(1, parseInt(req.query.days) || 90)

    const params = [co, days]
    const catFilter = req.query.category_id
      ? `AND p.category_id = $${params.push(req.query.category_id)}`
      : ''

    const { rows } = await db.query(`
      SELECT *,
        ROUND((qty_sold / $2::numeric), 4)                               AS velocity_per_day,
        CASE
          WHEN qty_sold / $2::numeric > 1   THEN 'fast'
          WHEN qty_sold / $2::numeric > 0.1 THEN 'normal'
          WHEN qty_sold > 0                 THEN 'slow'
          ELSE                                   'dormant'
        END                                                              AS velocity_class,
        CASE WHEN qty_sold > 0
          THEN ROUND(stock_qty * $2::numeric / qty_sold, 0)::int
          ELSE NULL
        END                                                              AS days_of_supply
      FROM (
        SELECT
          p.id, p.sku, p.name,
          COALESCE(cat.name, 'Uncategorised') AS category,
          p.stock_qty::numeric                AS stock_qty,
          p.cost_price::numeric               AS cost_price,
          p.stock_min::numeric                AS stock_min,
          COALESCE(sold.qty_sold, 0) AS qty_sold
        FROM products p
        LEFT JOIN categories cat ON cat.id = p.category_id
        LEFT JOIN (
          SELECT ii.product_id, SUM(ii.qty::numeric) AS qty_sold
          FROM invoice_items ii
          JOIN invoices i
            ON  i.id             = ii.invoice_id
            AND i.company_id     = $1
            AND i.type           = 'tax_invoice'
            AND i.payment_status != 'void'
            AND i.invoice_date  >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
          GROUP BY ii.product_id
        ) sold ON sold.product_id = p.id
        WHERE p.company_id = $1
          AND p.is_active        = TRUE
          AND p.is_stock_tracked = TRUE
          ${catFilter}
        GROUP BY p.id, p.sku, p.name, cat.name,
                 p.stock_qty, p.cost_price, p.stock_min, sold.qty_sold
      ) q
      ORDER BY qty_sold DESC, name
      LIMIT 1000
    `, params)

    // summary counts
    const summary = { fast: 0, normal: 0, slow: 0, dormant: 0 }
    for (const r of rows) summary[r.velocity_class]++

    res.json({ data: rows, summary, period_days: days })
  } catch (err) { next(err) }
})

// ── Gross Margin by Category ──────────────────────────────────────────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD
r.get('/gross-margin', async (req, res, next) => {
  try {
    const co   = req.user.company_id
    const from = req.query.from || new Date().getFullYear() + '-01-01'
    const to   = req.query.to   || new Date().toISOString().slice(0, 10)

    const { rows } = await db.query(`
      WITH items AS (
        SELECT
          COALESCE(cat.name, 'Uncategorised')                             AS category,
          ii.net_amount::numeric                                           AS net_amount,
          ii.qty::numeric                                                  AS qty,
          COALESCE(p.cost_price, 0)::numeric                              AS cost_price,
          CASE WHEN i.subtotal > 0
            THEN i.total_discount::numeric * (ii.net_amount::numeric / i.subtotal::numeric)
            ELSE 0
          END                                                              AS discount_share
        FROM invoice_items ii
        JOIN invoices  i   ON  ii.invoice_id  = i.id
        JOIN products  p   ON  ii.product_id  = p.id
        LEFT JOIN categories cat ON cat.id = p.category_id
        WHERE i.company_id     = $1
          AND i.type           = 'tax_invoice'
          AND i.payment_status != 'void'
          AND i.invoice_date BETWEEN $2 AND $3
      )
      SELECT
        category,
        COUNT(*)::int                                                      AS line_count,
        ROUND(SUM(net_amount),        3)                                  AS net_revenue,
        ROUND(SUM(qty * cost_price),  3)                                  AS total_cogs,
        ROUND(SUM(net_amount) - SUM(qty * cost_price), 3)                AS gross_profit,
        ROUND(
          CASE WHEN SUM(net_amount) > 0
            THEN (SUM(net_amount) - SUM(qty * cost_price)) / SUM(net_amount) * 100
            ELSE 0
          END, 1)                                                          AS margin_pct,
        ROUND(SUM(discount_share), 3)                                    AS total_discount
      FROM items
      GROUP BY category
      ORDER BY gross_profit DESC
    `, [co, from, to])

    // totals row
    const totals = rows.reduce((acc, r) => {
      acc.net_revenue  = +(+acc.net_revenue  + +r.net_revenue ).toFixed(3)
      acc.total_cogs   = +(+acc.total_cogs   + +r.total_cogs  ).toFixed(3)
      acc.gross_profit = +(+acc.gross_profit + +r.gross_profit).toFixed(3)
      return acc
    }, { net_revenue: 0, total_cogs: 0, gross_profit: 0 })
    totals.margin_pct = totals.net_revenue > 0
      ? +((totals.gross_profit / totals.net_revenue) * 100).toFixed(1)
      : 0

    res.json({ data: rows, totals, from, to })
  } catch (err) { next(err) }
})

// ── Gross Margin drill-down — products within a category ─────────────────────
// ?category=<name>&from=YYYY-MM-DD&to=YYYY-MM-DD
r.get('/gross-margin/detail', async (req, res, next) => {
  try {
    const co       = req.user.company_id
    const category = req.query.category || ''
    const from     = req.query.from || new Date().getFullYear() + '-01-01'
    const to       = req.query.to   || new Date().toISOString().slice(0, 10)

    const { rows } = await db.query(`
      WITH items AS (
        SELECT
          p.id                                                             AS product_id,
          p.sku,
          p.name                                                           AS product_name,
          ii.net_amount::numeric                                           AS net_amount,
          ii.qty::numeric                                                  AS qty,
          COALESCE(p.cost_price, 0)::numeric                              AS cost_price,
          CASE WHEN i.subtotal > 0
            THEN i.total_discount::numeric * (ii.net_amount::numeric / i.subtotal::numeric)
            ELSE 0
          END                                                              AS discount_share
        FROM invoice_items ii
        JOIN invoices  i   ON  ii.invoice_id  = i.id
        JOIN products  p   ON  ii.product_id  = p.id
        LEFT JOIN categories cat ON cat.id = p.category_id
        WHERE i.company_id     = $1
          AND i.type           = 'tax_invoice'
          AND i.payment_status != 'void'
          AND i.invoice_date BETWEEN $2 AND $3
          AND COALESCE(cat.name, 'Uncategorised') = $4
      )
      SELECT
        product_id, sku, product_name,
        COUNT(*)::int                                                      AS line_count,
        ROUND(SUM(net_amount),        3)                                  AS net_revenue,
        ROUND(SUM(qty * cost_price),  3)                                  AS total_cogs,
        ROUND(SUM(net_amount) - SUM(qty * cost_price), 3)                AS gross_profit,
        ROUND(
          CASE WHEN SUM(net_amount) > 0
            THEN (SUM(net_amount) - SUM(qty * cost_price)) / SUM(net_amount) * 100
            ELSE 0
          END, 1)                                                          AS margin_pct,
        ROUND(SUM(discount_share), 3)                                    AS total_discount
      FROM items
      GROUP BY product_id, sku, product_name
      ORDER BY gross_profit DESC
      LIMIT 200
    `, [co, from, to, category])

    res.json({ data: rows, category, from, to })
  } catch (err) { next(err) }
})

// ── Top Customers ─────────────────────────────────────────────────────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=20
r.get('/top-customers', async (req, res, next) => {
  try {
    const co    = req.user.company_id
    const from  = req.query.from  || new Date().getFullYear() + '-01-01'
    const to    = req.query.to    || new Date().toISOString().slice(0, 10)
    const limit = Math.min(100, parseInt(req.query.limit) || 20)

    const { rows } = await db.query(`
      WITH inv_totals AS (
        SELECT
          customer_id,
          COUNT(*)::int              AS invoice_count,
          SUM(grand_total)::numeric  AS total_revenue,
          SUM(subtotal)::numeric     AS total_subtotal,
          SUM(balance_due)::numeric  AS outstanding,
          MAX(invoice_date)          AS last_invoice_date
        FROM invoices
        WHERE company_id     = $1
          AND type           = 'tax_invoice'
          AND payment_status != 'void'
          AND invoice_date BETWEEN $2 AND $3
        GROUP BY customer_id
      ),
      cogs_totals AS (
        SELECT
          i.customer_id,
          SUM(ii.qty::numeric * COALESCE(p.cost_price, 0)::numeric) AS total_cogs
        FROM invoice_items ii
        JOIN invoices  i ON ii.invoice_id  = i.id
        JOIN products  p ON ii.product_id  = p.id
        WHERE i.company_id     = $1
          AND i.type           = 'tax_invoice'
          AND i.payment_status != 'void'
          AND i.invoice_date BETWEEN $2 AND $3
        GROUP BY i.customer_id
      )
      SELECT
        c.id, c.code, c.name,
        COALESCE(c.customer_category, c.type::text, 'customer') AS category,
        c.price_tier,
        it.invoice_count,
        ROUND(it.total_revenue,  3)                          AS total_revenue,
        ROUND(it.outstanding,    3)                          AS outstanding,
        ROUND(COALESCE(ct.total_cogs, 0), 3)                AS total_cogs,
        ROUND(it.total_subtotal - COALESCE(ct.total_cogs, 0), 3) AS est_gross_profit,
        ROUND(
          CASE WHEN it.total_subtotal > 0
            THEN (it.total_subtotal - COALESCE(ct.total_cogs, 0)) / it.total_subtotal * 100
            ELSE 0
          END, 1)                                            AS est_margin_pct,
        it.last_invoice_date,
        (CURRENT_DATE - it.last_invoice_date::date)::int    AS days_since_last
      FROM customers c
      JOIN inv_totals  it ON it.customer_id = c.id
      LEFT JOIN cogs_totals ct ON ct.customer_id = c.id
      WHERE c.company_id = $1
      ORDER BY total_revenue DESC
      LIMIT $4
    `, [co, from, to, limit])

    res.json({ data: rows, from, to })
  } catch (err) { next(err) }
})

// ── Supplier Pricing ──────────────────────────────────────────────────────────
// ?months=12&q=<search>&category_id=<uuid>
r.get('/supplier-pricing', async (req, res, next) => {
  try {
    const co     = req.user.company_id
    const months = Math.max(1, parseInt(req.query.months) || 12)

    const params = [co, months]
    const filters = []
    if (req.query.category_id)
      filters.push(`AND p.category_id = $${params.push(req.query.category_id)}`)
    if (req.query.q)
      filters.push(`AND (p.name ILIKE $${params.push('%' + req.query.q + '%')} OR p.sku ILIKE $${params.length})`)

    const { rows } = await db.query(`
      SELECT
        p.id           AS product_id,
        p.sku,
        p.name         AS product_name,
        COALESCE(cat.name, 'Uncategorised') AS category,
        p.cost_price::numeric  AS master_cost_price,
        p.stock_qty::numeric   AS stock_qty,
        s.id           AS supplier_id,
        s.name         AS supplier_name,
        s.code         AS supplier_code,
        COUNT(pi.id)::int                           AS purchase_count,
        ROUND(SUM(pi.qty)::numeric, 3)              AS total_qty_purchased,
        ROUND(AVG(pi.unit_price)::numeric, 3)       AS avg_unit_price,
        ROUND(MIN(pi.unit_price)::numeric, 3)       AS min_unit_price,
        ROUND(MAX(pi.unit_price)::numeric, 3)       AS max_unit_price,
        MAX(pur.purchase_date)                      AS last_purchase_date
      FROM purchase_items pi
      JOIN purchases pur
        ON  pur.id         = pi.purchase_id
        AND pur.company_id = $1
        AND pur.purchase_date >= CURRENT_DATE - (INTERVAL '1 month' * $2::int)
      JOIN products p
        ON  p.id         = pi.product_id
        AND p.company_id = $1
        AND p.is_active  = TRUE
      JOIN customers s ON s.id = pur.supplier_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE TRUE ${filters.join(' ')}
      GROUP BY p.id, p.sku, p.name, cat.name,
               p.cost_price, p.stock_qty, s.id, s.name, s.code
      ORDER BY p.name, avg_unit_price ASC
      LIMIT 2000
    `, params)

    res.json({ data: rows, months })
  } catch (err) { next(err) }
})

module.exports = r
