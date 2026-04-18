/**
 * Simple Invoice backup import route
 * POST /api/v1/admin/import-sinvoice
 *
 * Accepts a multipart ZIP upload (field name: "backup").
 * Extracts XML files, imports all data, streams progress via SSE.
 * Admin-only.
 */
const router  = require('express').Router()
const multer  = require('multer')
const AdmZip  = require('adm-zip')
const { XMLParser } = require('fast-xml-parser')
const { v4: uuid } = require('uuid')
const db      = require('../db')
const { authenticate, authorize } = require('../middleware/auth')

// ── Multer: store in memory (max 200 MB) ──────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.zip')) cb(null, true)
    else cb(new Error('Only .zip files are accepted'))
  },
})

router.use(authenticate)
router.use(authorize('admin'))

// ── Constants ─────────────────────────────────────────────────
const SALE_TYPE_MAP = {
  '1': 'tax_invoice',
  '2': 'credit_note',
  '3': 'quotation',
  '4': 'proforma',
  '5': 'receipt',
}

const UNIT_MAP = {
  each:'pcs', ea:'pcs', ech:'pcs', pcs:'pcs', pc:'pcs',
  piece:'pcs', pieces:'pcs', nos:'pcs', 'no.':'pcs', no:'pcs',
  'nos.':'pcs', strip:'pcs', number:'pcs', unit:'pcs', units:'pcs',
  item:'pcs', items:'pcs', length:'pcs',
  mtr:'mtr', m:'mtr', meter:'mtr', metre:'mtr', mts:'mtr',
  meters:'mtr', metres:'mtr', mtrs:'mtr',
  roll:'reel', rolls:'reel', reel:'reel', reels:'reel',
  coil:'reel', coils:'reel',
  pkt:'pack', pack:'pack', packet:'pack', packets:'pack', pkg:'pack',
  kg:'kg', kgs:'kg', kilogram:'kg', kilograms:'kg',
  set:'set', sets:'set', kit:'set',
  box:'box', boxes:'box', bx:'box', carton:'box',
  ltr:'ltr', litre:'ltr', liter:'ltr', litres:'ltr',
  liters:'ltr', l:'ltr', lt:'ltr',
  m2:'m2', sqm:'m2', 'sq.m':'m2', sqft:'m2',
  m3:'m3', cbm:'m3', cum:'m3',
}

// ── Helpers ───────────────────────────────────────────────────
function normUnit(raw) {
  if (!raw) return 'pcs'
  return UNIT_MAP[raw.trim().toLowerCase()] || 'pcs'
}

function parseDate(s) {
  if (!s) return null
  s = String(s).trim()
  // DD/MM/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD-MM-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  return null
}

function flt(val, def = 0) {
  const n = parseFloat(String(val || '').replace(',', '.'))
  return isNaN(n) ? def : n
}

function extractVat(nip, street) {
  for (const text of [nip || '', street || '']) {
    const m = text.match(/\d{15}/)
    if (m) return m[0]
  }
  return null
}

function cleanAddress(street) {
  if (!street) return null
  const lines = String(street).split('\n')
    .filter(l => !/^\s*TRN[:\s]/i.test(l))
  return lines.join('\n').trim() || null
}

// Parse XML buffer → array of row objects
function parseXmlToRows(buffer, rootTag, rowTag) {
  const xmlStr = buffer.toString('utf8').replace(/^\uFEFF/, '') // strip BOM
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: true,
    parseAttributeValue: false,
    isArray: (tagName) => tagName === rowTag,
  })
  let parsed
  try {
    parsed = parser.parse(xmlStr)
  } catch (e) {
    return []
  }
  // Skip '?xml' declaration key — find the actual root element
  const realRootKey = Object.keys(parsed).find(k => k !== '?xml') || ''
  const root = parsed[realRootKey] || {}
  const rows = root[rowTag]
  if (!rows) return []
  return Array.isArray(rows) ? rows : [rows]
}

// Get text value from parsed row (handles both string and number values)
function txt(row, key) {
  const v = row[key]
  if (v == null) return ''
  return String(v).trim()
}

// ── XML loader from ZIP buffer ────────────────────────────────
function loadXmlFiles(zipBuffer) {
  const zip = new AdmZip(zipBuffer)
  const entries = zip.getEntries()

  // Build a case-insensitive name map
  const nameMap = {}
  for (const e of entries) {
    nameMap[e.entryName.toLowerCase()] = e
  }

  function getEntry(filename) {
    const base = filename.toLowerCase()
    // Try common path patterns
    for (const candidate of [
      `1/${base}`, base,
      `1/${filename}`, filename,
    ]) {
      if (nameMap[candidate]) return nameMap[candidate]
    }
    // Case-insensitive suffix match
    for (const [key, entry] of Object.entries(nameMap)) {
      if (key.endsWith('/' + base) || key === base) return entry
    }
    return null
  }

  function getData(filename) {
    const entry = getEntry(filename)
    return entry ? entry.getData() : null
  }

  return {
    categories:       getData('Category.xml'),
    contractors:      getData('Contractors.xml'),
    products:         getData('Product.xml'),
    suppliers:        getData('Suppliers.xml'),
    sales:            getData('Sale.xml'),
    saleItems:        getData('SaleItem.xml'),
    payments:         getData('Payments.xml'),
    purchases:        getData('Purchase.xml'),
    purchaseItems:    getData('PurchaseItem.xml'),
    purchasePayments: getData('PurchasePayment.xml'),
    expenses:         getData('Expenses.xml'),
  }
}

