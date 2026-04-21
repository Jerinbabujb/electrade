const { Router } = require('express')
const db  = require('../db')
const { v4: uuid } = require('uuid')
const { authenticate, authorize, invalidateAuthCache } = require('../middleware/auth')
const audit    = require('../utils/auditLog')
const emailSvc = require('../services/emailService')

// ── Generic CRUD factory ───────────────────────────────────
const crud = ({ table, idField = 'id', companyField = 'company_id', listSql, getSql, createFn, updateFn }) => {
  const r = Router()
  r.use(authenticate)

  r.get('/', async (req, res, next) => {
    try {
      const sql = listSql || `SELECT * FROM ${table} WHERE ${companyField} = $1 ORDER BY created_at DESC`
      const { rows } = await db.query(sql, [req.user.company_id])
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  r.get('/:id', async (req, res, next) => {
    try {
      const sql = getSql || `SELECT * FROM ${table} WHERE id = $1 AND ${companyField} = $2`
      const { rows: [row] } = await db.query(sql, [req.params.id, req.user.company_id])
      if (!row) return res.status(404).json({ error: { message: 'Not found' } })
      res.json({ data: row })
    } catch (err) { next(err) }
  })

  r.post('/', authorize('admin', 'sales', 'storekeeper'), async (req, res, next) => {
    try {
      const row = await createFn(req, db, uuid)
      res.status(201).json({ data: row })
    } catch (err) { next(err) }
  })

  r.put('/:id', authorize('admin', 'sales', 'storekeeper'), async (req, res, next) => {
    try {
      const row = await updateFn(req, db)
      if (!row) return res.status(404).json({ error: { message: 'Not found or not editable' } })
      res.json({ data: row })
    } catch (err) { next(err) }
  })

  r.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
      await db.query(`UPDATE ${table} SET is_active = false WHERE id = $1 AND ${companyField} = $2`,
        [req.params.id, req.user.company_id])
      res.json({ message: 'Deleted (soft)' })
    } catch (err) { next(err) }
  })

  return r
}

