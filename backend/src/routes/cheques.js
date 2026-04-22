const router  = require('express').Router();
const db      = require('../db');
const { v4: uuid } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const multer  = require('multer');
const XLSX    = require('xlsx');
const pdfSvc  = require('../services/pdfService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Excel import helpers ──────────────────────────────────────

// Normalise a header string to a consistent key
function normHeader(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Map any header variant to a canonical field name
const HEADER_MAP = {
  // cheque_no
  chequeno: 'cheque_no', chequenumber: 'cheque_no', chqno: 'cheque_no',
  checkno: 'cheque_no', checknumber: 'cheque_no', chkno: 'cheque_no',
  chequeno: 'cheque_no', no: 'cheque_no', number: 'cheque_no', chqnumber: 'cheque_no',
  // bank_name
  bank: 'bank_name', bankname: 'bank_name', drawnon: 'bank_name', bankdrawnon: 'bank_name',
  // direction
  direction: 'direction', type: 'direction', chequetype: 'direction', chqtype: 'direction',
  // party_name
  party: 'party_name', partyname: 'party_name', name: 'party_name',
  suppliercustomer: 'party_name', payee: 'party_name', drawer: 'party_name',
  customer: 'party_name', supplier: 'party_name', favourof: 'party_name',
  infavourof: 'party_name', issuedto: 'party_name', receivedfrom: 'party_name',
  // amount
  amount: 'amount', amt: 'amount', value: 'amount', chqamount: 'amount',
  chequeamount: 'amount', amountbhd: 'amount', bhd: 'amount',
  // cheque_date
  chequedate: 'cheque_date', chqdate: 'cheque_date', duedate: 'cheque_date',
  postdate: 'cheque_date', postdateddate: 'cheque_date', valuedate: 'cheque_date',
  maturitydate: 'cheque_date', date: 'cheque_date', checkdate: 'cheque_date',
  // issue_date
  issuedate: 'issue_date', issueddate: 'issue_date', entrydate: 'issue_date',
  receiptdate: 'issue_date', recordeddate: 'issue_date',
  // status
  status: 'status', chequestatus: 'status', clearingstatus: 'status', state: 'status',
  // notes
  notes: 'notes', note: 'notes', remarks: 'notes', remark: 'notes',
  reference: 'notes', ref: 'notes', description: 'notes', narration: 'notes',
  particulars: 'notes',
}

function mapHeaders(rawHeaders) {
  // Returns { fieldName: colIndex } for each recognised header
  const map = {}
  rawHeaders.forEach((h, i) => {
    const key = normHeader(h)
    const field = HEADER_MAP[key]
    if (field && !(field in map)) map[field] = i  // first match wins
  })
  return map
}

// Parse an Excel date serial or string → 'YYYY-MM-DD'
function parseExcelDate(val) {
  if (!val) return null
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  const s = String(val).trim()
  // DD/MM/YYYY
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // MM/DD/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
  // Try JS Date as fallback
  const d = new Date(s)
  if (!isNaN(d)) return d.toISOString().split('T')[0]
  return null
}

function parseDirection(val) {
  const s = String(val || '').toLowerCase().trim()
  if (/^(issued?|out(going)?|payment|paid|given|i)$/.test(s)) return 'issued'
  if (/^(received?|in(coming)?|receipt|recv?d?|r)$/.test(s))  return 'received'
  return null
}

function parseStatus(val) {
  const s = String(val || '').toLowerCase().trim()
  if (/^(clear(ed)?|c|presented|honoured?|paid|encashed)$/.test(s)) return 'cleared'
  if (/^(bounc(ed)?|b|dishonoured?|returned?|unpaid)$/.test(s))     return 'bounced'
  if (/^(cancel(led)?|void(ed)?|v|x)$/.test(s))                     return 'cancelled'
  return 'pending'  // default
}

function parseAmount(val) {
  if (val == null || val === '') return null
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) || n <= 0 ? null : n
}

router.use(authenticate);

// List cheques — filterable by direction, status, date range
router.get('/', async (req, res, next) => {
  try {
    const { direction, status, from, to, q } = req.query;
    const params = [req.user.company_id];
    let where = ['ch.company_id = $1'];

    if (direction) { params.push(direction); where.push(`ch.direction = $${params.length}`); }
    if (status)    { params.push(status);    where.push(`ch.status = $${params.length}`); }
    if (from)      { params.push(from);      where.push(`ch.cheque_date >= $${params.length}`); }
    if (to)        { params.push(to);        where.push(`ch.cheque_date <= $${params.length}`); }
    if (q)         { params.push(`%${q}%`);  where.push(`(ch.cheque_no ILIKE $${params.length} OR ch.party_name ILIKE $${params.length} OR ch.bank_name ILIKE $${params.length})`); }

    const { rows } = await db.query(
      `SELECT ch.*, c.name AS party_name_from_db
       FROM cheques ch
       LEFT JOIN customers c ON c.id = ch.party_id
       WHERE ${where.join(' AND ')}
       ORDER BY ch.cheque_date ASC, ch.created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Financial summary: receivables, payables, upcoming cheques
router.get('/summary', async (req, res, next) => {
  try {
    const co = req.user.company_id;

    const [ar, ap, chqIssued, chqReceived, bankRows, agingRows, writeOffRows] = await Promise.all([
      // Accounts receivable
      db.query(
        `SELECT COALESCE(SUM(balance_due),0) AS total,
                COUNT(*) FILTER (WHERE payment_status='overdue') AS overdue_count,
                COALESCE(SUM(balance_due) FILTER (WHERE payment_status='overdue'),0) AS overdue_amount
         FROM invoices WHERE company_id=$1 AND type='tax_invoice' AND payment_status IN ('unpaid','partial','overdue')`, [co]),
      // Accounts payable
      db.query(
        `SELECT COALESCE(SUM(grand_total - amount_paid),0) AS total
         FROM purchases WHERE company_id=$1 AND payment_status != 'paid'`, [co]),
      // Pending issued cheques (next 90 days cash out)
      db.query(
        `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count,
                COALESCE(SUM(amount) FILTER (WHERE cheque_date <= CURRENT_DATE + 30),0) AS due_30d,
                COALESCE(SUM(amount) FILTER (WHERE cheque_date <= CURRENT_DATE + 60),0) AS due_60d,
                COALESCE(SUM(amount) FILTER (WHERE cheque_date <= CURRENT_DATE + 90),0) AS due_90d
         FROM cheques WHERE company_id=$1 AND direction='issued' AND status='pending'`, [co]),
      // Pending received cheques (incoming)
      db.query(
        `SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
         FROM cheques WHERE company_id=$1 AND direction='received' AND status='pending'`, [co]),
      // Bank accounts
      db.query(
        `SELECT id, bank_name, account_name, current_balance, currency
         FROM bank_accounts WHERE company_id=$1 AND is_active=true ORDER BY bank_name`, [co]),
      // AR aging buckets
      db.query(
        `SELECT
           COALESCE(SUM(balance_due) FILTER (WHERE due_date >= CURRENT_DATE),0)            AS current_amt,
           COALESCE(SUM(balance_due) FILTER (WHERE due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - 30),0) AS overdue_30,
           COALESCE(SUM(balance_due) FILTER (WHERE due_date < CURRENT_DATE - 30 AND due_date >= CURRENT_DATE - 60),0) AS overdue_60,
           COALESCE(SUM(balance_due) FILTER (WHERE due_date < CURRENT_DATE - 60),0)        AS overdue_90plus
         FROM invoices WHERE company_id=$1 AND type='tax_invoice' AND payment_status IN ('unpaid','partial','overdue')`, [co]),
      // Write-off YTD
      db.query(
        `SELECT COALESCE(SUM(write_off_amount),0) AS ytd_total,
                COUNT(*) AS ytd_count
         FROM invoices WHERE company_id=$1 AND write_off_date IS NOT NULL
           AND write_off_date >= date_trunc('year', CURRENT_DATE)`, [co]),
    ]);

    res.json({
      data: {
        receivables: {
          total:          parseFloat(ar.rows[0].total).toFixed(3),
          overdue_count:  parseInt(ar.rows[0].overdue_count),
          overdue_amount: parseFloat(ar.rows[0].overdue_amount).toFixed(3),
        },
        payables: {
          total: parseFloat(ap.rows[0].total).toFixed(3),
        },
        cheques_issued: {
          total:  parseFloat(chqIssued.rows[0].total).toFixed(3),
          count:  parseInt(chqIssued.rows[0].count),
          due_30d: parseFloat(chqIssued.rows[0].due_30d).toFixed(3),
          due_60d: parseFloat(chqIssued.rows[0].due_60d).toFixed(3),
          due_90d: parseFloat(chqIssued.rows[0].due_90d).toFixed(3),
        },
        cheques_received: {
          total: parseFloat(chqReceived.rows[0].total).toFixed(3),
          count: parseInt(chqReceived.rows[0].count),
        },
        ar_aging: agingRows.rows[0],
        write_offs_ytd: {
          total: parseFloat(writeOffRows.rows[0].ytd_total).toFixed(3),
          count: parseInt(writeOffRows.rows[0].ytd_count),
        },
        bank_accounts: bankRows.rows.map(b => ({
          id:              b.id,
          bank_name:       b.bank_name,
          account_name:    b.account_name,
          current_balance: parseFloat(b.current_balance).toFixed(3),
          currency:        b.currency,
        })),
        bank_total: bankRows.rows.reduce((s,b) => s + parseFloat(b.current_balance||0), 0).toFixed(3),
      }
    });
  } catch (err) { next(err); }
});

// Create cheque
router.post('/', authorize('admin','accountant','sales'), async (req, res, next) => {
  try {
    const { cheque_no, bank_name, direction, party_id, party_name,
            amount, cheque_date, issue_date, purchase_id, invoice_id, notes } = req.body;
    const { rows: [row] } = await db.query(
      `INSERT INTO cheques (id,company_id,cheque_no,bank_name,direction,party_id,party_name,
         amount,cheque_date,issue_date,purchase_id,invoice_id,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [uuid(), req.user.company_id, cheque_no, bank_name||null, direction,
       party_id||null, party_name||null, amount, cheque_date,
       issue_date || new Date().toISOString().split('T')[0],
       purchase_id||null, invoice_id||null, notes||null, req.user.id]
    );
    res.status(201).json({ data: row });
  } catch (err) { next(err); }
});

// Update cheque status (cleared / bounced / cancelled)
router.patch('/:id/status', authorize('admin','accountant'), async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const { rows: [row] } = await db.query(
      `UPDATE cheques SET status=$1, notes=COALESCE($2, notes)
       WHERE id=$3 AND company_id=$4 RETURNING *`,
      [status, notes||null, req.params.id, req.user.company_id]
    );
    if (!row) return res.status(404).json({ error: { message: 'Cheque not found' } });
    res.json({ data: row });
  } catch (err) { next(err); }
});

