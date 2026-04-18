/**
 * CSV Import routes — admin only
 * Handles products and customers import from semicolon-delimited CSV
 */
const router = require('express').Router();
const db     = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { v4: uuid } = require('uuid');

router.use(authenticate);
router.use(authorize('admin'));

// ── Helpers ──────────────────────────────────────────────────
function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines  = clean.split('\n');
  if (!lines.length) return { header: [], rows: [] };

  const header = lines[0].split(';').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows   = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = line.split(';');
    const row = {};
    header.forEach((h, idx) => { row[h] = (cells[idx] || '').trim(); });
    rows.push(row);
  }
  return { header, rows };
}

const UNIT_MAP = {
  roll: 'reel', rolls: 'reel', reel: 'reel',
  mtr: 'mtr', mtrs: 'mtr', meter: 'mtr', meters: 'mtr', metre: 'mtr',
  each: 'pcs', eech: 'pcs', eacs: 'pcs', ech: 'pcs', esch: 'pcs', ecch: 'pcs',
  eacch: 'pcs', wach: 'pcs', nos: 'pcs', noss: 'pcs', no: 'pcs',
  pcs: 'pcs', pc: 'pcs', pec: 'pcs', pes: 'pcs', eac: 'pcs', eah: 'pcs', eash: 'pcs',
  lot: 'pcs', day: 'pcs', days: 'pcs', each1: 'pcs', loose: 'pcs', drm: 'pcs',
  set: 'set', sets: 'set',
  pkt: 'pack', pkts: 'pack', packet: 'pack', pack: 'pack',
  box: 'box', boxes: 'box', carton: 'box', ctn: 'box',
  kg: 'kg', kgs: 'kg', kilogram: 'kg',
  ltr: 'ltr', litre: 'ltr', liter: 'ltr', gal: 'ltr', gln: 'ltr', can: 'ltr',
  m2: 'm2', sqm: 'm2',
  m3: 'm3', cbm: 'm3',
  strip: 'pcs', dzn: 'pcs', doz: 'pcs', dozen: 'pcs', pair: 'pcs',
  'each ': 'pcs', ' each': 'pcs',
};

function mapUnit(raw) {
  // strip trailing/leading digits that got concatenated (Each1.8, Each38, Each8, Each.2 → pcs)
  const u = (raw || '').toLowerCase().trim().replace(/^(each|eac|ech)[\d\.]+$/, 'each');
  return UNIT_MAP[u] || 'pcs';
}

function parseNum(val, fallback = 0) {
  const n = parseFloat((val || '').replace(',', '.'));
  return isNaN(n) ? fallback : n;
}

// ── Customer row analysis ─────────────────────────────────────

// Patterns that identify address fragments, TRN lines, area names etc.
// that appear as fake rows because the source software didn't quote multiline fields.
const ADDRESS_FRAGMENT_PATTERNS = [
  /^block[-\s\d]/i,
  /^road[-\/\s\d]/i,
  /^bldg?[-\s\d]/i,
  /^p\.?o\.?\s*box/i,
  /^flat[-\/\s\d]/i,
  /^shop[-\s\d]/i,
  /^gate[-\s\d]/i,
  /^floor\s+\d/i,
  /^building[-:\s\d]/i,
  /^(kingdom of bahrain\.?)$/i,
  /^(manama\.?|manama,)/i,
  /^(bahrain\.?)$/i,
  /^trn[:\-\s]/i,
  /^trn\.?\d/i,
  /^(vat|cr)[:\.]\s*\d/i,
  /^\d{10,}$/,                          // bare TRN / CR number
  /^sh\.\s*(hamad|isa|khalifa|hamed)/i, // SH. HAMAD ROAD
  /^sh\s+hamed\s+road/i,
  /^(salmabad|salimabad|tubli|hidd|muharraq|riffa|isa town|hamad town|seef|juffair|adliya|hoora|zinj)$/i,
  /^(diyar al |madinat hamad)/i,
  /^(east |west )(riffa|manama)/i,
  /^al naim[,\s]*$/i,
  /^gudaibiya$/i,
  /^(industrial area|commercial area|free zone)/i,
  /^sitra industrial/i,
  /^c\.r\.\s*no/i,
  /^p\.p\.\s*box/i,
  /^dragon city/i,
  /^lulu road$/i,
  /^(al hoora|al salmania|al seef|al naim|al mahooz|al qudaibiya)$/i,
  /^(kerala|askar)$/i,                  // area/city names misread as customer
];