// ── Customers ──────────────────────────────────────────────
module.exports.customersRouter = (() => {
  const r = Router()
  r.use(authenticate)

  // GET /customers?q=&role=customer|supplier&category=retail,wholesale,...
  // role=customer     → is_customer=TRUE  (customers + dual-role entities)
  // role=supplier     → is_supplier=TRUE  (suppliers + dual-role entities)
  // category=retail,. → customer_category filter (retail/wholesale/contractor/government)
  r.get('/', async (req, res, next) => {
    try {
      const { q, role, category } = req.query
      const params = [req.user.company_id]
      const where  = ['company_id = $1', 'is_active = true']
      if (q) {
        params.push(`%${q}%`)
        where.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length} OR cr_number ILIKE $${params.length} OR vat_number ILIKE $${params.length} OR tel ILIKE $${params.length} OR email ILIKE $${params.length})`)
      }
      if (role === 'customer') where.push('is_customer = TRUE')
      if (role === 'supplier') where.push('is_supplier = TRUE')
      if (category) {
        // AR classification filter — independent of role
        const cats = category.split(',').map(t => t.trim()).filter(Boolean)
        params.push(cats)
        where.push(`customer_category = ANY($${params.length}::text[])`)
      }
      const { rows } = await db.query(
        `SELECT * FROM customers WHERE ${where.join(' AND ')} ORDER BY name LIMIT 100`, params)
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  r.get('/:id', async (req, res, next) => {
    try {
      const { rows: [row] } = await db.query(
        `SELECT * FROM customers WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.company_id])
      if (!row) return res.status(404).json({ error: { message: 'Not found' } })
      res.json({ data: row })
    } catch (err) { next(err) }
  })

  r.post('/', authorize('admin', 'sales', 'storekeeper'), async (req, res, next) => {
    try {
      let { code, name, type, customer_category, cr_number, vat_number, address, tel, email,
            credit_limit, payment_terms_days, supplier_payment_terms_days,
            price_tier, category_id, notes,
            is_customer, is_supplier } = req.body
      if (!code || !code.trim()) {
        const { rows: [cnt] } = await db.query(`SELECT COUNT(*) AS n FROM customers WHERE company_id=$1`, [req.user.company_id])
        code = 'C' + String(parseInt(cnt.n) + 1).padStart(3, '0')
      }
      const resolvedType = type || 'retail'
      // Derive role flags if not explicitly supplied
      const isCust = is_customer !== undefined ? !!is_customer : (resolvedType !== 'supplier')
      const isSupp = is_supplier !== undefined ? !!is_supplier : (resolvedType === 'supplier')
      // customer_category: explicit value > derived from type > null for pure suppliers
      const resolvedCategory = customer_category || (isCust ? (resolvedType !== 'supplier' ? resolvedType : 'retail') : null)
      const { rows: [row] } = await db.query(
        `INSERT INTO customers (id,company_id,code,name,type,customer_category,cr_number,vat_number,address,tel,email,credit_limit,payment_terms_days,supplier_payment_terms_days,price_tier,category_id,notes,is_customer,is_supplier)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
        [uuid(), req.user.company_id, code, name, resolvedType, resolvedCategory, cr_number, vat_number,
         address, tel, email, credit_limit||0, payment_terms_days||30,
         supplier_payment_terms_days||null, price_tier||1, category_id||null, notes,
         isCust, isSupp])
      res.status(201).json({ data: row })
    } catch (err) { next(err) }
  })

  r.put('/:id', authorize('admin', 'sales', 'storekeeper'), async (req, res, next) => {
    try {
      const { name, type, customer_category, cr_number, vat_number, address, tel, email,
              credit_limit, payment_terms_days, supplier_payment_terms_days,
              price_tier, notes,
              linked_supplier_id, is_customer, is_supplier } = req.body
      // Optional fields: pass undefined to leave unchanged
      const linkVal = linked_supplier_id === undefined ? undefined : (linked_supplier_id || null)
      const custVal = is_customer === undefined ? undefined : !!is_customer
      const suppVal = is_supplier === undefined ? undefined : !!is_supplier
      const suppTerms = supplier_payment_terms_days === undefined ? undefined
                      : (supplier_payment_terms_days === null || supplier_payment_terms_days === ''
                          ? null : parseInt(supplier_payment_terms_days))
      const catVal = customer_category === undefined ? undefined : (customer_category || null)

      // Build dynamic SET clause for optional fields
      const extras = []
      const vals   = [name, type, cr_number, vat_number, address, tel, email,
                      credit_limit, payment_terms_days, price_tier, notes,
                      req.params.id, req.user.company_id]
      if (linkVal    !== undefined) { vals.push(linkVal);    extras.push(`,linked_supplier_id=$${vals.length}`) }
      if (custVal    !== undefined) { vals.push(custVal);    extras.push(`,is_customer=$${vals.length}`) }
      if (suppVal    !== undefined) { vals.push(suppVal);    extras.push(`,is_supplier=$${vals.length}`) }
      if (suppTerms  !== undefined) { vals.push(suppTerms);  extras.push(`,supplier_payment_terms_days=$${vals.length}`) }
      if (catVal     !== undefined) { vals.push(catVal);     extras.push(`,customer_category=$${vals.length}`) }

      const { rows: [row] } = await db.query(
        `UPDATE customers SET name=$1,type=$2,cr_number=$3,vat_number=$4,address=$5,tel=$6,email=$7,
           credit_limit=$8,payment_terms_days=$9,price_tier=$10,notes=$11
           ${extras.join('')}
         WHERE id=$12 AND company_id=$13 RETURNING *`,
        vals
      )
      if (!row) return res.status(404).json({ error: { message: 'Not found or not editable' } })
      res.json({ data: row })
    } catch (err) { next(err) }
  })

  r.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
      await db.query(`UPDATE customers SET is_active = false WHERE id = $1 AND company_id = $2`,
        [req.params.id, req.user.company_id])
      res.json({ message: 'Deleted (soft)' })
    } catch (err) { next(err) }
  })

  return r
})()

// ── Products ───────────────────────────────────────────────
module.exports.productsRouter = (() => {
  const r = Router()
  r.use(authenticate)

  r.get('/', async (req, res, next) => {
    try {
      const { q, category_id, low_stock } = req.query
      let where = ['p.company_id = $1', 'p.is_active = true']
      const params = [req.user.company_id]
      if (q)           { params.push(`%${q}%`); where.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode = $${params.length})`) }
      if (category_id) { params.push(category_id); where.push(`p.category_id = $${params.length}`) }
      if (low_stock === 'true') where.push(`p.stock_qty <= p.stock_min`)
      const { rows } = await db.query(
        `SELECT p.*, cat.name AS category_name FROM products p
         LEFT JOIN categories cat ON cat.id = p.category_id
         WHERE ${where.join(' AND ')} ORDER BY cat.name, p.name`, params)
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  // ── Cycle count sessions — all must be BEFORE /:id ───────────
  r.get('/count-sessions', async (req, res, next) => {
    try {
      const { rows } = await db.query(`
        SELECT s.*,
               cat.name AS category_name,
               u.name   AS created_by_name,
               COUNT(i.id)::int               AS item_count,
               COUNT(i.physical_qty)::int      AS counted_items,
               COUNT(CASE WHEN ABS(COALESCE(i.physical_qty,0) - i.system_qty) >= 0.001 AND i.physical_qty IS NOT NULL THEN 1 END)::int AS variance_count
        FROM stock_count_sessions s
        LEFT JOIN categories cat ON cat.id = s.category_id
        LEFT JOIN users u ON u.id = s.created_by
        LEFT JOIN stock_count_session_items i ON i.session_id = s.id
        WHERE s.company_id = $1
        GROUP BY s.id, cat.name, u.name
        ORDER BY s.created_at DESC
      `, [req.user.company_id])
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  r.post('/count-sessions', authorize('admin','storekeeper'), async (req, res, next) => {
    try {
      const { name, category_id, notes } = req.body
      if (!name || !name.trim()) return res.status(400).json({ error: { message: 'Session name required' } })

      const { rows: [session] } = await db.query(`
        INSERT INTO stock_count_sessions (company_id, name, category_id, notes, created_by)
        VALUES ($1,$2,$3,$4,$5) RETURNING *
      `, [req.user.company_id, name.trim(), category_id || null, notes || null, req.user.id])

      let productWhere = 'p.company_id = $1 AND p.is_active = true AND p.is_stock_tracked = true'
      const params = [req.user.company_id]
      if (category_id) { params.push(category_id); productWhere += ` AND p.category_id = $${params.length}` }

      const { rows: products } = await db.query(
        `SELECT id, stock_qty FROM products p WHERE ${productWhere}`, params)

      for (const p of products) {
        await db.query(`
          INSERT INTO stock_count_session_items (session_id, product_id, system_qty)
          VALUES ($1,$2,$3) ON CONFLICT (session_id, product_id) DO NOTHING
        `, [session.id, p.id, parseFloat(p.stock_qty) || 0])
      }

      res.status(201).json({ data: session })
    } catch (err) { next(err) }
  })

  r.get('/count-sessions/:sid', async (req, res, next) => {
    try {
      const { rows: [session] } = await db.query(`
        SELECT s.*, cat.name AS category_name, u.name AS created_by_name
        FROM stock_count_sessions s
        LEFT JOIN categories cat ON cat.id = s.category_id
        LEFT JOIN users u ON u.id = s.created_by
        WHERE s.id = $1 AND s.company_id = $2
      `, [req.params.sid, req.user.company_id])
      if (!session) return res.status(404).json({ error: { message: 'Session not found' } })

      const { rows: items } = await db.query(`
        SELECT i.*, p.sku, p.name AS product_name, p.unit, p.stock_min,
               p.stock_qty AS current_system_qty,
               cat.name AS category_name
        FROM stock_count_session_items i
        JOIN products p ON p.id = i.product_id
        LEFT JOIN categories cat ON cat.id = p.category_id
        WHERE i.session_id = $1
        ORDER BY cat.name NULLS LAST, p.name
      `, [req.params.sid])

      res.json({ data: { ...session, items } })
    } catch (err) { next(err) }
  })

  r.put('/count-sessions/:sid', authorize('admin','storekeeper'), async (req, res, next) => {
    try {
      const { name, notes, items } = req.body
      const { rows: [session] } = await db.query(
        `SELECT * FROM stock_count_sessions WHERE id=$1 AND company_id=$2`,
        [req.params.sid, req.user.company_id])
      if (!session) return res.status(404).json({ error: { message: 'Session not found' } })
      if (session.status === 'complete') return res.status(400).json({ error: { message: 'Cannot edit a completed session' } })

      if (name !== undefined || notes !== undefined) {
        await db.query(
          `UPDATE stock_count_sessions SET name=COALESCE($1,name), notes=COALESCE($2,notes) WHERE id=$3`,
          [name || null, notes !== undefined ? notes : null, req.params.sid])
      }

      if (Array.isArray(items)) {
        for (const it of items) {
          const pq = it.physical_qty !== '' && it.physical_qty !== null && it.physical_qty !== undefined
            ? parseFloat(it.physical_qty) : null
          await db.query(`
            UPDATE stock_count_session_items
            SET physical_qty = $1, counted_at = CASE WHEN $1 IS NOT NULL THEN now() ELSE counted_at END
            WHERE session_id = $2 AND product_id = $3
          `, [pq, req.params.sid, it.product_id])
        }
      }

      res.json({ message: 'Draft saved' })
    } catch (err) { next(err) }
  })

  r.post('/count-sessions/:sid/apply', authorize('admin','storekeeper'), async (req, res, next) => {
    try {
      const { rows: [session] } = await db.query(
        `SELECT * FROM stock_count_sessions WHERE id=$1 AND company_id=$2`,
        [req.params.sid, req.user.company_id])
      if (!session) return res.status(404).json({ error: { message: 'Session not found' } })
      if (session.status === 'complete') return res.status(400).json({ error: { message: 'Session already applied' } })

      const { rows: items } = await db.query(`
        SELECT i.product_id, i.physical_qty, p.stock_qty
        FROM stock_count_session_items i
        JOIN products p ON p.id = i.product_id
        WHERE i.session_id = $1 AND i.physical_qty IS NOT NULL
      `, [req.params.sid])

      let applied = 0, skipped = 0
      const countNotes = `Cycle count: ${session.name}`

      await db.withTransaction(async (client) => {
        for (const it of items) {
          const pq       = parseFloat(it.physical_qty)
          const sysQty   = parseFloat(it.stock_qty)
          const variance = pq - sysQty
          if (Math.abs(variance) < 0.001) { skipped++; continue }

          await client.query(`
            INSERT INTO stock_movements (id,company_id,product_id,movement_type,qty,ref_type,notes,created_by)
            VALUES ($1,$2,$3,'adjustment',$4,'cycle_count',$5,$6)
          `, [uuid(), req.user.company_id, it.product_id, variance, countNotes, req.user.id])
          applied++
        }

        await client.query(
          `UPDATE stock_count_sessions SET status='complete', completed_at=now() WHERE id=$1`,
          [req.params.sid])
      })

      res.json({ message: `Cycle count applied: ${applied} adjusted, ${skipped} unchanged.`, applied, skipped })
    } catch (err) { next(err) }
  })

  r.delete('/count-sessions/:sid', authorize('admin','storekeeper'), async (req, res, next) => {
    try {
      const { rows: [session] } = await db.query(
        `SELECT status FROM stock_count_sessions WHERE id=$1 AND company_id=$2`,
        [req.params.sid, req.user.company_id])
      if (!session) return res.status(404).json({ error: { message: 'Session not found' } })
      if (session.status === 'complete') return res.status(400).json({ error: { message: 'Cannot delete a completed session' } })
      await db.query(`DELETE FROM stock_count_sessions WHERE id=$1`, [req.params.sid])
      res.json({ message: 'Session deleted' })
    } catch (err) { next(err) }
  })

  // Barcode / SKU exact lookup — must be BEFORE /:id
  r.get('/lookup', async (req, res, next) => {
    try {
      const { barcode, sku } = req.query
      if (!barcode && !sku) return res.status(400).json({ error: { message: 'barcode or sku required' } })
      let where = ['p.company_id = $1', 'p.is_active = true']
      const params = [req.user.company_id]
      if (barcode) { params.push(barcode); where.push(`p.barcode = $${params.length}`) }
      else         { params.push(sku);     where.push(`p.sku = $${params.length}`) }
      const { rows: [p] } = await db.query(
        `SELECT p.*, cat.name AS category_name FROM products p
         LEFT JOIN categories cat ON cat.id = p.category_id
         WHERE ${where.join(' AND ')} LIMIT 1`, params)
      if (!p) return res.status(404).json({ error: { message: 'No product found for that barcode / SKU' } })
      res.json({ data: p })
    } catch (err) { next(err) }
  })

  r.get('/:id', async (req, res, next) => {
    try {
      const { rows: [p] } = await db.query(
        `SELECT p.*, cat.name AS category_name FROM products p
         LEFT JOIN categories cat ON cat.id = p.category_id
         WHERE p.id = $1 AND p.company_id = $2`, [req.params.id, req.user.company_id])
      if (!p) return res.status(404).json({ error: { message: 'Product not found' } })
      res.json({ data: p })
    } catch (err) { next(err) }
  })

  r.get('/:id/stock-history', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT sm.*, u.name AS created_by_name FROM stock_movements sm
         LEFT JOIN users u ON u.id = sm.created_by
         WHERE sm.product_id = $1 ORDER BY sm.created_at DESC LIMIT 100`,
        [req.params.id])
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  r.post('/', authorize('admin','sales','storekeeper'), async (req, res, next) => {
    try {
      const f = req.body
      // non_stock and service products never track stock
      const productType    = ['stock','non_stock','service'].includes(f.product_type) ? f.product_type : 'stock'
      const isStockTracked = productType === 'stock' ? (f.is_stock_tracked !== false) : false
      const { rows: [p] } = await db.query(
        `INSERT INTO products (id,company_id,sku,barcode,name,description,category_id,brand,country_of_origin,
           unit,box_qty,voltage_rating,ampere_rating,wattage,cost_price,price_1,price_2,price_3,price_4,
           vat_rate,stock_min,is_stock_tracked,is_sales_item,is_purchase_item,product_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING *`,
        [uuid(),req.user.company_id,f.sku,f.barcode||null,f.name,f.description||null,f.category_id||null,
         f.brand||null,f.country_of_origin||null,f.unit||'pcs',f.box_qty||1,
         f.voltage_rating||null,f.ampere_rating||null,f.wattage||null,
         f.cost_price||0,f.price_1||0,f.price_2||0,f.price_3||0,f.price_4||0,
         f.vat_rate||10,f.stock_min||0,isStockTracked,f.is_sales_item!==false,f.is_purchase_item!==false,productType])
      res.status(201).json({ data: p })
    } catch (err) { next(err) }
  })

  r.put('/:id', authorize('admin','sales','storekeeper'), async (req, res, next) => {
    try {
      const f = req.body
      const productType    = ['stock','non_stock','service'].includes(f.product_type) ? f.product_type : 'stock'
      const isStockTracked = productType === 'stock' ? (f.is_stock_tracked !== false) : false
      const { rows: [p] } = await db.query(
        `UPDATE products SET sku=$1,barcode=$2,name=$3,description=$4,category_id=$5,brand=$6,
           country_of_origin=$7,unit=$8,box_qty=$9,voltage_rating=$10,ampere_rating=$11,wattage=$12,
           cost_price=$13,price_1=$14,price_2=$15,price_3=$16,price_4=$17,vat_rate=$18,
           stock_min=$19,is_stock_tracked=$20,product_type=$21,updated_at=now()
         WHERE id=$22 AND company_id=$23 RETURNING *`,
        [f.sku,f.barcode||null,f.name,f.description||null,f.category_id||null,f.brand||null,
         f.country_of_origin||null,f.unit||'pcs',f.box_qty||1,
         f.voltage_rating||null,f.ampere_rating||null,f.wattage||null,
         f.cost_price||0,f.price_1||0,f.price_2||0,f.price_3||0,f.price_4||0,
         f.vat_rate||10,f.stock_min||0,isStockTracked,productType,req.params.id,req.user.company_id])
      res.json({ data: p })
    } catch (err) { next(err) }
  })

  // Manual stock adjustment (single product, delta qty)
  r.post('/:id/adjust', authorize('admin','storekeeper'), async (req, res, next) => {
    try {
      const { qty, notes } = req.body
      await db.query(
        `INSERT INTO stock_movements (id,company_id,product_id,movement_type,qty,ref_type,notes,created_by)
         VALUES ($1,$2,$3,'adjustment',$4,'manual',$5,$6)`,
        [uuid(),req.user.company_id,req.params.id,qty,notes||'Manual adjustment',req.user.id])
      res.json({ message: `Stock adjusted by ${qty}` })
    } catch (err) { next(err) }
  })

  // Bulk physical stock count — sets actual qty for each product, records variance
  r.post('/stock-count', authorize('admin','storekeeper'), async (req, res, next) => {
    try {
      const { adjustments, count_notes } = req.body
      if (!Array.isArray(adjustments) || !adjustments.length)
        return res.status(400).json({ error: { message: 'No adjustments provided' } })

      let applied = 0, skipped = 0
      await db.withTransaction(async (client) => {
        for (const adj of adjustments) {
          const { product_id, physical_qty } = adj
          const pq = parseFloat(physical_qty)
          if (isNaN(pq)) { skipped++; continue }

          const { rows: [prod] } = await client.query(
            `SELECT stock_qty FROM products WHERE id=$1 AND company_id=$2`,
            [product_id, req.user.company_id])
          if (!prod) { skipped++; continue }

          const variance = pq - parseFloat(prod.stock_qty)
          if (Math.abs(variance) < 0.001) { skipped++; continue }

          await client.query(
            `INSERT INTO stock_movements (id,company_id,product_id,movement_type,qty,ref_type,notes,created_by)
             VALUES ($1,$2,$3,'adjustment',$4,'manual',$5,$6)`,
            [uuid(), req.user.company_id, product_id,
             variance,
             count_notes || 'Physical stock count',
             req.user.id])
          applied++
        }
      })
      res.json({ message: `Stock count applied: ${applied} products adjusted, ${skipped} unchanged.`, applied, skipped })
    } catch (err) { next(err) }
  })

  return r
})()

// ── Categories ─────────────────────────────────────────────
module.exports.categoriesRouter = (() => {
  const r = Router()
  r.use(authenticate)
  r.get('/', async (req, res, next) => {
    try {
      const { type } = req.query
      let where = ['company_id = $1']
      const params = [req.user.company_id]
      if (type) { params.push(type); where.push(`type = $${params.length}`) }
      const { rows } = await db.query(`SELECT * FROM categories WHERE ${where.join(' AND ')} ORDER BY sort_order, name`, params)
      res.json({ data: rows })
    } catch (err) { next(err) }
  })
  r.post('/', authorize('admin'), async (req, res, next) => {
    try {
      const { name, type, parent_id } = req.body
      const { rows: [row] } = await db.query(
        `INSERT INTO categories (id,company_id,name,type,parent_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [uuid(), req.user.company_id, name, type, parent_id||null])
      res.status(201).json({ data: row })
    } catch (err) { next(err) }
  })
  r.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
      await db.query(`DELETE FROM categories WHERE id=$1 AND company_id=$2`, [req.params.id, req.user.company_id])
      res.json({ message: 'Deleted' })
    } catch (err) { next(err) }
  })
  return r
})()