// Delete (hard delete — only admin, only pending)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM cheques WHERE id=$1 AND company_id=$2 AND status='pending'`,
      [req.params.id, req.user.company_id]
    );
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// ── Download import template ──────────────────────────────────
router.get('/import-template', authenticate, (req, res) => {
  const wb = XLSX.utils.book_new()
  const headers = ['Cheque No', 'Bank Name', 'Direction', 'Party Name', 'Amount',
                   'Issue Date', 'Cheque Date', 'Status', 'Notes']
  const sample = [
    ['000101', 'BBK',         'Issued',   'Al Noor Supplies',     1250.500, '15/01/2026', '30/01/2026', 'Pending',  'PUR-2026-0012'],
    ['000102', 'Ahli United', 'Issued',   'Gulf Electric',         850.000, '15/01/2026', '15/02/2026', 'Cleared',  ''],
    ['CQ-001', 'NBB',         'Received', 'Al Manama Trading',    3400.000, '10/01/2026', '10/03/2026', 'Pending',  'INV-2026-0045'],
    ['CQ-002', 'BisB',        'Received', 'Star Contractors',      975.250, '08/01/2026', '08/02/2026', 'Bounced',  'Re-presented'],
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample])
  ws['!cols'] = [14, 16, 12, 24, 12, 14, 14, 12, 28].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, 'Cheques')

  // Guidance sheet
  const guide = XLSX.utils.aoa_to_sheet([
    ['Column', 'Required?', 'Accepted values / format'],
    ['Cheque No',   'Yes', 'Any text — must be unique per direction'],
    ['Bank Name',   'No',  'Free text — e.g. BBK, Ahli United, NBB'],
    ['Direction',   'Yes', 'Issued  OR  Received  (case-insensitive)'],
    ['Party Name',  'No',  'Supplier or customer name'],
    ['Amount',      'Yes', 'Numeric — do not include currency symbol'],
    ['Issue Date',  'No',  'DD/MM/YYYY  or  YYYY-MM-DD'],
    ['Cheque Date', 'Yes', 'DD/MM/YYYY  or  YYYY-MM-DD  (post-date / value date)'],
    ['Status',      'No',  'Pending (default)  |  Cleared  |  Bounced  |  Cancelled'],
    ['Notes',       'No',  'Reference, invoice no., remarks, etc.'],
  ])
  guide['!cols'] = [16, 12, 42].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, guide, 'Guide')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', 'attachment; filename="cheque_import_template.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

