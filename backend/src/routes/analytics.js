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
          cat.id                                                           AS category_id,
          COALESCE(cat.name, 'Uncategorised')                             AS category,
          ii.net_amount::numeric                                           AS net_amount,
          ii.qty::numeric                                                  AS qty,
          ii.unit_cost::numeric                                            AS unit_cost,
          CASE WHEN i.subtotal > 0
            THEN i.total_discount::numeric * (ii.net_amount::numeric / i.subtotal::numeric)
            ELSE 0
          END                                                              AS discount_share
        FROM invoice_items ii
        JOIN invoices  i   ON  ii.invoice_id  = i.id
        LEFT JOIN products  p   ON  ii.product_id  = p.id
        LEFT JOIN categories cat ON cat.id = p.category_id
        WHERE i.company_id     = $1
          AND i.type           = 'tax_invoice'
          AND i.payment_status != 'void'
          AND i.invoice_date BETWEEN $2 AND $3
      )
      SELECT
        category_id,
        category,
        COUNT(*)::int                                                      AS line_count,
        ROUND(SUM(net_amount),        3)                                  AS net_revenue,
        ROUND(SUM(qty * unit_cost),   3)                                  AS total_cogs,
        ROUND(SUM(net_amount) - SUM(qty * unit_cost), 3)                 AS gross_profit,
        ROUND(
          CASE WHEN SUM(net_amount) > 0
            THEN (SUM(net_amount) - SUM(qty * unit_cost)) / SUM(net_amount) * 100
            ELSE 0
          END, 1)                                                          AS margin_pct,
        ROUND(SUM(discount_share), 3)                                    AS total_discount
      FROM items
      GROUP BY category_id, category
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
// ?category_id=<uuid|null>&from=YYYY-MM-DD&to=YYYY-MM-DD
r.get('/gross-margin/detail', async (req, res, next) => {
  try {
    const co          = req.user.company_id
    const from        = req.query.from || new Date().getFullYear() + '-01-01'
    const to          = req.query.to   || new Date().toISOString().slice(0, 10)
    const isNull      = !req.query.category_id || req.query.category_id === 'null'
    const category_id = isNull ? null : req.query.category_id

    const params      = isNull ? [co, from, to] : [co, from, to, category_id]
    const catFilter   = isNull
      ? 'AND p.category_id IS NULL'
      : 'AND p.category_id = $4'

    const { rows } = await db.query(`
      WITH items AS (
        SELECT
          p.id                                                             AS product_id,
          p.sku,
          p.name                                                           AS product_name,
          ii.net_amount::numeric                                           AS net_amount,
          ii.qty::numeric                                                  AS qty,
          ii.unit_cost::numeric                                            AS unit_cost,
          CASE WHEN i.subtotal > 0
            THEN i.total_discount::numeric * (ii.net_amount::numeric / i.subtotal::numeric)
            ELSE 0
          END                                                              AS discount_share
        FROM invoice_items ii
        JOIN invoices  i   ON  ii.invoice_id  = i.id
        JOIN products  p   ON  ii.product_id  = p.id
        WHERE i.company_id     = $1
          AND i.type           = 'tax_invoice'
          AND i.payment_status != 'void'
          AND i.invoice_date BETWEEN $2 AND $3
          ${catFilter}
      )
      SELECT
        product_id, sku, product_name,
        COUNT(*)::int                                                      AS line_count,
        ROUND(SUM(net_amount),        3)                                  AS net_revenue,
        ROUND(SUM(qty * unit_cost),   3)                                  AS total_cogs,
        ROUND(SUM(net_amount) - SUM(qty * unit_cost), 3)                 AS gross_profit,
        ROUND(
          CASE WHEN SUM(net_amount) > 0
            THEN (SUM(net_amount) - SUM(qty * unit_cost)) / SUM(net_amount) * 100
            ELSE 0
          END, 1)                                                          AS margin_pct,
        ROUND(SUM(discount_share), 3)                                    AS total_discount
      FROM items
      GROUP BY product_id, sku, product_name
      ORDER BY gross_profit DESC
      LIMIT 200
    `, params)

    res.json({ data: rows, category_id, from, to })
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
          SUM(subtotal)::numeric     AS net_revenue,
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
          SUM(ii.qty::numeric * ii.unit_cost::numeric) AS total_cogs
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
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
        ROUND(it.net_revenue,    3)                              AS net_revenue,
        ROUND(it.outstanding,    3)                              AS outstanding,
        ROUND(COALESCE(ct.total_cogs, 0), 3)                    AS total_cogs,
        ROUND(it.net_revenue - COALESCE(ct.total_cogs, 0), 3)  AS est_gross_profit,
        ROUND(
          CASE WHEN it.net_revenue > 0
            THEN (it.net_revenue - COALESCE(ct.total_cogs, 0)) / it.net_revenue * 100
            ELSE 0
          END, 1)                                                AS est_margin_pct,
        it.last_invoice_date,
        (CURRENT_DATE - it.last_invoice_date::date)::int        AS days_since_last
      FROM customers c
      JOIN inv_totals  it ON it.customer_id = c.id
      LEFT JOIN cogs_totals ct ON ct.customer_id = c.id
      WHERE c.company_id = $1
      ORDER BY net_revenue DESC
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

// ── Top Products ──────────────────────────────────────────────────────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=20&category_id=<uuid>&sort=revenue|qty|profit
r.get('/top-products', async (req, res, next) => {
  try {
    const co    = req.user.company_id
    const from  = req.query.from  || new Date().getFullYear() + '-01-01'
    const to    = req.query.to    || new Date().toISOString().slice(0, 10)
    const limit = Math.min(200, parseInt(req.query.limit) || 20)
    const sort  = ['revenue', 'qty', 'profit'].includes(req.query.sort) ? req.query.sort : 'revenue'

    const params = [co, from, to]
    const catFilter = req.query.category_id
      ? `AND p.category_id = $${params.push(req.query.category_id)}`
      : ''

    const orderCol = sort === 'qty' ? 'qty_sold' : sort === 'profit' ? 'gross_profit' : 'net_revenue'

    const { rows } = await db.query(`
      SELECT
        p.id                                                             AS product_id,
        p.sku,
        p.name                                                           AS product_name,
        COALESCE(cat.name, 'Uncategorised')                             AS category,
        COUNT(DISTINCT ii.invoice_id)::int                              AS invoice_count,
        ROUND(SUM(ii.qty::numeric), 3)                                  AS qty_sold,
        ROUND(SUM(ii.net_amount::numeric), 3)                           AS net_revenue,
        ROUND(SUM(ii.qty::numeric * ii.unit_cost::numeric), 3)          AS total_cogs,
        ROUND(SUM(ii.net_amount::numeric)
              - SUM(ii.qty::numeric * ii.unit_cost::numeric), 3)        AS gross_profit,
        ROUND(
          CASE WHEN SUM(ii.net_amount::numeric) > 0
            THEN (SUM(ii.net_amount::numeric)
                  - SUM(ii.qty::numeric * ii.unit_cost::numeric))
                 / SUM(ii.net_amount::numeric) * 100
            ELSE 0
          END, 1)                                                        AS margin_pct
      FROM invoice_items ii
      JOIN invoices  i   ON ii.invoice_id  = i.id
      JOIN products  p   ON ii.product_id  = p.id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE i.company_id     = $1
        AND i.type           = 'tax_invoice'
        AND i.payment_status != 'void'
        AND i.invoice_date BETWEEN $2 AND $3
        ${catFilter}
      GROUP BY p.id, p.sku, p.name, cat.name
      ORDER BY ${orderCol} DESC
      LIMIT $${params.push(limit)}
    `, params)

    res.json({ data: rows, from, to, sort })
  } catch (err) { next(err) }
})

// ── Sales Trend ───────────────────────────────────────────────────────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD&period=month
r.get('/sales-trend', async (req, res, next) => {
  try {
    const co   = req.user.company_id
    const from = req.query.from || (new Date().getFullYear() - 1) + '-01-01'
    const to   = req.query.to   || new Date().toISOString().slice(0, 10)

    const { rows } = await db.query(`
      WITH months AS (
        SELECT
          date_trunc('month', i.invoice_date)::date     AS period_start,
          to_char(i.invoice_date, 'YYYY-MM')            AS period_label,
          COUNT(DISTINCT i.id)::int                     AS invoice_count,
          ROUND(SUM(i.subtotal::numeric), 3)            AS net_revenue
        FROM invoices i
        WHERE i.company_id     = $1
          AND i.type           = 'tax_invoice'
          AND i.payment_status != 'void'
          AND i.invoice_date BETWEEN $2 AND $3
        GROUP BY date_trunc('month', i.invoice_date), to_char(i.invoice_date, 'YYYY-MM')
      ),
      cogs AS (
        SELECT
          date_trunc('month', i.invoice_date)::date     AS period_start,
          ROUND(SUM(ii.qty::numeric * ii.unit_cost::numeric), 3) AS total_cogs,
          ROUND(SUM(ii.qty::numeric), 3)                AS qty_sold
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.company_id     = $1
          AND i.type           = 'tax_invoice'
          AND i.payment_status != 'void'
          AND i.invoice_date BETWEEN $2 AND $3
        GROUP BY date_trunc('month', i.invoice_date)
      )
      SELECT
        m.period_start,
        m.period_label,
        m.invoice_count,
        m.net_revenue,
        COALESCE(c.total_cogs, 0)                                     AS total_cogs,
        ROUND(m.net_revenue - COALESCE(c.total_cogs, 0), 3)           AS gross_profit,
        ROUND(
          CASE WHEN m.net_revenue > 0
            THEN (m.net_revenue - COALESCE(c.total_cogs, 0)) / m.net_revenue * 100
            ELSE 0
          END, 1)                                                      AS margin_pct,
        COALESCE(c.qty_sold, 0)                                        AS qty_sold
      FROM months m
      LEFT JOIN cogs c ON c.period_start = m.period_start
      ORDER BY m.period_start
    `, [co, from, to])

    res.json({ data: rows, from, to })
  } catch (err) { next(err) }
})

// ── Dead Stock ────────────────────────────────────────────────────────────────
// ?days=90&category_id=<uuid>
r.get('/dead-stock', async (req, res, next) => {
  try {
    const co   = req.user.company_id
    const days = Math.max(1, parseInt(req.query.days) || 90)

    const params = [co, days]
    const catFilter = req.query.category_id
      ? `AND p.category_id = $${params.push(req.query.category_id)}`
      : ''

    const { rows } = await db.query(`
      SELECT
        p.id, p.sku, p.name,
        COALESCE(cat.name, 'Uncategorised')             AS category,
        p.stock_qty::numeric                            AS stock_qty,
        p.cost_price::numeric                           AS cost_price,
        ROUND(p.stock_qty::numeric * p.cost_price::numeric, 3) AS stock_value,
        last_sale.last_sale_date,
        CASE
          WHEN last_sale.last_sale_date IS NULL THEN NULL
          ELSE (CURRENT_DATE - last_sale.last_sale_date::date)::int
        END                                             AS days_since_last_sale,
        CASE
          WHEN last_sale.last_sale_date IS NULL THEN 'never_sold'
          ELSE 'no_recent_sale'
        END                                             AS dead_reason
      FROM products p
      LEFT JOIN categories cat ON cat.id = p.category_id
      LEFT JOIN (
        SELECT ii.product_id, MAX(i.invoice_date) AS last_sale_date
        FROM invoice_items ii
        JOIN invoices i
          ON  i.id             = ii.invoice_id
          AND i.company_id     = $1
          AND i.type           = 'tax_invoice'
          AND i.payment_status != 'void'
        GROUP BY ii.product_id
      ) last_sale ON last_sale.product_id = p.id
      WHERE p.company_id     = $1
        AND p.is_active       = TRUE
        AND p.is_stock_tracked = TRUE
        AND p.stock_qty       > 0
        AND (
          last_sale.last_sale_date IS NULL
          OR last_sale.last_sale_date < CURRENT_DATE - ($2::int * INTERVAL '1 day')
        )
        ${catFilter}
      ORDER BY stock_value DESC
      LIMIT 500
    `, params)

    const summary = {
      total_products: rows.length,
      never_sold:     rows.filter(r => r.dead_reason === 'never_sold').length,
      no_recent_sale: rows.filter(r => r.dead_reason === 'no_recent_sale').length,
      total_stock_value: rows.reduce((s, r) => s + +r.stock_value, 0).toFixed(3),
    }

    res.json({ data: rows, summary, period_days: days })
  } catch (err) { next(err) }
})

module.exports = r