// ── Purchases ──────────────────────────────────────────────
module.exports.purchasesRouter = (() => {
  const r = Router()
  r.use(authenticate)

  r.get('/', async (req, res, next) => {
    try {
      const { q, status, supplier_id, from, to, limit: lim, offset: off } = req.query
      const limit  = Math.min(parseInt(lim  || 100), 500)
      const offset = Math.max(parseInt(off  || 0),   0)
      const params = [req.user.company_id]
      const where  = ['pur.company_id = $1']

      if (status)      { params.push(status);      where.push(`pur.payment_status = $${params.length}`) }
      if (supplier_id) { params.push(supplier_id); where.push(`pur.supplier_id = $${params.length}`) }
      if (from)        { params.push(from);        where.push(`pur.purchase_date >= $${params.length}`) }
      if (to)          { params.push(to);          where.push(`pur.purchase_date <= $${params.length}`) }
      if (q)           { params.push(`%${q}%`);    where.push(`(pur.purchase_no ILIKE $${params.length} OR c.name ILIKE $${params.length} OR pur.supplier_invoice_no ILIKE $${params.length})`) }

      const whereStr = where.join(' AND ')
      const [{ rows }, { rows: [countRow] }] = await Promise.all([
        db.query(
          `SELECT pur.*, c.name AS supplier_name FROM purchases pur
           JOIN customers c ON c.id = pur.supplier_id
           WHERE ${whereStr}
           ORDER BY pur.purchase_date DESC, pur.purchase_no DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]),
        db.query(
          `SELECT COUNT(*)::int AS total FROM purchases pur
           JOIN customers c ON c.id = pur.supplier_id
           WHERE ${whereStr}`,
          params),
      ])
      res.json({ data: rows, total: countRow.total })
    } catch (err) { next(err) }
  })

  r.get('/:id', async (req, res, next) => {
    try {
      const { rows: [pur] } = await db.query(
        `SELECT pur.*, c.name AS supplier_name FROM purchases pur
         JOIN customers c ON c.id = pur.supplier_id
         WHERE pur.id = $1 AND pur.company_id = $2`, [req.params.id, req.user.company_id])
      if (!pur) return res.status(404).json({ error: { message: 'Not found' } })
      const { rows: items } = await db.query(
        `SELECT * FROM purchase_items WHERE purchase_id = $1 ORDER BY line_no`, [req.params.id])
      res.json({ data: { ...pur, items } })
    } catch (err) { next(err) }
  })

  r.post('/', authorize('admin','storekeeper'), async (req, res, next) => {
    try {
      const { supplier_id, supplier_invoice_no, purchase_date, due_date, items = [], notes } = req.body

      const result = await db.withTransaction(async (client) => {
        const { rows: [co] } = await client.query(
          `UPDATE companies SET next_pur_seq = next_pur_seq + 1
           WHERE id = $1 RETURNING po_prefix, next_pur_seq - 1 AS seq`, [req.user.company_id])
        const purchase_no = `${co.po_prefix}-${new Date().getFullYear()}-${String(co.seq).padStart(4,'0')}`

        const subtotal   = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
        const total_vat  = items.reduce((s, i) => s + i.qty * i.unit_price * (i.vat_rate||10) / 100, 0)
        const grand_total = subtotal + total_vat

        // If due_date not provided, auto-calculate from supplier's payment terms
        let resolvedDueDate = due_date || null
        if (!resolvedDueDate && supplier_id) {
          const { rows: [sup] } = await client.query(
            `SELECT COALESCE(supplier_payment_terms_days, payment_terms_days, 30) AS terms
             FROM customers WHERE id = $1`, [supplier_id])
          if (sup) {
            const base = new Date(purchase_date || new Date())
            base.setDate(base.getDate() + sup.terms)
            resolvedDueDate = base.toISOString().split('T')[0]
          }
        }

        const { rows: [pur] } = await client.query(
          `INSERT INTO purchases (id,company_id,purchase_no,supplier_id,supplier_invoice_no,purchase_date,due_date,subtotal,total_vat,grand_total,notes,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [uuid(),req.user.company_id,purchase_no,supplier_id,supplier_invoice_no||null,
           purchase_date||new Date(),resolvedDueDate,subtotal.toFixed(3),total_vat.toFixed(3),grand_total.toFixed(3),notes,req.user.id])

        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          await client.query(
            `INSERT INTO purchase_items (id,purchase_id,product_id,line_no,part_no,description,qty,unit,unit_price,vat_rate)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [uuid(),pur.id,it.product_id||null,i+1,it.part_no||null,it.description,it.qty,it.unit||'pcs',it.unit_price,it.vat_rate||10])
        }
        return pur
      })

      res.status(201).json({ data: result, message: `${result.purchase_no} created — stock updated` })
    } catch (err) { next(err) }
  })

  // Record payment against purchase
  r.post('/:id/payments', authorize('admin','accountant'), async (req, res, next) => {
    try {
      const { amount, method, payment_date, reference_no, reference, notes } = req.body
      const ref = reference_no || reference || null
      await db.withTransaction(async (client) => {
        const { rows: [pur] } = await client.query(
          `SELECT * FROM purchases WHERE id=$1 AND company_id=$2`, [req.params.id, req.user.company_id])
        if (!pur) throw Object.assign(new Error('Purchase not found'), { status: 404 })
        await client.query(
          `INSERT INTO payments (id,company_id,reference_type,reference_id,payment_date,amount,method,reference_no,notes,created_by)
           VALUES ($1,$2,'purchase',$3,$4,$5,$6,$7,$8,$9)`,
          [uuid(),req.user.company_id,req.params.id,payment_date||new Date(),
           amount,method||'bank_transfer',ref,notes||null,req.user.id])
        // update amount_paid + status
        await client.query(
          `UPDATE purchases SET
             amount_paid = amount_paid + $1,
             payment_status = CASE
               WHEN amount_paid + $1 >= grand_total THEN 'paid'
               WHEN amount_paid + $1 > 0 THEN 'partial'
               ELSE payment_status END
           WHERE id = $2`, [amount, req.params.id])
      })
      res.status(201).json({ message: 'Payment recorded' })
    } catch (err) { next(err) }
  })

  r.get('/:id/payments', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT * FROM payments WHERE reference_id=$1 ORDER BY payment_date DESC`, [req.params.id])
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  // Delete purchase (only unpaid)
  r.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
      const { rows: [pur] } = await db.query(
        `SELECT * FROM purchases WHERE id=$1 AND company_id=$2`, [req.params.id, req.user.company_id])
      if (!pur) return res.status(404).json({ error: { message: 'Not found' } })
      if (pur.payment_status === 'paid') return res.status(400).json({ error: { message: 'Cannot delete a fully paid purchase' } })
      await db.query(`DELETE FROM purchases WHERE id=$1`, [req.params.id])
      res.json({ message: `${pur.purchase_no} deleted` })
    } catch (err) { next(err) }
  })

  return r
})()

// ── Expenses ───────────────────────────────────────────────
module.exports.expensesRouter = (() => {
  const r = Router()
  r.use(authenticate)

  r.get('/', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT e.*, cat.name AS category_name FROM expenses e
         LEFT JOIN categories cat ON cat.id = e.category_id
         WHERE e.company_id = $1 ORDER BY e.expense_date DESC`, [req.user.company_id])
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  r.post('/', authorize('admin','accountant'), async (req, res, next) => {
    try {
      const { category_id, supplier_id, expense_date, description, net_amount, vat_amount, notes } = req.body
      const { rows: [co] } = await db.query(
        `SELECT COUNT(*) AS cnt FROM expenses WHERE company_id = $1`, [req.user.company_id])
      const expense_no = `EXP-${new Date().getFullYear()}-${String(parseInt(co.cnt)+1).padStart(4,'0')}`
      const total_amount = parseFloat(net_amount) + parseFloat(vat_amount||0)
      const { rows: [row] } = await db.query(
        `INSERT INTO expenses (id,company_id,expense_no,category_id,supplier_id,expense_date,description,net_amount,vat_amount,total_amount,notes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [uuid(),req.user.company_id,expense_no,category_id||null,supplier_id||null,
         expense_date||new Date(),description,net_amount,vat_amount||0,total_amount.toFixed(3),notes,req.user.id])
      res.status(201).json({ data: row })
    } catch (err) { next(err) }
  })

  r.put('/:id', authorize('admin','accountant'), async (req, res, next) => {
    try {
      const { category_id, expense_date, description, net_amount, vat_amount, notes } = req.body
      const total_amount = parseFloat(net_amount) + parseFloat(vat_amount||0)
      const { rows: [row] } = await db.query(
        `UPDATE expenses SET category_id=$1, expense_date=$2, description=$3,
           net_amount=$4, vat_amount=$5, total_amount=$6, notes=$7
         WHERE id=$8 AND company_id=$9 RETURNING *`,
        [category_id||null, expense_date, description, net_amount, vat_amount||0,
         total_amount.toFixed(3), notes||null, req.params.id, req.user.company_id])
      if (!row) return res.status(404).json({ error: { message: 'Not found' } })
      res.json({ data: row })
    } catch (err) { next(err) }
  })

  r.delete('/:id', authorize('admin','accountant'), async (req, res, next) => {
    try {
      const { rows: [row] } = await db.query(
        `DELETE FROM expenses WHERE id=$1 AND company_id=$2 RETURNING expense_no`, [req.params.id, req.user.company_id])
      if (!row) return res.status(404).json({ error: { message: 'Not found' } })
      res.json({ message: `${row.expense_no} deleted` })
    } catch (err) { next(err) }
  })

  return r
})()

// ── Recurring expense templates ────────────────────────────
module.exports.recurringExpensesRouter = (() => {
  const r = Router()
  r.use(authenticate)

  // ── Helpers ────────────────────────────────────────────
  function nextDueDate(frequency, dayOfMonth, fromDate) {
    const d = fromDate ? new Date(fromDate) : new Date()
    const dom = Math.min(dayOfMonth || 1, 28)
    switch (frequency) {
      case 'weekly': {
        const n = new Date(d)
        n.setDate(n.getDate() + 7)
        return n.toISOString().split('T')[0]
      }
      case 'monthly': {
        const n = new Date(d.getFullYear(), d.getMonth() + 1, dom)
        return n.toISOString().split('T')[0]
      }
      case 'quarterly': {
        const n = new Date(d.getFullYear(), d.getMonth() + 3, dom)
        return n.toISOString().split('T')[0]
      }
      case 'yearly': {
        const n = new Date(d.getFullYear() + 1, d.getMonth(), dom)
        return n.toISOString().split('T')[0]
      }
      default: {
        const n = new Date(d.getFullYear(), d.getMonth() + 1, dom)
        return n.toISOString().split('T')[0]
      }
    }
  }

  // List all templates
  r.get('/', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT t.*, cat.name AS category_name, s.name AS supplier_name
         FROM recurring_expense_templates t
         LEFT JOIN categories cat ON cat.id = t.category_id
         LEFT JOIN customers  s   ON s.id   = t.supplier_id
         WHERE t.company_id = $1
         ORDER BY t.is_active DESC, t.next_due_date ASC`,
        [req.user.company_id])
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  // Create template
  r.post('/', authorize('admin','accountant'), async (req, res, next) => {
    try {
      const { category_id, supplier_id, description, net_amount, vat_amount,
              frequency, day_of_month, next_due_date, end_date, notes } = req.body
      const total = (parseFloat(net_amount||0) + parseFloat(vat_amount||0)).toFixed(3)
      const { rows: [row] } = await db.query(
        `INSERT INTO recurring_expense_templates
           (company_id, category_id, supplier_id, description, net_amount, vat_amount,
            total_amount, frequency, day_of_month, next_due_date, end_date, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::recur_frequency,$9,$10,$11,$12,$13) RETURNING *`,
        [req.user.company_id, category_id||null, supplier_id||null, description,
         net_amount, vat_amount||0, total,
         frequency||'monthly', day_of_month||1,
         next_due_date, end_date||null, notes||null, req.user.id])
      res.status(201).json({ data: row })
    } catch (err) { next(err) }
  })

  // Update template
  r.put('/:id', authorize('admin','accountant'), async (req, res, next) => {
    try {
      const { category_id, supplier_id, description, net_amount, vat_amount,
              frequency, day_of_month, next_due_date, end_date, notes, is_active } = req.body
      const total = (parseFloat(net_amount||0) + parseFloat(vat_amount||0)).toFixed(3)
      const { rows: [row] } = await db.query(
        `UPDATE recurring_expense_templates SET
           category_id=$1, supplier_id=$2, description=$3, net_amount=$4, vat_amount=$5,
           total_amount=$6, frequency=$7::recur_frequency, day_of_month=$8,
           next_due_date=$9, end_date=$10, notes=$11, is_active=$12, updated_at=now()
         WHERE id=$13 AND company_id=$14 RETURNING *`,
        [category_id||null, supplier_id||null, description, net_amount, vat_amount||0, total,
         frequency||'monthly', day_of_month||1, next_due_date, end_date||null,
         notes||null, is_active !== false,
         req.params.id, req.user.company_id])
      if (!row) return res.status(404).json({ error: { message: 'Not found' } })
      res.json({ data: row })
    } catch (err) { next(err) }
  })

  // Toggle active/paused
  r.patch('/:id/toggle', authorize('admin','accountant'), async (req, res, next) => {
    try {
      const { rows: [row] } = await db.query(
        `UPDATE recurring_expense_templates SET is_active = NOT is_active, updated_at = now()
         WHERE id=$1 AND company_id=$2 RETURNING *`,
        [req.params.id, req.user.company_id])
      if (!row) return res.status(404).json({ error: { message: 'Not found' } })
      res.json({ data: row, message: row.is_active ? 'Template activated' : 'Template paused' })
    } catch (err) { next(err) }
  })

  // Delete template
  r.delete('/:id', authorize('admin'), async (req, res, next) => {
    try {
      const { rows: [row] } = await db.query(
        `DELETE FROM recurring_expense_templates WHERE id=$1 AND company_id=$2 RETURNING description`,
        [req.params.id, req.user.company_id])
      if (!row) return res.status(404).json({ error: { message: 'Not found' } })
      res.json({ message: `"${row.description}" deleted` })
    } catch (err) { next(err) }
  })

  // Manual generate — create an expense from this template right now
  r.post('/:id/generate', authorize('admin','accountant'), async (req, res, next) => {
    try {
      const { rows: [tmpl] } = await db.query(
        `SELECT * FROM recurring_expense_templates WHERE id=$1 AND company_id=$2`,
        [req.params.id, req.user.company_id])
      if (!tmpl) return res.status(404).json({ error: { message: 'Not found' } })

      const expense_date = req.body.expense_date || new Date().toISOString().split('T')[0]
      const { rows: [co] } = await db.query(
        `SELECT COUNT(*) AS cnt FROM expenses WHERE company_id = $1`, [tmpl.company_id])
      const expense_no = `EXP-${new Date().getFullYear()}-${String(parseInt(co.cnt)+1).padStart(4,'0')}`

      const client = await db.pool.connect()
      try {
        await client.query('BEGIN')
        const { rows: [exp] } = await client.query(
          `INSERT INTO expenses (id,company_id,expense_no,category_id,supplier_id,expense_date,
             description,net_amount,vat_amount,total_amount,notes,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [uuid(), tmpl.company_id, expense_no, tmpl.category_id, tmpl.supplier_id,
           expense_date, tmpl.description, tmpl.net_amount, tmpl.vat_amount, tmpl.total_amount,
           tmpl.notes, req.user.id])

        const newNext = nextDueDate(tmpl.frequency, tmpl.day_of_month, expense_date)
        await client.query(
          `UPDATE recurring_expense_templates
           SET last_generated=$1, next_due_date=$2, updated_at=now() WHERE id=$3`,
          [expense_date, newNext, tmpl.id])
        await client.query('COMMIT')
        res.status(201).json({ data: exp, next_due_date: newNext })
      } catch (e) { await client.query('ROLLBACK'); throw e }
      finally { client.release() }
    } catch (err) { next(err) }
  })

  return r
})()