// ── Import functions ──────────────────────────────────────────

async function importCategories(client, companyId, buf) {
  if (!buf) return { map: {}, imported: 0, skipped: 0 }
  const rows = parseXmlToRows(buf, 'NewDataSet', 'Category')
  const catMap = {}
  let imported = 0, skipped = 0

  for (const el of rows) {
    const siId   = txt(el, 'ID')
    const typeId = txt(el, 'TypeID') || '1'
    const name   = txt(el, 'Name')
    if (!siId || !name) continue

    const catType = typeId === '3' ? 'expense' : 'product'

    const existing = await client.query(
      `SELECT id FROM categories WHERE company_id=$1 AND LOWER(name)=$2 AND type=$3::category_type`,
      [companyId, name.toLowerCase(), catType]
    )
    if (existing.rows.length) {
      catMap[siId] = existing.rows[0].id
      skipped++
      continue
    }

    const newId = uuid()
    await client.query(
      `INSERT INTO categories (id, company_id, name, type) VALUES ($1,$2,$3,$4::category_type)`,
      [newId, companyId, name, catType]
    )
    catMap[siId] = newId
    imported++
  }
  return { map: catMap, imported, skipped }
}

async function importCustomers(client, companyId, buf) {
  if (!buf) return { map: {}, imported: 0, skipped: 0 }
  const rows = parseXmlToRows(buf, 'NewDataSet', 'Contractor')

  // Pre-load existing codes
  const codeRes = await client.query(`SELECT code FROM customers WHERE company_id=$1`, [companyId])
  const usedCodes = new Set(codeRes.rows.map(r => r.code))

  function nextCode(prefix, seq) {
    let code = `${prefix}${String(seq).padStart(4, '0')}`
    while (usedCodes.has(code)) { seq++; code = `${prefix}${String(seq).padStart(4, '0')}` }
    usedCodes.add(code)
    return [code, seq]
  }

  const custMap = {}
  let imported = 0, skipped = 0, custSeq = 0, supSeq = 0

  for (const el of rows) {
    const siId  = txt(el, 'ID')
    const name  = txt(el, 'FullName')
    const nip   = txt(el, 'Nip')
    const street = txt(el, 'Street')
    const phone = txt(el, 'Phone') || txt(el, 'Mobile')
    const email = txt(el, 'Email')
    const isSup = txt(el, 'IsSupplier').toLowerCase() === 'true'

    if (!siId || !name) continue

    const existing = await client.query(
      `SELECT id FROM customers WHERE company_id=$1 AND LOWER(name)=$2`,
      [companyId, name.toLowerCase()]
    )
    if (existing.rows.length) {
      custMap[siId] = existing.rows[0].id
      skipped++
      continue
    }

    const vatNo   = extractVat(nip, street)
    const address = cleanAddress(street)
    const tel     = phone ? phone.substring(0, 30) : null
    const emailVal = email.includes('@') ? email.substring(0, 150) : null

    let code, custType
    if (isSup) {
      supSeq++
      ;[code, supSeq] = nextCode('S', supSeq)
      custType = 'supplier'
    } else {
      custSeq++
      ;[code, custSeq] = nextCode('C', custSeq)
      custType = 'retail'
    }

    // Set role flags from SI's IsSupplier field.
    // Dual-role detection (suppliers that also have invoices) is handled later
    // in postImportFixes after all invoices are imported.
    const isCustomer = !isSup   // non-suppliers are customers
    const isSupplier = isSup    // suppliers are suppliers

    const newId = uuid()
    await client.query(
      `INSERT INTO customers (id, company_id, code, name, type, vat_number, address, tel, email, payment_terms_days, is_customer, is_supplier)
       VALUES ($1,$2,$3,$4,$5::customer_type,$6,$7,$8,$9,30,$10,$11)`,
      [newId, companyId, code, name, custType, vatNo, address, tel, emailVal, isCustomer, isSupplier]
    )
    custMap[siId] = newId
    imported++
  }
  return { map: custMap, imported, skipped }
}

