const router = require('express').Router();
const db     = require('../db');
const { v4: uuid } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');

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

module.exports = router;