// ── Bank reconciliation ────────────────────────────────────
module.exports.bankRouter = (() => {
  const r = Router()
  r.use(authenticate)
  r.use(authorize('admin','accountant'))

  r.get('/accounts', async (req, res, next) => {
    try {
      const { rows } = await db.query(`SELECT * FROM bank_accounts WHERE company_id=$1 AND is_active=true`, [req.user.company_id])
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  r.get('/accounts/:id/transactions', async (req, res, next) => {
    try {
      const { from, to } = req.query
      // $1=account_id, $2=company_id — join through bank_accounts to enforce tenant scope
      let where = ['bt.bank_account_id = $1', 'ba.company_id = $2']
      const params = [req.params.id, req.user.company_id]
      if (from) { params.push(from); where.push(`bt.transaction_date >= $${params.length}`) }
      if (to)   { params.push(to);   where.push(`bt.transaction_date <= $${params.length}`) }
      const { rows } = await db.query(
        `SELECT bt.* FROM bank_transactions bt
         JOIN bank_accounts ba ON ba.id = bt.bank_account_id
         WHERE ${where.join(' AND ')} ORDER BY bt.transaction_date DESC`, params)
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  r.post('/accounts/:id/auto-match', async (req, res, next) => {
    try {
      // Verify account belongs to this company before touching its transactions
      const { rows: [acct] } = await db.query(
        `SELECT id FROM bank_accounts WHERE id=$1 AND company_id=$2`, [req.params.id, req.user.company_id])
      if (!acct) return res.status(404).json({ error: { message: 'Account not found' } })

      // Auto-match: find unmatched transactions and try to match by amount + reference
      const { rows: unmatched } = await db.query(
        `SELECT * FROM bank_transactions WHERE bank_account_id=$1 AND match_status='unmatched'`, [req.params.id])
      let matched = 0
      for (const tx of unmatched) {
        const amount = tx.debit > 0 ? tx.debit : tx.credit
        const { rows: [inv] } = await db.query(
          `SELECT id, invoice_no FROM invoices
           WHERE company_id=$1 AND ABS(grand_total - $2) < 0.01 AND payment_status != 'paid'
           LIMIT 1`, [req.user.company_id, amount])
        if (inv) {
          await db.query(
            `UPDATE bank_transactions SET match_status='matched', ref_type='invoice', ref_id=$1, ref_no=$2
             WHERE id=$3`, [inv.id, inv.invoice_no, tx.id])
          matched++
        }
      }
      res.json({ message: `Auto-matched ${matched} of ${unmatched.length} transactions` })
    } catch (err) { next(err) }
  })

  // Import parsed transactions from frontend CSV parse
  r.post('/accounts/:id/import', async (req, res, next) => {
    try {
      const { rows: [acct] } = await db.query(
        `SELECT * FROM bank_accounts WHERE id=$1 AND company_id=$2`, [req.params.id, req.user.company_id])
      if (!acct) return res.status(404).json({ error: { message: 'Account not found' } })

      const { transactions = [] } = req.body
      if (!transactions.length) return res.status(400).json({ error: { message: 'No transactions provided' } })

      let inserted = 0, skipped = 0
      for (const tx of transactions) {
        // Skip duplicates: same date + description + debit + credit
        const { rows: [exists] } = await db.query(
          `SELECT id FROM bank_transactions
           WHERE bank_account_id=$1 AND transaction_date=$2
             AND description=$3 AND debit=$4 AND credit=$5`,
          [req.params.id, tx.date, tx.description, tx.debit||0, tx.credit||0])
        if (exists) { skipped++; continue }
        await db.query(
          `INSERT INTO bank_transactions (bank_account_id, transaction_date, description, debit, credit, balance)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [req.params.id, tx.date, tx.description, tx.debit||0, tx.credit||0, tx.balance||null])
        inserted++
      }
      res.json({ message: `Imported ${inserted} transactions (${skipped} duplicates skipped)`, inserted, skipped })
    } catch (err) { next(err) }
  })

  r.put('/transactions/:id/match', async (req, res, next) => {
    try {
      const { ref_type, ref_id, ref_no } = req.body
      const { rows: [tx] } = await db.query(
        `SELECT bt.id FROM bank_transactions bt
         JOIN bank_accounts ba ON ba.id = bt.bank_account_id AND ba.company_id = $1
         WHERE bt.id = $2`,
        [req.user.company_id, req.params.id])
      if (!tx) return res.status(404).json({ error: { message: 'Transaction not found' } })
      await db.query(
        `UPDATE bank_transactions SET match_status='manually_matched', ref_type=$1, ref_id=$2, ref_no=$3 WHERE id=$4`,
        [ref_type, ref_id, ref_no, req.params.id])
      res.json({ message: 'Transaction manually matched' })
    } catch (err) { next(err) }
  })

  return r
})()

// ── Companies ──────────────────────────────────────────────
module.exports.companiesRouter = (() => {
  const r = Router()
  r.use(authenticate, authorize('admin'))

  r.get('/', async (req, res, next) => {
    try {
      const { rows: [co] } = await db.query(`SELECT * FROM companies WHERE id=$1`, [req.user.company_id])
      res.json({ data: co })
    } catch (err) { next(err) }
  })

  r.put('/', async (req, res, next) => {
    try {
      const f = req.body
      const hiddenModules = Array.isArray(f.hidden_modules) ? f.hidden_modules : []
      const pdfSettings   = (f.pdf_settings && typeof f.pdf_settings === 'object') ? f.pdf_settings : {}
      const { rows: [co] } = await db.query(
        `UPDATE companies SET name=$1,name_ar=$2,address=$3,tel=$4,email=$5,
           vat_number=$6,cr_number=$7,
           default_vat_rate=$8,bank_name=$9,bank_acct_name=$10,bank_iban=$11,bank_swift=$12,
           theme_color=$13,
           invoice_prefix=COALESCE(NULLIF($14,''),'INV'),
           dn_prefix=COALESCE(NULLIF($15,''),'DN'),
           po_prefix=COALESCE(NULLIF($16,''),'PUR'),
           hidden_modules=$17,
           pdf_settings=$18
         WHERE id=$19 RETURNING *`,
        [f.name,f.name_ar||null,f.address||null,f.tel||null,f.email||null,
         f.vat_number||null,f.cr_number||null,
         f.default_vat_rate||10,f.bank_name||null,f.bank_acct_name||null,f.bank_iban||null,f.bank_swift||null,
         f.theme_color||'#1a5fa8',
         f.invoice_prefix||'INV', f.dn_prefix||'DN', f.po_prefix||'PUR',
         hiddenModules, pdfSettings,
         req.user.company_id])
      res.json({ data: co })
    } catch (err) { next(err) }
  })

  // POST /companies/logo — accepts { logo: 'data:image/png;base64,...' }
  r.post('/logo', async (req, res, next) => {
    try {
      const { logo } = req.body
      if (!logo || !logo.startsWith('data:image/')) {
        return res.status(400).json({ error: { message: 'Invalid image data' } })
      }
      // Limit to ~500 KB base64
      if (logo.length > 700000) {
        return res.status(400).json({ error: { message: 'Image too large — max 500 KB' } })
      }
      await db.query(`UPDATE companies SET logo=$1 WHERE id=$2`, [logo, req.user.company_id])
      res.json({ message: 'Logo saved' })
    } catch (err) { next(err) }
  })

  // DELETE /companies/logo
  r.delete('/logo', async (req, res, next) => {
    try {
      await db.query(`UPDATE companies SET logo=NULL WHERE id=$1`, [req.user.company_id])
      res.json({ message: 'Logo removed' })
    } catch (err) { next(err) }
  })

  // GET /companies/all — all companies this user has access to
  r.get('/all', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT c.id, c.name, c.name_ar, c.cr_number, c.vat_number, c.email, c.tel,
                c.default_vat_rate, c.default_currency, c.logo_url, c.created_at,
                uc.role, uc.is_default,
                (SELECT COUNT(*)::int FROM user_companies WHERE company_id = c.id) AS user_count
         FROM user_companies uc
         JOIN companies c ON c.id = uc.company_id
         WHERE uc.user_id = $1
         ORDER BY uc.is_default DESC, c.name`,
        [req.user.id])
      res.json({ data: rows })
    } catch (err) { next(err) }
  })

  // POST /companies — create a new company (creator is auto-added as admin)
  r.post('/', async (req, res, next) => {
    try {
      const { name, name_ar, cr_number, vat_number, address, tel, email,
              default_vat_rate, default_currency } = req.body
      if (!name || !cr_number || !vat_number)
        return res.status(400).json({ error: { message: 'Name, CR number and VAT number are required' } })

      const co = await db.withTransaction(async (client) => {
        const { rows: [created] } = await client.query(
          `INSERT INTO companies
             (id, name, name_ar, cr_number, vat_number, address, tel, email,
              default_vat_rate, default_currency)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [uuid(), name, name_ar||null, cr_number, vat_number, address||null,
           tel||null, email||null, default_vat_rate||10, default_currency||'BHD'])
        await client.query(
          `INSERT INTO user_companies (id, user_id, company_id, role, is_default)
           VALUES ($1,$2,$3,'admin',false)`,
          [uuid(), req.user.id, created.id])
        return created
      })

      res.status(201).json({ data: co })
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: { message: 'A company with that CR number already exists' } })
      next(err)
    }
  })

  // Helper: require caller to be admin of the target company (not just any member)
  const requireAdminOfCompany = async (userId, companyId) => {
    const { rows: [row] } = await db.query(
      `SELECT role FROM user_companies WHERE user_id=$1 AND company_id=$2`,
      [userId, companyId])
    if (!row)             throw Object.assign(new Error('No access to this company'),          { _status: 403 })
    if (row.role !== 'admin') throw Object.assign(new Error('Admin role required for this company'), { _status: 403 })
  }

  // GET /companies/:id/users — list users with access to a specific company
  r.get('/:id/users', async (req, res, next) => {
    try {
      await requireAdminOfCompany(req.user.id, req.params.id)

      const { rows } = await db.query(
        `SELECT u.id, u.name, u.email, uc.role, u.is_active, uc.is_default, u.last_login
         FROM user_companies uc
         JOIN users u ON u.id = uc.user_id
         WHERE uc.company_id = $1
         ORDER BY u.name`,
        [req.params.id])
      res.json({ data: rows })
    } catch (err) {
      if (err._status) return res.status(err._status).json({ error: { message: err.message } })
      next(err)
    }
  })

  // POST /companies/:id/users — grant an existing user access by email
  r.post('/:id/users', async (req, res, next) => {
    try {
      const { email, role } = req.body
      if (!email) return res.status(400).json({ error: { message: 'Email required' } })

      await requireAdminOfCompany(req.user.id, req.params.id)

      const { rows: [target] } = await db.query(
        `SELECT id, name, email FROM users WHERE email=$1 AND is_active=true`,
        [email.toLowerCase()])
      if (!target) return res.status(404).json({ error: { message: 'No active user found with that email' } })

      await db.query(
        `INSERT INTO user_companies (id, user_id, company_id, role, is_default)
         VALUES ($1,$2,$3,$4,false)
         ON CONFLICT (user_id, company_id) DO UPDATE SET role=$4`,
        [uuid(), target.id, req.params.id, role||'sales'])

      invalidateAuthCache(target.id, req.params.id)
      await audit.log(db, req, 'company.user_added', 'user', target.id, target.name,
        null, { company_id: req.params.id, role: role||'sales' })
      res.status(201).json({ data: { message: `${target.name} added`, user: target } })
    } catch (err) {
      if (err._status) return res.status(err._status).json({ error: { message: err.message } })
      next(err)
    }
  })

  // DELETE /companies/:id/users/:userId — revoke a user's access to a company
  r.delete('/:id/users/:userId', async (req, res, next) => {
    try {
      await requireAdminOfCompany(req.user.id, req.params.id)

      // Prevent self-removal from the currently active company (token would remain valid)
      if (req.params.userId === req.user.id && req.params.id === req.user.company_id)
        return res.status(400).json({ error: { message: 'Cannot remove yourself from your currently active company. Switch to another company first.' } })

      // Prevent removing self if this is their only company globally
      if (req.params.userId === req.user.id) {
        const { rows: [cnt] } = await db.query(
          `SELECT COUNT(*)::int AS n FROM user_companies WHERE user_id=$1`, [req.user.id])
        if (cnt.n <= 1)
          return res.status(400).json({ error: { message: 'Cannot remove yourself from your only company' } })
      }

      // Prevent orphaning: ensure the company keeps at least one admin
      const { rows: [targetUc] } = await db.query(
        `SELECT role FROM user_companies WHERE user_id=$1 AND company_id=$2`,
        [req.params.userId, req.params.id])
      if (targetUc?.role === 'admin') {
        const { rows: [adminCnt] } = await db.query(
          `SELECT COUNT(*)::int AS n FROM user_companies WHERE company_id=$1 AND role='admin'`,
          [req.params.id])
        if (adminCnt.n <= 1)
          return res.status(400).json({ error: { message: 'Cannot remove the last admin of a company. Assign another admin first.' } })
      }

      const { rows: [removedUser] } = await db.query(
        `SELECT name FROM users WHERE id=$1`, [req.params.userId])
      await db.query(
        `DELETE FROM user_companies WHERE user_id=$1 AND company_id=$2`,
        [req.params.userId, req.params.id])
      invalidateAuthCache(req.params.userId, req.params.id)
      await audit.log(db, req, 'company.user_removed', 'user', req.params.userId,
        removedUser?.name, { company_id: req.params.id })
      res.json({ message: 'User removed from company' })
    } catch (err) {
      if (err._status) return res.status(err._status).json({ error: { message: err.message } })
      next(err)
    }
  })

  // POST /companies/:id/invite — send email invite to a new or existing user
  r.post('/:id/invite', async (req, res, next) => {
    try {
      const { email, role } = req.body
      if (!email) return res.status(400).json({ error: { message: 'Email required' } })

      await requireAdminOfCompany(req.user.id, req.params.id)

      const { rows: [co] } = await db.query(
        `SELECT name FROM companies WHERE id=$1`, [req.params.id])

      // Invalidate any prior pending invite for same email+company
      await db.query(
        `DELETE FROM invite_tokens WHERE email=$1 AND company_id=$2 AND accepted_at IS NULL`,
        [email.toLowerCase(), req.params.id])

      const { rows: [inv] } = await db.query(`
        INSERT INTO invite_tokens (company_id, invited_by, email, role)
        VALUES ($1,$2,$3,$4) RETURNING token
      `, [req.params.id, req.user.id, email.toLowerCase(), role || 'sales'])

      const origin = req.headers.origin || 'http://localhost'
      const link   = `${origin}/invite/${inv.token}`

      // Send invite email (best-effort — don't fail if SMTP not configured)
      try {
        await emailSvc.sendInvite({ email: email.toLowerCase(), company_name: co.name, role: role||'sales', link })
      } catch (emailErr) {
        console.warn('[invite] Email failed (SMTP may not be configured):', emailErr.message)
      }

      await audit.log(db, req, 'company.invite_sent', 'user', null, email,
        null, { company_id: req.params.id, role: role||'sales' })

      res.status(201).json({ data: { message: `Invite sent to ${email}`, link } })
    } catch (err) {
      if (err._status) return res.status(err._status).json({ error: { message: err.message } })
      next(err)
    }
  })

  return r
})()