async function importProducts(client, companyId, prodBuf, supBuf, catMap) {
  if (!prodBuf) return { map: {}, imported: 0, skipped: 0 }

  // Build cost price lookup from Suppliers.xml
  const costPrices = {}
  if (supBuf) {
    const supRows = parseXmlToRows(supBuf, 'NewDataSet', 'Supplier')
    for (const el of supRows) {
      const pid   = txt(el, 'ProductId')
      const price = flt(txt(el, 'Price'))
      if (pid && price > 0) {
        if (!(pid in costPrices) || price < costPrices[pid]) costPrices[pid] = price
      }
    }
  }

  // Pre-load existing SKUs
  const skuRes = await client.query(`SELECT sku FROM products WHERE company_id=$1`, [companyId])
  const existingSkus = new Set(skuRes.rows.map(r => r.sku))

  const prodMap = {}
  let imported = 0, skipped = 0
  const skuUsage = {}

  const rows = parseXmlToRows(prodBuf, 'NewDataSet', 'Product')

  for (const el of rows) {
    const siId    = txt(el, 'ID')
    const ptype   = txt(el, 'Type') || '1'
    const name    = txt(el, 'Name') || txt(el, 'n')
    if (!siId || !name || ptype === '3') { if (ptype === '3') skipped++; continue }

    const inactive = txt(el, 'Inactive').toLowerCase() === 'true'
    const catSi   = txt(el, 'CategoryID')
    const skuRaw  = txt(el, 'Index') || `SKU-${siId}`
    const units   = txt(el, 'Units') || 'pcs'
    const taxId   = txt(el, 'TaxRateID') || '2'
    const p1      = flt(txt(el, 'Price1'))
    const p2      = flt(txt(el, 'Price2'))
    const p3      = flt(txt(el, 'Price3'))
    const p4      = flt(txt(el, 'Price4'))
    const stockMin = flt(txt(el, 'StockLowLevel'))
    const tracked  = txt(el, 'StockControl').toLowerCase() !== 'false'
    const isSales  = txt(el, 'SalesItem').toLowerCase() !== 'false'
    const isPurch  = txt(el, 'PurchaseItem').toLowerCase() !== 'false'

    const vatRate = taxId === '2' ? 10 : 0
    const unit    = normUnit(units)
    const catId   = catMap[catSi] || null
    const cost    = costPrices[siId] || (p1 > 0 ? +(p1 * 0.7).toFixed(3) : 0)

    const existing = await client.query(
      `SELECT id FROM products WHERE company_id=$1 AND LOWER(name)=$2`,
      [companyId, name.toLowerCase()]
    )
    if (existing.rows.length) {
      prodMap[siId] = existing.rows[0].id
      skipped++
      continue
    }

    // Unique SKU
    let sku = skuRaw
    if (existingSkus.has(sku)) {
      skuUsage[skuRaw] = (skuUsage[skuRaw] || 1) + 1
      sku = `${skuRaw}-${skuUsage[skuRaw]}`
      while (existingSkus.has(sku)) { skuUsage[skuRaw]++; sku = `${skuRaw}-${skuUsage[skuRaw]}` }
    } else {
      skuUsage[skuRaw] = (skuUsage[skuRaw] || 0) + 1
    }
    existingSkus.add(sku)

    const newId = uuid()
    await client.query(
      `INSERT INTO products (id, company_id, sku, name, category_id, unit, cost_price,
         price_1, price_2, price_3, price_4, vat_rate, stock_min,
         is_stock_tracked, is_sales_item, is_purchase_item, is_active)
       VALUES ($1,$2,$3,$4,$5,$6::unit_type,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [newId, companyId, sku, name, catId, unit,
       +cost.toFixed(3), +p1.toFixed(3), +p2.toFixed(3), +p3.toFixed(3), +p4.toFixed(3),
       vatRate, +stockMin.toFixed(3), tracked, isSales, isPurch, !inactive]
    )
    prodMap[siId] = newId
    imported++
  }
  return { map: prodMap, imported, skipped }
}

// Bahrain VAT changed from 5% to 10% on 1 Jan 2022
const BH_VAT_CHANGE_DATE = '2022-01-01'
function vatMultiplier(dateStr) {
  return dateStr && dateStr < BH_VAT_CHANGE_DATE ? 1.05 : 1.10
}

async function importInvoices(client, companyId, salesBuf, itemsBuf, custMap) {
  if (!salesBuf) return { map: {}, dateMap: {}, imported: 0, skipped: 0 }

  // Pre-aggregate item totals
  const itemTotals = {}
  if (itemsBuf) {
    const itemRows = parseXmlToRows(itemsBuf, 'NewDataSet', 'SaleItem')
    for (const el of itemRows) {
      const docId = txt(el, 'DocumentID')
      if (!docId) continue
      if (!itemTotals[docId]) itemTotals[docId] = { sub: 0, vat: 0 }
      itemTotals[docId].sub += flt(txt(el, 'NetAmount'))
      itemTotals[docId].vat += flt(txt(el, 'TaxAmount'))
    }
  }

  const invMap  = {}
  const dateMap = {}  // siId → issueDate (passed to importInvoiceItems for VAT rate logic)
  let imported = 0, skipped = 0

  const rows = parseXmlToRows(salesBuf, 'NewDataSet', 'Sale')

  for (const el of rows) {
    const siId     = txt(el, 'ID')
    const typeId   = txt(el, 'TypeID') || '1'
    const custSi   = txt(el, 'ContractorID')
    const number   = txt(el, 'Number')
    const amount   = flt(txt(el, 'Amount'))
    const issueDate = parseDate(txt(el, 'IssueDate'))
    const dueDate  = parseDate(txt(el, 'DueDate'))
    const poRef    = txt(el, 'PurchaseOrder') || null
    const message  = txt(el, 'Message') || null
    const addNotes = txt(el, 'AdditionalNotes') || null

    if (!siId || !number || !custSi) continue

    const custId = custMap[custSi]
    if (!custId) { skipped++; continue }

    if (siId) dateMap[siId] = issueDate || ''

    const invType = SALE_TYPE_MAP[typeId] || 'tax_invoice'

    const existing = await client.query(
      `SELECT id FROM invoices WHERE company_id=$1 AND invoice_no=$2`,
      [companyId, number]
    )
    if (existing.rows.length) {
      invMap[siId] = existing.rows[0].id
      skipped++
      continue
    }

    const mult    = vatMultiplier(issueDate)
    const totals  = itemTotals[siId] || {}
    let subtotal  = totals.sub || 0
    let totalVat  = totals.vat || 0
    // Fallback: derive subtotal/vat from gross amount using correct era multiplier
    if (subtotal === 0 && amount > 0) {
      subtotal = +(amount / mult).toFixed(3)
      totalVat = +(amount - subtotal).toFixed(3)
    }
    const grandTotal = amount > 0 ? amount : +(subtotal + totalVat).toFixed(3)

    const notesParts = [message, addNotes].filter(Boolean)
    const notes = notesParts.join('\n') || null

    const newId = uuid()
    await client.query(
      `INSERT INTO invoices (id, company_id, invoice_no, type, customer_id,
         invoice_date, due_date, po_reference, subtotal, total_discount, total_vat,
         grand_total, payment_status, notes)
       VALUES ($1,$2,$3,$4::invoice_type,$5,$6,$7,$8,$9,0,$10,$11,'unpaid',$12)`,
      [newId, companyId, number, invType, custId,
       issueDate, dueDate, poRef,
       +subtotal.toFixed(3), +totalVat.toFixed(3), +grandTotal.toFixed(3),
       notes]
    )
    invMap[siId] = newId
    imported++
  }
  return { map: invMap, dateMap, imported, skipped }
}

async function importInvoiceItems(client, companyId, buf, invMap, prodMap, dateMap) {
  if (!buf) return { imported: 0, skipped: 0 }
  const rows = parseXmlToRows(buf, 'NewDataSet', 'SaleItem')
  let imported = 0, skipped = 0

  for (const el of rows) {
    const docId  = txt(el, 'DocumentID')
    const prodSi = txt(el, 'ProductID')
    const qty    = flt(txt(el, 'Quantity'), 1)
    const price  = flt(txt(el, 'Amount'))
    const name   = txt(el, 'ProductName') || 'Item'
    const units  = txt(el, 'Units') || 'pcs'
    const taxId   = txt(el, 'TaxRateID') || '2'
    const discount = flt(txt(el, 'Discount'))
    const lineNo  = parseInt(flt(txt(el, 'Index'), 0))
    const siNet   = flt(txt(el, 'NetAmount'))
    const siTax   = flt(txt(el, 'TaxAmount'))

    const invId = invMap[docId]
    if (!invId) { skipped++; continue }

    const prodId  = prodMap[prodSi] || null
    // Derive VAT rate from actual SI TaxAmount/NetAmount; fall back to date-based logic
    const invDate = (dateMap || {})[docId] || ''
    const vatRate = siNet > 0
      ? Math.round(siTax / siNet * 100 * 100) / 100
      : (taxId === '2' ? (invDate < BH_VAT_CHANGE_DATE && invDate ? 5 : 10) : 0)
    const unit    = normUnit(units)
    // SI Discount is per-unit; multiply by qty to get total line discount
    const totalDiscount = +(discount * qty).toFixed(3)

    await client.query(
      `INSERT INTO invoice_items (id, invoice_id, product_id, line_no, description, qty, unit, unit_price, discount, vat_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7::unit_type,$8,$9,$10)`,
      [uuid(), invId, prodId, lineNo, name.substring(0, 500),
       +qty.toFixed(3), unit, +price.toFixed(3), totalDiscount, vatRate]
    )
    imported++
  }
  return { imported, skipped }
}

async function importPayments(client, companyId, buf, invMap) {
  if (!buf) return { imported: 0, skipped: 0 }
  const rows = parseXmlToRows(buf, 'NewDataSet', 'Payment')
  let imported = 0, skipped = 0

  for (const el of rows) {
    const siPayId = txt(el, 'ID')
    const docId   = txt(el, 'DocumentID')
    const amount  = flt(txt(el, 'Amount'))
    const payDate = parseDate(txt(el, 'PaymentDate'))
    const note    = txt(el, 'Note') || null

    const invId = invMap[docId]
    if (!invId || amount <= 0 || !payDate) { skipped++; continue }

    // Dedup by SI payment ID stored as prefix in notes (allows multiple same-date same-amount payments)
    const siRef = `si:${siPayId}`
    const dup = await client.query(
      `SELECT 1 FROM payments WHERE reference_type='invoice' AND reference_id=$1 AND notes LIKE $2`,
      [invId, `${siRef}%`]
    )
    if (dup.rows.length) { skipped++; continue }

    const fullNote = note ? `${siRef} ${note}` : siRef
    await client.query(
      `INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes)
       VALUES ($1,$2,'invoice',$3,$4,$5,'bank_transfer',$6)`,
      [uuid(), companyId, invId, payDate, +amount.toFixed(3), fullNote]
    )
    imported++
  }
  return { imported, skipped }
}

async function importPurchases(client, companyId, buf, custMap) {
  if (!buf) return { map: {}, dateMap: {}, imported: 0, skipped: 0 }
  const rows = parseXmlToRows(buf, 'NewDataSet', 'Purchase')
  const purMap  = {}
  const dateMap = {}  // siId → purDate (passed to importPurchaseItems for VAT rate logic)
  let imported = 0, skipped = 0

  for (const el of rows) {
    const siId   = txt(el, 'ID')
    const supSi  = txt(el, 'SupplierID')
    const number = txt(el, 'Number')
    const amount = flt(txt(el, 'Amount'))
    const purDate = parseDate(txt(el, 'PurchaseDate'))
    const refNo  = txt(el, 'ReferenceNumber') || null

    if (!siId || !supSi || !number) continue

    const supId = custMap[supSi]
    if (!supId) { skipped++; continue }

    if (siId) dateMap[siId] = purDate || ''

    // For duplicate purchase numbers, generate a unique suffix (-2, -3, …)
    // rather than merging into the existing record (which loses unpaid balances).
    let uniqueNumber = number
    let suffix = 2
    while (true) {
      const existing = await client.query(
        `SELECT id FROM purchases WHERE company_id=$1 AND purchase_no=$2`,
        [companyId, uniqueNumber]
      )
      if (!existing.rows.length) break
      uniqueNumber = `${number}-${suffix++}`
    }

    const mult     = vatMultiplier(purDate)
    const grandTotal = amount
    const subtotal   = +(grandTotal / mult).toFixed(3)
    const totalVat   = +(grandTotal - subtotal).toFixed(3)

    const newId = uuid()
    await client.query(
      `INSERT INTO purchases (id, company_id, purchase_no, supplier_id, supplier_invoice_no,
         purchase_date, subtotal, total_vat, grand_total, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'unpaid')`,
      [newId, companyId, uniqueNumber, supId, refNo,
       purDate, subtotal, totalVat, +grandTotal.toFixed(3)]
    )
    purMap[siId] = newId
    imported++
  }
  return { map: purMap, dateMap, imported, skipped }
}

async function importPurchaseItems(client, companyId, buf, purMap, prodMap, dateMap) {
  if (!buf) return { imported: 0, skipped: 0 }
  const rows = parseXmlToRows(buf, 'NewDataSet', 'PurchaseItem')
  let imported = 0, skipped = 0

  for (const el of rows) {
    const purSi  = txt(el, 'PurchaseID')
    const prodSi = txt(el, 'ProductID')
    const qty    = flt(txt(el, 'Quantity'), 1)
    const price  = flt(txt(el, 'Amount'))
    const name   = txt(el, 'ProductName') || 'Item'
    const units  = txt(el, 'Units') || 'pcs'
    const taxId  = txt(el, 'TaxRateID') || '2'
    const lineNo = parseInt(flt(txt(el, 'Index'), 0))
    const siNet  = flt(txt(el, 'NetAmount'))
    const siTax  = flt(txt(el, 'TaxAmount'))

    const purId = purMap[purSi]
    if (!purId) { skipped++; continue }

    const prodId  = prodMap[prodSi] || null
    // Derive VAT rate from actual SI TaxAmount/NetAmount; fall back to date-based logic
    const purDate = (dateMap || {})[purSi] || ''
    const vatRate = siNet > 0
      ? Math.round(siTax / siNet * 100 * 100) / 100
      : (taxId === '2' ? (purDate < BH_VAT_CHANGE_DATE && purDate ? 5 : 10) : 0)
    const unit    = normUnit(units)
    // Use effective unit price (siNet/qty) to bake in discount — purchase_items has no discount column
    const effPrice = (qty > 0 && siNet > 0) ? +(siNet / qty).toFixed(6) : +price.toFixed(3)

    await client.query(
      `INSERT INTO purchase_items (id, purchase_id, product_id, line_no, description, qty, unit, unit_price, vat_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7::unit_type,$8,$9)`,
      [uuid(), purId, prodId, lineNo, name.substring(0, 500),
       +qty.toFixed(3), unit, effPrice, vatRate]
    )
    imported++
  }

  // Update purchase header subtotal and vat from items.
  // grand_total intentionally NOT updated — SI Amount field is authoritative.
  if (imported > 0) {
    await client.query(`
      UPDATE purchases p SET
        subtotal  = COALESCE((SELECT SUM(net_amount) FROM purchase_items pi WHERE pi.purchase_id = p.id), 0),
        total_vat = COALESCE((SELECT SUM(vat_amount) FROM purchase_items pi WHERE pi.purchase_id = p.id), 0)
      WHERE p.company_id = $1
    `, [companyId])
  }
  return { imported, skipped }
}

async function importPurchasePayments(client, companyId, buf, purMap) {
  if (!buf) return { imported: 0, skipped: 0 }
  const rows = parseXmlToRows(buf, 'NewDataSet', 'PurchasePayment')
  const purPaid = {}
  let imported = 0, skipped = 0

  for (const el of rows) {
    const siPayId = txt(el, 'ID')
    const purSi   = txt(el, 'PurchaseID')
    const amount  = flt(txt(el, 'Amount'))
    const payDate = parseDate(txt(el, 'PaymentDate'))
    const note    = txt(el, 'Note') || null

    const purId = purMap[purSi]
    if (!purId || amount <= 0 || !payDate) { skipped++; continue }

    // Dedup by SI payment ID stored as prefix in notes (allows multiple same-date same-amount payments)
    const siRef = `si:${siPayId}`
    const dup = await client.query(
      `SELECT 1 FROM payments WHERE reference_type='purchase' AND reference_id=$1 AND notes LIKE $2`,
      [purId, `${siRef}%`]
    )
    if (dup.rows.length) { skipped++; continue }

    const fullNote = note ? `${siRef} ${note}` : siRef
    await client.query(
      `INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes)
       VALUES ($1,$2,'purchase',$3,$4,$5,'bank_transfer',$6)`,
      [uuid(), companyId, purId, payDate, +amount.toFixed(3), fullNote]
    )
    purPaid[purId] = (purPaid[purId] || 0) + amount
    imported++
  }

  // Update purchase payment statuses
  if (Object.keys(purPaid).length) {
    for (const [purId, paid] of Object.entries(purPaid)) {
      const res = await client.query(`SELECT grand_total FROM purchases WHERE id=$1`, [purId])
      if (!res.rows.length) continue
      const grand = parseFloat(res.rows[0].grand_total)
      const balance = grand - paid
      const status = balance <= 0.001 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
      await client.query(
        `UPDATE purchases SET amount_paid=$1, payment_status=$2::payment_status WHERE id=$3`,
        [+paid.toFixed(3), status, purId]
      )
    }
  }
  return { imported, skipped }
}

async function importExpenses(client, companyId, buf, catMap) {
  if (!buf) return { imported: 0, skipped: 0 }
  const rows = parseXmlToRows(buf, 'NewDataSet', 'Expense')
  let imported = 0, skipped = 0

  // Find starting seq
  const seqRes = await client.query(
    `SELECT expense_no FROM expenses WHERE company_id=$1 AND expense_no LIKE 'IMP-EXP-%' ORDER BY expense_no DESC LIMIT 1`,
    [companyId]
  )
  let expSeq = seqRes.rows.length ? parseInt(seqRes.rows[0].expense_no.split('-').pop()) : 0

  for (const el of rows) {
    const catSi   = txt(el, 'CategoryID')
    const expDate = parseDate(txt(el, 'Date'))
    const subtotal = flt(txt(el, 'Subtotal'))
    const total   = flt(txt(el, 'Total'))
    const taxAmt  = flt(txt(el, 'TaxAmount'))
    const desc    = txt(el, 'Description')

    if (!desc || !expDate) continue

    const netAmt = subtotal > 0 ? subtotal : total - taxAmt
    const catId  = catMap[catSi] || null

    const dup = await client.query(
      `SELECT 1 FROM expenses WHERE company_id=$1 AND expense_date=$2 AND LOWER(description)=$3 AND net_amount=$4`,
      [companyId, expDate, desc.toLowerCase(), +netAmt.toFixed(3)]
    )
    if (dup.rows.length) { skipped++; continue }

    expSeq++
    const expNo = `IMP-EXP-${String(expSeq).padStart(4, '0')}`

    await client.query(
      `INSERT INTO expenses (id, company_id, expense_no, category_id, expense_date, description, net_amount, vat_amount, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), companyId, expNo, catId, expDate,
       desc.substring(0, 300), +netAmt.toFixed(3), +taxAmt.toFixed(3), +total.toFixed(3)]
    )
    imported++
  }
  return { imported, skipped }
}