// ── Preview & Import from Excel ───────────────────────────────
router.post('/import', authenticate, authorize('admin', 'accountant'),
  upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: { message: 'No file uploaded' } })

    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (raw.length < 2) return res.status(400).json({ error: { message: 'File is empty or has no data rows' } })

    const headerRow = raw[0]
    const colMap = mapHeaders(headerRow)

    // Require at least cheque_no + amount + cheque_date
    const missing = ['cheque_no', 'amount', 'cheque_date'].filter(f => !(f in colMap))
    if (missing.length) {
      return res.status(400).json({ error: {
        message: `Could not find required column(s): ${missing.join(', ')}. ` +
                 `Headers found: ${headerRow.filter(Boolean).join(', ')}`
      }})
    }

    const companyId = req.user.company_id
    const preview   = req.query.preview === '1'

    // Build a name→id lookup for existing customers (case-insensitive)
    const custRes = await db.query(
      `SELECT id, LOWER(name) AS lname FROM customers WHERE company_id=$1`, [companyId])
    const custByName = {}
    for (const r of custRes.rows) custByName[r.lname] = r.id

    // Load existing cheque_no+direction pairs to detect duplicates
    const existRes = await db.query(
      `SELECT LOWER(cheque_no) AS chq, direction FROM cheques WHERE company_id=$1`, [companyId])
    const existSet = new Set(existRes.rows.map(r => `${r.chq}||${r.direction}`))

    const today = new Date().toISOString().split('T')[0]
    const get   = (row, field) => colMap[field] !== undefined ? row[colMap[field]] : ''

    const rows = []
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i]
      // Skip completely blank rows
      if (row.every(c => c === '' || c == null)) continue

      const cheque_no  = String(get(row, 'cheque_no') || '').trim()
      const amount     = parseAmount(get(row, 'amount'))
      const chequeDate = parseExcelDate(get(row, 'cheque_date'))
      const issueDate  = parseExcelDate(get(row, 'issue_date')) || today
      const bankName   = String(get(row, 'bank_name') || '').trim() || null
      const partyRaw   = String(get(row, 'party_name') || '').trim()
      const dirRaw     = get(row, 'direction')
      const statusRaw  = get(row, 'status')
      const notes      = String(get(row, 'notes') || '').trim() || null

      const errors = []
      if (!cheque_no)  errors.push('missing cheque no')
      if (!amount)     errors.push('invalid amount')
      if (!chequeDate) errors.push('invalid cheque date')

      const direction = parseDirection(dirRaw)
      if (!direction) errors.push(`unrecognised direction "${dirRaw}" — use Issued or Received`)

      const status  = parseStatus(statusRaw)
      const partyId = partyRaw ? (custByName[partyRaw.toLowerCase()] || null) : null

      const isDuplicate = cheque_no && direction
        ? existSet.has(`${cheque_no.toLowerCase()}||${direction}`)
        : false

      rows.push({
        row: i + 1,
        cheque_no,
        bank_name:   bankName,
        direction,
        party_name:  partyRaw || null,
        party_id:    partyId,
        amount,
        cheque_date: chequeDate,
        issue_date:  issueDate,
        status,
        notes,
        errors,
        is_duplicate: isDuplicate,
        party_matched: !!partyId,
      })
    }

    const valid  = rows.filter(r => r.errors.length === 0 && !r.is_duplicate)
    const errors = rows.filter(r => r.errors.length > 0)
    const dupes  = rows.filter(r => r.is_duplicate)

    if (preview) {
      return res.json({ data: { rows, valid: valid.length, errors: errors.length, duplicates: dupes.length } })
    }

    // Commit valid rows
    if (!valid.length) {
      return res.status(400).json({ error: { message: 'No valid rows to import' } })
    }

    const client = await db.pool.connect()
    try {
      await client.query('BEGIN')
      for (const r of valid) {
        await client.query(
          `INSERT INTO cheques (id, company_id, cheque_no, bank_name, direction,
             party_id, party_name, amount, cheque_date, issue_date, status, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [uuid(), companyId, r.cheque_no, r.bank_name, r.direction,
           r.party_id, r.party_name, r.amount, r.cheque_date, r.issue_date,
           r.status, r.notes, req.user.id]
        )
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    res.json({ data: { imported: valid.length, skipped_errors: errors.length, skipped_duplicates: dupes.length } })
  } catch (err) { next(err) }
})

// ── Single cheque fetch (for print routes) ────────────────────
async function fetchChequeWithCompany(id, co_id) {
  const { rows } = await db.query(`
    SELECT ch.*,
           i.invoice_no,
           pu.purchase_no,
           co.name, co.name_ar, co.address, co.tel, co.email,
           co.vat_number, co.cr_number, co.logo, co.theme_color,
           co.bank_name AS co_bank_name, co.bank_iban, co.bank_acct_name
    FROM cheques ch
    LEFT JOIN invoices  i  ON i.id  = ch.invoice_id
    LEFT JOIN purchases pu ON pu.id = ch.purchase_id
    JOIN companies co ON co.id = ch.company_id
    WHERE ch.id = $1 AND ch.company_id = $2`, [id, co_id]);
  if (!rows[0]) return null;
  const r  = rows[0];
  const co = {
    name: r.name, name_ar: r.name_ar, address: r.address, tel: r.tel,
    email: r.email, vat_number: r.vat_number, cr_number: r.cr_number,
    logo: r.logo, theme_color: r.theme_color,
    bank_name: r.co_bank_name, bank_iban: r.bank_iban, bank_acct_name: r.bank_acct_name,
  };
  return { ...r, invoice_no: r.invoice_no, purchase_no: r.purchase_no, company: co };
}

// GET /cheques/:id/voucher  — Payment Voucher (A4, browser print)
router.get('/:id/voucher', authenticate, async (req, res, next) => {
  try {
    const cheque = await fetchChequeWithCompany(req.params.id, req.user.company_id);
    if (!cheque) return res.status(404).json({ error: { message: 'Cheque not found' } });
    const html = pdfSvc.chequeVoucherHtml(cheque, cheque.company);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
});

// GET /cheques/:id/print-cheque?bank=nbb  — Cheque paper print
router.get('/:id/print-cheque', authenticate, async (req, res, next) => {
  try {
    const bank   = (req.query.bank || 'nbb').toLowerCase();
    const cheque = await fetchChequeWithCompany(req.params.id, req.user.company_id);
    if (!cheque) return res.status(404).json({ error: { message: 'Cheque not found' } });
    // Only issued cheques can be printed onto cheque paper
    if (cheque.direction !== 'issued')
      return res.status(400).json({ error: { message: 'Only issued cheques can be printed on cheque paper' } });
    let html;
    if (bank === 'nbb') html = pdfSvc.chequeNbbHtml(cheque, cheque.company);
    else return res.status(400).json({ error: { message: `Bank template "${bank}" not supported yet` } });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
});

module.exports = router;