// Suffixes to strip when comparing names for near-duplicates
const COMPANY_SUFFIX_RE = /\s+(w\.?l\.?l\.?|b\.?s\.?c\.?(\s*\(?\s*c\s*\)?\s*)?|spc|est\.?|establishment|co\.?|company|trading|contracting|& sons?|& partners?|group)\s*$/i;

function isAddressFragment(name) {
  const n = (name || '').trim();
  if (!n) return { flag: true, reason: 'Empty name' };
  for (const pat of ADDRESS_FRAGMENT_PATTERNS) {
    if (pat.test(n)) return { flag: true, reason: `Address/area fragment: "${n}"` };
  }
  return { flag: false };
}

function normaliseForDedup(name) {
  return name.toUpperCase().trim()
    .replace(COMPANY_SUFFIX_RE, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Analyse a full customer row set and return structured diagnostics
function analyseCustomers(rows) {
  const valid    = [];
  const excluded = []; // { row, reason }
  const nameMap  = {}; // normalised name → [indices in valid]

  for (const row of rows) {
    const name = (row.name || '').trim();

    // Noise skip (from original list)
    if (!name || /^(cash customer|cash memo|cash|walk-in customer)$/i.test(name)) {
      excluded.push({ name: name || '(blank)', reason: 'Noise / cash customer row' });
      continue;
    }

    const frag = isAddressFragment(name);
    if (frag.flag) {
      excluded.push({ name, reason: frag.reason });
      continue;
    }

    const norm = normaliseForDedup(name);
    if (!nameMap[norm]) nameMap[norm] = [];
    nameMap[norm].push(valid.length);
    valid.push(row);
  }

  // Exact duplicates among valid rows (same normalised name)
  const duplicates = Object.entries(nameMap)
    .filter(([, idxs]) => idxs.length > 1)
    .map(([norm, idxs]) => ({ norm, names: idxs.map(i => valid[i].name) }));

  // Near-duplicates: pairs whose normalised name starts the same (first 18 chars)
  const prefixMap = {};
  Object.keys(nameMap).forEach(norm => {
    const prefix = norm.substring(0, 18);
    if (!prefixMap[prefix]) prefixMap[prefix] = [];
    prefixMap[prefix].push(norm);
  });
  const nearDuplicates = Object.values(prefixMap)
    .filter(arr => arr.length > 1)
    .map(arr => arr.map(norm => nameMap[norm].map(i => valid[i].name)).flat());

  // Field contamination warnings
  const warnings = [];
  const emailInPhone = valid.filter(r => r.phone && r.phone.includes('@'));
  if (emailInPhone.length) warnings.push(`${emailInPhone.length} row(s) have email address in the Phone field — will be imported as phone`);

  const trnInAddr = valid.filter(r => r.tax_number && (r.address || '').includes(r.tax_number));
  if (trnInAddr.length) warnings.push(`${trnInAddr.length} row(s) have TRN duplicated inside the Address field (harmless — TRN is correctly captured)`);

  const badTrn = valid.filter(r => {
    if (!r.tax_number) return false;
    const t = r.tax_number.replace(/TRN[:\-\.\s]*/i, '').trim();
    return t && !/^\d{14,16}$/.test(t);
  });
  if (badTrn.length) warnings.push(`${badTrn.length} row(s) have malformed TRN values (e.g. wrong digit count, text label only)`);

  return { valid, excluded, duplicates, nearDuplicates, warnings };
}

// Analyse a product row set and return diagnostics
function analyseProducts(rows) {
  const noSku      = rows.filter(r => !(r.code || '').trim());
  const zeroPx     = rows.filter(r => !(r.price || '').trim() || parseNum(r.price) === 0);
  const negStock   = rows.filter(r => parseNum(r.stock) < 0);
  const unmappable = rows.filter(r => {
    const raw = (r.units || '').toLowerCase().trim().replace(/^(each|eac|ech)[\d\.]+$/, 'each');
    return raw && !UNIT_MAP[raw];
  });

  const skuCount = {};
  rows.forEach(r => {
    const s = (r.code || '').trim().toUpperCase();
    if (!s) return;
    skuCount[s] = (skuCount[s] || 0) + 1;
  });
  const dupSkus = Object.entries(skuCount).filter(([, c]) => c > 1).map(([s, c]) => ({ sku: s, count: c }));

  // Category typo hints
  const CAT_TYPOS = {
    'MISCELLANIOUS': 'MISCELLANEOUS',
    'CATRIDGE': 'CARTRIDGE',
    'CONDIUT': 'CONDUIT',
    'SOKETS': 'SOCKETS',
  };
  const catSet = new Set(rows.map(r => (r.category || '').trim().toUpperCase()));
  const catTypos = [];
  catSet.forEach(cat => {
    for (const [wrong, right] of Object.entries(CAT_TYPOS)) {
      if (cat.includes(wrong)) catTypos.push({ cat, suggestion: cat.replace(wrong, right) });
    }
  });

  return { noSku, zeroPx, negStock, unmappable, dupSkus, catTypos };
}

// Noise rows that are not real customers
const SKIP_CUSTOMER_NAMES = new Set([
  'cash customer', 'cash memo', 'cash', 'walk-in customer', '',
]);

// ── GET /api/v1/import/preview ───────────────────────────────
router.post('/preview', (req, res) => {
  try {
    const { csv, type } = req.body;
    if (!csv) return res.status(400).json({ error: { message: 'csv required' } });
    const { header, rows } = parseCSV(csv);

    if (type === 'customers') {
      const analysis = analyseCustomers(rows);
      return res.json({
        data: {
          header,
          total: rows.length,
          valid_count: analysis.valid.length,
          excluded_count: analysis.excluded.length,
          sample: analysis.valid.slice(0, 5),
          excluded_sample: analysis.excluded.slice(0, 30),
          excluded_all: analysis.excluded,
          duplicates: analysis.duplicates,
          near_duplicates: analysis.nearDuplicates.slice(0, 10),
          warnings: analysis.warnings,
        },
      });
    }

    if (type === 'products') {
      const analysis = analyseProducts(rows);
      return res.json({
        data: {
          header,
          total: rows.length,
          valid_count: rows.length - analysis.noSku.length,
          sample: rows.slice(0, 5),
          issues: {
            no_sku:     analysis.noSku.length,
            zero_price: analysis.zeroPx.length,
            neg_stock:  analysis.negStock.length,
            dup_skus:   analysis.dupSkus,
            unmappable_units: analysis.unmappable.map(r => ({ sku: r.code, unit: r.units, name: r.name })),
            cat_typos:  analysis.catTypos,
          },
        },
      });
    }

    // fallback generic preview
    res.json({ data: { header, total: rows.length, sample: rows.slice(0, 5) } });
  } catch (e) { res.status(500).json({ error: { message: e.message } }); }
});

// ── POST /api/v1/import/products ─────────────────────────────
router.post('/products', async (req, res, next) => {
  try {
    const { csv, mode = 'skip' } = req.body;
    if (!csv) return res.status(400).json({ error: { message: 'csv required' } });

    const co = req.user.company_id;
    const { rows } = parseCSV(csv);

    // ── Step 1: collect & create missing categories ──────────
    const catMap = {};
    const { rows: existingCats } = await db.query(
      `SELECT id, name FROM categories WHERE company_id=$1 AND type='product'`, [co]
    );
    existingCats.forEach(c => { catMap[c.name.toUpperCase().trim()] = c.id; });

    const csvCats = [...new Set(rows.map(r => (r.category || '').trim()).filter(Boolean))];
    for (const catName of csvCats) {
      const key = catName.toUpperCase().trim();
      if (!catMap[key]) {
        const newId = uuid();
        await db.query(
          `INSERT INTO categories (id, company_id, name, type)
           VALUES ($1,$2,$3,'product')
           ON CONFLICT DO NOTHING`,
          [newId, co, catName]
        );
        catMap[key] = newId;
      }
    }
    const { rows: cats2 } = await db.query(
      `SELECT id, name FROM categories WHERE company_id=$1 AND type='product'`, [co]
    );
    cats2.forEach(c => { catMap[c.name.toUpperCase().trim()] = c.id; });

    // ── Step 2: process product rows ────────────────────────
    let inserted = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const row of rows) {
      const sku  = (row.code || '').trim();
      const name = (row.name || '').trim();
      if (!sku || !name) { skipped++; continue; }

      const price1 = parseNum(row.price);
      const price2 = parseNum(row.price2) || null;
      const price3 = parseNum(row.price3) || null;
      const price4 = parseNum(row.price4) || null;
      const cost   = parseNum(row.cost);
      const vatRate = parseNum(row.taxrate, 10);
      const rawStock = parseNum(row.stock);
      const stockQty = rawStock > 0 ? rawStock : 0;
      const unit   = mapUnit(row.units);
      const catId  = catMap[(row.category || '').toUpperCase().trim()] || null;
      const desc   = (row.description || '').trim() || null;

      try {
        const { rows: [existing] } = await db.query(
          `SELECT id FROM products WHERE company_id=$1 AND sku=$2`, [co, sku]
        );

        if (existing) {
          if (mode === 'skip') { skipped++; continue; }
          await db.query(
            `UPDATE products SET
               name=$1, description=$2, category_id=$3,
               unit=$4::unit_type,
               cost_price=$5, price_1=$6, price_2=$7, price_3=$8, price_4=$9,
               vat_rate=$10, updated_at=now()
             WHERE id=$11`,
            [name, desc, catId, unit, cost, price1, price2, price3, price4, vatRate, existing.id]
          );
          updated++;
        } else {
          const prodId = uuid();
          await db.query(
            `INSERT INTO products
               (id, company_id, sku, name, description, category_id, unit,
                cost_price, price_1, price_2, price_3, price_4,
                vat_rate, stock_qty, stock_min,
                is_active, is_stock_tracked, is_sales_item, is_purchase_item)
             VALUES ($1,$2,$3,$4,$5,$6,$7::unit_type,
                     $8,$9,$10,$11,$12,$13,$14,0,
                     true,true,true,true)`,
            [prodId, co, sku, name, desc, catId, unit,
             cost, price1, price2, price3, price4, vatRate, stockQty]
          );
          if (stockQty > 0) {
            await db.query(
              `INSERT INTO stock_movements
                 (id, company_id, product_id, movement_type, qty, ref_type, notes)
               VALUES ($1,$2,$3,'opening',$4,'manual','Imported from CSV')`,
              [uuid(), co, prodId, stockQty]
            );
          }
          inserted++;
        }
      } catch (e) {
        errors.push(`${sku}: ${e.message}`);
        if (errors.length > 50) break;
      }
    }

    res.json({
      message: 'Products import complete',
      data: { total: rows.length, inserted, updated, skipped, errors: errors.slice(0, 30) },
    });
  } catch (e) { next(e); }
});

// ── POST /api/v1/import/customers ────────────────────────────
router.post('/customers', async (req, res, next) => {
  try {
    const { csv, mode = 'skip', default_type = 'wholesale' } = req.body;
    if (!csv) return res.status(400).json({ error: { message: 'csv required' } });

    const co = req.user.company_id;
    const { rows } = parseCSV(csv);

    // Run the same analysis used in preview to filter garbage rows
    const { valid: validRows, excluded } = analyseCustomers(rows);

    const { rows: [seqRow] } = await db.query(
      `SELECT COALESCE(
         MAX(CAST(REGEXP_REPLACE(code, '[^0-9]', '', 'g') AS bigint)), 0
       ) AS n
       FROM customers WHERE company_id=$1`, [co]
    );
    let seq = parseInt(seqRow.n) + 1;

    let inserted = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const row of validRows) {
      const name = (row.name || '').trim();

      // Fix email-in-phone contamination
      const rawPhone  = (row.phone  || '').trim();
      const rawMobile = (row.mobile || '').trim();
      const rawEmail  = (row.email  || '').trim();

      const phone  = rawPhone.includes('@')  ? null : rawPhone  || null;
      const mobile = rawMobile.includes('@') ? null : rawMobile || null;
      const email  = rawEmail  || (rawPhone.includes('@')  ? rawPhone  : null)
                               || (rawMobile.includes('@') ? rawMobile : null)
                               || null;

      // Clean TRN: strip label prefix, keep digits
      const rawTrn = (row['tax_number'] || row['tax number'] || '').trim();
      const vatNumber = rawTrn ? rawTrn.replace(/^(TRN|VAT)[:\-\.\s]*/i, '').trim() || null : null;

      const country   = (row.country || '').trim();
      const town      = (row.town    || '').trim();
      const addrParts = [(row.address || '').trim(), town, country].filter(Boolean);
      const address   = addrParts.join(', ') || null;
      const tel       = phone || mobile || null;

      try {
        const { rows: [existing] } = await db.query(
          `SELECT id FROM customers WHERE company_id=$1 AND LOWER(TRIM(name))=LOWER($2)`,
          [co, name]
        );

        if (existing) {
          if (mode === 'skip') { skipped++; continue; }
          await db.query(
            `UPDATE customers SET vat_number=$1, address=$2, tel=$3, email=$4 WHERE id=$5`,
            [vatNumber, address, tel, email, existing.id]
          );
          updated++;
        } else {
          const code = `C${String(seq).padStart(4, '0')}`;
          seq++;
          await db.query(
            `INSERT INTO customers
               (id, company_id, code, name, type, vat_number, address, tel, email, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
            [uuid(), co, code, name, default_type, vatNumber, address, tel, email]
          );
          inserted++;
        }
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
        if (errors.length > 50) break;
      }
    }

    res.json({
      message: 'Customers import complete',
      data: {
        total: rows.length,
        inserted,
        updated,
        skipped,
        excluded: excluded.length,
        errors: errors.slice(0, 30),
      },
    });
  } catch (e) { next(e); }
});

module.exports = router;