// ── Post-import fixes ─────────────────────────────────────────

async function postImportFixes(client, companyId) {
  // 1. Recalculate invoice totals from items
  await client.query(`
    UPDATE invoices i SET
      subtotal  = COALESCE((SELECT SUM(net_amount) FROM invoice_items ii WHERE ii.invoice_id = i.id), 0),
      total_vat = COALESCE((SELECT SUM(vat_amount) FROM invoice_items ii WHERE ii.invoice_id = i.id), 0),
      updated_at = now()
    WHERE i.company_id = $1
  `, [companyId])

  // 2. grand_total intentionally NOT recalculated here — SI Amount field is authoritative.
  //    Overwriting grand_total from (inflated) subtotal+vat would corrupt balances for
  //    invoices with discounts. The correct grand_total was already set from SI Amount
  //    during importInvoices().

  // 3. Stock movements (for all purchase items without existing movements)
  const smRes = await client.query(`
    INSERT INTO stock_movements
        (id, company_id, product_id, movement_type, qty, ref_type, ref_id, ref_no)
    SELECT
        gen_random_uuid(), p.company_id, pi.product_id, 'purchase_in', pi.qty,
        'purchase', p.id, p.purchase_no
    FROM purchase_items pi
    JOIN purchases p ON p.id = pi.purchase_id
    WHERE p.company_id = $1
      AND pi.product_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM stock_movements sm
          WHERE sm.ref_type = 'purchase'
            AND sm.ref_id = p.id
            AND sm.product_id = pi.product_id
      )
  `, [companyId])

  // 4. Recalculate stock quantities
  await client.query(`
    UPDATE products p SET
      stock_qty  = COALESCE((SELECT SUM(qty) FROM stock_movements sm WHERE sm.product_id = p.id), 0),
      updated_at = now()
    WHERE p.company_id = $1
  `, [companyId])

  // 5. Recompute invoice payment statuses
  await client.query(`
    UPDATE invoices i SET
      amount_paid = COALESCE(
          (SELECT SUM(amount) FROM payments WHERE reference_type='invoice' AND reference_id=i.id), 0),
      payment_status = CASE
        WHEN i.grand_total - COALESCE(
            (SELECT SUM(amount) FROM payments WHERE reference_type='invoice' AND reference_id=i.id), 0) < 0.005
          THEN 'paid'::invoice_status
        WHEN COALESCE(
            (SELECT SUM(amount) FROM payments WHERE reference_type='invoice' AND reference_id=i.id), 0) > 0
          THEN 'partial'::invoice_status
        WHEN i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE
          THEN 'overdue'::invoice_status
        ELSE 'unpaid'::invoice_status
      END,
      updated_at = now()
    WHERE i.company_id = $1
  `, [companyId])

  // 6. Dual-role detection — suppliers that also appear on invoices (AR) are also customers.
  //    This must run AFTER invoices are imported; can't be done at customer INSERT time.
  //    Handles entities SI marks as IsSupplier=true but also sells to you (same entity in
  //    both Contractors list and linked to sales invoices).
  const dualRoleRes = await client.query(`
    UPDATE customers SET is_customer = TRUE
    WHERE company_id = $1
      AND is_supplier = TRUE
      AND is_customer = FALSE
      AND id IN (SELECT DISTINCT customer_id FROM invoices WHERE company_id = $1)
  `, [companyId])

  return { stockMovements: smRes.rowCount, dualRole: dualRoleRes.rowCount }
}

// ── Route: POST /api/v1/admin/import-sinvoice ─────────────────
router.post('/', upload.single('backup'), async (req, res) => {
  // SSE headers — must be set before any async work
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const emit = (type, data) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
    }
  }

  const log   = (msg, level = 'info') => emit('log', { msg, level })
  const stage = (name, total)         => emit('stage', { name, total })
  const done  = (summary)             => emit('done', { summary })
  const error = (msg)                 => emit('error', { msg })

  let client
  try {
    if (!req.file) throw new Error('No file uploaded')
    log(`Received ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)} MB)`)

    // Extract ZIP
    log('Extracting ZIP archive...')
    const xmlFiles = loadXmlFiles(req.file.buffer)

    const found   = Object.entries(xmlFiles).filter(([, v]) => v).map(([k]) => k)
    const missing = Object.entries(xmlFiles).filter(([, v]) => !v).map(([k]) => k)
    log(`Found XML files: ${found.join(', ')}`)
    if (missing.length) log(`Missing (will skip): ${missing.join(', ')}`, 'warn')

    const companyId = req.user.company_id
    client = await db.pool.connect()

    // Determine mode from body
    const mode = req.body.mode || 'skip'  // 'skip' or 'replace'
    log(`Import mode: ${mode === 'replace' ? 'replace existing records' : 'skip existing records'}`)

    if (mode === 'replace') {
      log('Clearing existing business data before import...', 'warn')
      await client.query('BEGIN')
      await client.query(`DELETE FROM payments        WHERE company_id=$1`, [companyId])
      await client.query(`DELETE FROM invoice_items   WHERE EXISTS (SELECT 1 FROM invoices i WHERE i.id=invoice_id AND i.company_id=$1)`, [companyId])
      await client.query(`DELETE FROM invoices        WHERE company_id=$1`, [companyId])
      await client.query(`DELETE FROM purchase_items  WHERE EXISTS (SELECT 1 FROM purchases p WHERE p.id=purchase_id AND p.company_id=$1)`, [companyId])
      await client.query(`DELETE FROM purchases       WHERE company_id=$1`, [companyId])
      await client.query(`DELETE FROM stock_movements WHERE company_id=$1`, [companyId])
      await client.query(`DELETE FROM expenses        WHERE company_id=$1`, [companyId])
      await client.query('COMMIT')
      log('Existing data cleared')
    }

    // Disable triggers for bulk insert performance
    await client.query(`SET session_replication_role = 'replica'`)
    log('Triggers paused for bulk import')

    // 1. Categories
    stage('Categories', null)
    await client.query('BEGIN')
    const cats = await importCategories(client, companyId, xmlFiles.categories)
    await client.query('COMMIT')
    log(`Categories: ${cats.imported} imported, ${cats.skipped} already existed`)

    // 2. Customers / Suppliers
    stage('Customers & Suppliers', null)
    await client.query('BEGIN')
    const custs = await importCustomers(client, companyId, xmlFiles.contractors)
    await client.query('COMMIT')
    log(`Customers/Suppliers: ${custs.imported} imported, ${custs.skipped} skipped`)

    // 3. Products
    stage('Products', null)
    await client.query('BEGIN')
    const prods = await importProducts(client, companyId, xmlFiles.products, xmlFiles.suppliers, cats.map)
    await client.query('COMMIT')
    log(`Products: ${prods.imported} imported, ${prods.skipped} skipped`)

    // 4. Invoices
    stage('Invoices', null)
    await client.query('BEGIN')
    const invs = await importInvoices(client, companyId, xmlFiles.sales, xmlFiles.saleItems, custs.map)
    await client.query('COMMIT')
    log(`Invoices: ${invs.imported} imported, ${invs.skipped} skipped`)

    // 5. Invoice items
    stage('Invoice Items', null)
    await client.query('BEGIN')
    const invItems = await importInvoiceItems(client, companyId, xmlFiles.saleItems, invs.map, prods.map, invs.dateMap)
    await client.query('COMMIT')
    log(`Invoice items: ${invItems.imported} imported, ${invItems.skipped} skipped`)

    // 6. Customer payments
    stage('Customer Payments', null)
    await client.query('BEGIN')
    const pays = await importPayments(client, companyId, xmlFiles.payments, invs.map)
    await client.query('COMMIT')
    log(`Customer payments: ${pays.imported} imported, ${pays.skipped} skipped`)

    // 7. Purchases
    stage('Purchases', null)
    await client.query('BEGIN')
    const purs = await importPurchases(client, companyId, xmlFiles.purchases, custs.map)
    await client.query('COMMIT')
    log(`Purchases: ${purs.imported} imported, ${purs.skipped} skipped`)

    // 8. Purchase items
    stage('Purchase Items', null)
    await client.query('BEGIN')
    const purItems = await importPurchaseItems(client, companyId, xmlFiles.purchaseItems, purs.map, prods.map, purs.dateMap)
    await client.query('COMMIT')
    log(`Purchase items: ${purItems.imported} imported, ${purItems.skipped} skipped`)

    // 9. Purchase payments
    stage('Purchase Payments', null)
    await client.query('BEGIN')
    const purPays = await importPurchasePayments(client, companyId, xmlFiles.purchasePayments, purs.map)
    await client.query('COMMIT')
    log(`Purchase payments: ${purPays.imported} imported, ${purPays.skipped} skipped`)

    // 10. Expenses
    stage('Expenses', null)
    await client.query('BEGIN')
    const exps = await importExpenses(client, companyId, xmlFiles.expenses, cats.map)
    await client.query('COMMIT')
    log(`Expenses: ${exps.imported} imported, ${exps.skipped} skipped`)

    // Re-enable triggers
    await client.query(`SET session_replication_role = 'origin'`)
    log('Triggers re-enabled')

    // Post-import fixes
    stage('Post-import Fixes', null)
    await client.query('BEGIN')
    log('Recalculating invoice totals...')
    log('Inserting stock movements...')
    log('Recalculating stock quantities...')
    log('Recomputing payment statuses...')
    const fixes = await postImportFixes(client, companyId)
    await client.query('COMMIT')
    log(`Post-import: ${fixes.stockMovements} stock movements created, ${fixes.dualRole} dual-role entities detected`)

    // Final summary
    const summary = {
      categories:      cats.imported,
      customers:       custs.imported,
      products:        prods.imported,
      invoices:        invs.imported,
      invoice_items:   invItems.imported,
      payments:        pays.imported,
      purchases:       purs.imported,
      purchase_items:  purItems.imported,
      purchase_payments: purPays.imported,
      expenses:        exps.imported,
      stock_movements: fixes.stockMovements,
    }
    log('Import complete!', 'success')
    done(summary)

  } catch (err) {
    console.error('import-sinvoice error:', err)
    try { if (client) { await client.query('ROLLBACK'); await client.query(`SET session_replication_role = 'origin'`) } } catch (_) {}
    error(err.message || 'Import failed')
  } finally {
    if (client) client.release()
    res.end()
  }
})

module.exports = router
