const db     = require('../db');
const pdfSvc = require('../services/pdfService');

// ── VAT Report — Bahrain NBR format ───────────────────────
exports.vatReport = async (req, res, next) => {
  try {
    const { from, to, quarter } = req.query;
    const co_id = req.user.company_id;

    // Determine date range — accept explicit dates or quarter shorthand (Q1-Q4 YYYY)
    let dateFrom = from, dateTo = to;
    if (quarter && !from) {
      const [q, yr] = quarter.split('-');
      const qNum = parseInt(q.replace('Q',''));
      const qStart = [0,1,4,7,10][qNum];
      dateFrom = `${yr}-${String(qStart).padStart(2,'0')}-01`;
      const qEnd = [0,3,6,9,12][qNum];
      dateTo = new Date(yr, qEnd, 0).toISOString().split('T')[0];
    }

    // Output VAT (sales)
    const { rows: outputRows } = await db.query(
      `SELECT i.invoice_no, i.invoice_date, c.name AS customer_name,
              c.vat_number AS customer_vat,
              i.subtotal AS net_amount,
              i.total_discount,
              i.subtotal - i.total_discount AS taxable_amount,
              i.total_vat AS vat_amount,
              i.grand_total
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.company_id = $1
         AND i.type = 'tax_invoice'
         AND i.payment_status != 'void'
         AND i.invoice_date BETWEEN $2 AND $3
       ORDER BY i.invoice_date, i.invoice_no`,
      [co_id, dateFrom, dateTo]);

    // Credit notes (reduce output VAT)
    const { rows: creditRows } = await db.query(
      `SELECT i.invoice_no, i.invoice_date, c.name AS customer_name,
              i.total_vat AS vat_amount
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.company_id = $1 AND i.type = 'credit_note'
         AND i.invoice_date BETWEEN $2 AND $3`,
      [co_id, dateFrom, dateTo]);

    // Input VAT (purchases + expenses)
    const { rows: inputRows } = await db.query(
      `SELECT * FROM v_vat_input
       WHERE company_id = $1 AND txn_date BETWEEN $2 AND $3
       ORDER BY txn_date`, [co_id, dateFrom, dateTo]);

    const totalOutputVat  = outputRows.reduce((s, r) => s + parseFloat(r.vat_amount), 0);
    const totalCreditVat  = creditRows.reduce((s, r) => s + parseFloat(r.vat_amount), 0);
    const totalInputVat   = inputRows.reduce((s, r) => s + parseFloat(r.vat_amount), 0);
    const netVat          = totalOutputVat + totalCreditVat - totalInputVat; // credits are negative

    const totalTaxableNet = outputRows.reduce((s, r) => s + parseFloat(r.taxable_amount || r.net_amount), 0);

    res.json({
      data: {
        period: { from: dateFrom, to: dateTo },
        output_vat: {
          rows: outputRows,
          total_net: totalTaxableNet.toFixed(3),
          total_vat: totalOutputVat.toFixed(3),
        },
        credit_notes: {
          rows: creditRows,
          total_vat: totalCreditVat.toFixed(3),
        },
        input_vat: {
          rows: inputRows,
          total_vat: totalInputVat.toFixed(3),
        },
        summary: {
          output_vat:     totalOutputVat.toFixed(3),
          credit_vat:     totalCreditVat.toFixed(3),
          input_vat:      totalInputVat.toFixed(3),
          net_vat_payable: netVat.toFixed(3),
          currency: 'BHD',
        },
        nbr_filing: {
          box_1_taxable_supplies:  totalTaxableNet.toFixed(3),
          box_2_output_vat:        totalOutputVat.toFixed(3),
          box_3_input_vat:         totalInputVat.toFixed(3),
          box_4_net_vat_payable:   netVat.toFixed(3),
          note: 'Values for Bahrain NBR VAT Return filing. Verify with your accountant before submitting.',
        }
      }
    });
  } catch (err) { next(err); }
};

// ── Profit & Loss ─────────────────────────────────────────
exports.profitLoss = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const co_id = req.user.company_id;

    // Revenue — from invoices
    const { rows: revenueRows } = await db.query(
      `SELECT cat.name AS category, SUM(ii.net_amount) AS net_sales
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       LEFT JOIN products p ON p.id = ii.product_id
       LEFT JOIN categories cat ON cat.id = p.category_id
       WHERE i.company_id = $1 AND i.type = 'tax_invoice'
         AND i.payment_status != 'void'
         AND i.invoice_date BETWEEN $2 AND $3
       GROUP BY cat.name
       ORDER BY net_sales DESC`, [co_id, from, to]);

    const totalRevenue = revenueRows.reduce((s, r) => s + parseFloat(r.net_sales), 0);

    // COGS — calculated directly from cost_price × qty on invoiced lines
    // (stock_movements is not used as the importer populates via direct inserts)
    const { rows: [cogsRow] } = await db.query(
      `SELECT COALESCE(SUM(ii.qty::numeric * ii.unit_cost::numeric), 0) AS value
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE i.company_id = $1
         AND i.type = 'tax_invoice'
         AND i.payment_status != 'void'
         AND i.invoice_date BETWEEN $2 AND $3`,
      [co_id, from, to]);

    const { rows: [purchases] } = await db.query(
      `SELECT COALESCE(SUM(pur.subtotal), 0) AS value
       FROM purchases pur
       WHERE pur.company_id = $1 AND pur.purchase_date BETWEEN $2 AND $3`,
      [co_id, from, to]);

    const cogs = parseFloat(cogsRow.value);

    // Expenses
    const { rows: expenseRows } = await db.query(
      `SELECT cat.name AS category, SUM(e.net_amount) AS total
       FROM expenses e
       LEFT JOIN categories cat ON cat.id = e.category_id
       WHERE e.company_id = $1 AND e.expense_date BETWEEN $2 AND $3
       GROUP BY cat.name`, [co_id, from, to]);

    const totalExpenses = expenseRows.reduce((s, r) => s + parseFloat(r.total), 0);
    const grossProfit   = totalRevenue - cogs;
    const netProfit     = grossProfit - totalExpenses;

    res.json({
      data: {
        period: { from, to },
        revenue:        { rows: revenueRows, total: totalRevenue.toFixed(3) },
        cogs: {
          direct_cost:   parseFloat(cogsRow.value).toFixed(3),
          purchases:     parseFloat(purchases.value).toFixed(3),
          total:         cogs.toFixed(3),
        },
        gross_profit:   grossProfit.toFixed(3),
        expenses:       { rows: expenseRows, total: totalExpenses.toFixed(3) },
        net_profit:     netProfit.toFixed(3),
        margin_pct:     totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0',
      }
    });
  } catch (err) { next(err); }
};

// ── Balance Sheet ─────────────────────────────────────────
exports.balanceSheet = async (req, res, next) => {
  try {
    const { as_at } = req.query;
    const co_id = req.user.company_id;
    const asAtDate = as_at || new Date().toISOString().split('T')[0];

    // Accounts receivable — tax invoices only (excludes quotations/proformas/DNs)
    const { rows: [ar] } = await db.query(
      `SELECT COALESCE(SUM(balance_due), 0) AS value
       FROM invoices WHERE company_id = $1
         AND type = 'tax_invoice'
         AND payment_status IN ('unpaid','partial','overdue')
         AND invoice_date <= $2`, [co_id, asAtDate]);

    // Inventory value
    const { rows: [inv] } = await db.query(
      `SELECT COALESCE(SUM(cost_price * stock_qty), 0) AS value
       FROM products WHERE company_id = $1 AND is_active = true`, [co_id]);

    // VAT receivable (input VAT not yet offset)
    const { rows: [vatIn] } = await db.query(
      `SELECT COALESCE(SUM(vat_amount), 0) AS value FROM v_vat_input
       WHERE company_id = $1`, [co_id]);

    const { rows: [vatOut] } = await db.query(
      `SELECT COALESCE(SUM(total_vat), 0) AS value
       FROM invoices WHERE company_id = $1
         AND type = 'tax_invoice' AND payment_status != 'void'`, [co_id]);

    const vatBalance = parseFloat(vatOut.value) - parseFloat(vatIn.value);

    // Bank balance (sum of all accounts)
    const { rows: [bank] } = await db.query(
      `SELECT COALESCE(SUM(current_balance), 0) AS value
       FROM bank_accounts WHERE company_id = $1 AND is_active = true`, [co_id]);

    // Accounts payable (unpaid purchases)
    const { rows: [ap] } = await db.query(
      `SELECT COALESCE(SUM(grand_total - amount_paid), 0) AS value
       FROM purchases WHERE company_id = $1 AND payment_status != 'paid'`, [co_id]);

    const totalAssets      = parseFloat(bank.value) + parseFloat(ar.value) + parseFloat(inv.value) + (vatBalance < 0 ? Math.abs(vatBalance) : 0);
    const totalLiabilities = parseFloat(ap.value) + (vatBalance > 0 ? vatBalance : 0);
    const equity           = totalAssets - totalLiabilities;

    res.json({
      data: {
        as_at: asAtDate,
        assets: {
          cash_at_bank:        parseFloat(bank.value).toFixed(3),
          accounts_receivable: parseFloat(ar.value).toFixed(3),
          inventory:           parseFloat(inv.value).toFixed(3),
          vat_receivable:      vatBalance < 0 ? Math.abs(vatBalance).toFixed(3) : '0.000',
          total:               totalAssets.toFixed(3),
        },
        liabilities: {
          accounts_payable:    parseFloat(ap.value).toFixed(3),
          vat_payable:         vatBalance > 0 ? vatBalance.toFixed(3) : '0.000',
          total:               totalLiabilities.toFixed(3),
        },
        equity: {
          total:               equity.toFixed(3),
        },
        check: {
          balanced: Math.abs(totalAssets - totalLiabilities - equity) < 0.01,
        }
      }
    });
  } catch (err) { next(err); }
};

// ── Overdue Report ─────────────────────────────────────────
exports.overdue = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT i.*, c.name AS customer_name, c.tel AS customer_tel, c.email AS customer_email,
              (CURRENT_DATE - i.due_date)::int AS days_overdue
       FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE i.company_id = $1
         AND i.type = 'tax_invoice'
         AND i.payment_status IN ('unpaid','partial')
         AND i.due_date < CURRENT_DATE
       ORDER BY days_overdue DESC`, [req.user.company_id]);
    const totalOverdue = rows.reduce((s, r) => s + parseFloat(r.balance_due), 0);
    res.json({ data: rows, total_overdue: totalOverdue.toFixed(3) });
  } catch (err) { next(err); }
};

// ── Statement of Accounts ─────────────────────────────────
exports.statement = async (req, res, next) => {
  try {
    const { customer_id, from, to } = req.query;
    const co_id = req.user.company_id;

    if (!customer_id) return res.status(400).json({ error: { message: 'customer_id required' } });
    if (!from || !to)  return res.status(400).json({ error: { message: 'from and to dates required' } });

    // Customer info
    const { rows: [customer] } = await db.query(
      `SELECT id, code, name, address, tel, email, vat_number, payment_terms_days
       FROM customers WHERE id = $1 AND company_id = $2`,
      [customer_id, co_id]);
    if (!customer) return res.status(404).json({ error: { message: 'Customer not found' } });

    // Company info (for letterhead)
    const { rows: [company] } = await db.query(
      `SELECT name, name_ar, cr_number, vat_number, address, tel, email,
              bank_name, bank_acct_name, bank_iban, bank_swift
       FROM companies WHERE id = $1`, [co_id]);

    // Opening balance = total invoiced before 'from' minus payments received before 'from'
    const { rows: [ob] } = await db.query(
      `SELECT
         COALESCE(SUM(i.grand_total), 0)                                       AS total_invoiced,
         COALESCE((
           SELECT SUM(p.amount) FROM payments p
           JOIN   invoices pi ON pi.id = p.reference_id
           WHERE  pi.customer_id = $1 AND pi.company_id = $2
             AND  p.reference_type = 'invoice' AND p.payment_date < $3
         ), 0)                                                                  AS total_paid
       FROM invoices i
       WHERE i.customer_id = $1 AND i.company_id = $2
         AND i.type IN ('tax_invoice', 'credit_note')
         AND i.payment_status != 'void' AND i.invoice_date < $3`,
      [customer_id, co_id, from]);

    const openingBalance = parseFloat(ob.total_invoiced) - parseFloat(ob.total_paid);

    // Period transactions: invoices + credit notes + payments (chronological)
    const { rows: txns } = await db.query(
      `SELECT * FROM (

        -- Invoices & credit notes issued in period
        SELECT
          i.invoice_date   AS txn_date,
          i.created_at     AS sort_ts,
          CASE i.type
            WHEN 'credit_note' THEN 'credit_note'
            ELSE 'invoice'
          END              AS txn_type,
          i.invoice_no     AS ref_no,
          i.type::text     AS doc_type,
          CASE WHEN i.type = 'credit_note' THEN 0          ELSE i.grand_total END AS debit,
          CASE WHEN i.type = 'credit_note' THEN i.grand_total ELSE 0          END AS credit,
          i.id             AS ref_id,
          i.notes          AS notes
        FROM invoices i
        WHERE i.customer_id = $1 AND i.company_id = $2
          AND i.type IN ('tax_invoice', 'credit_note')
          AND i.payment_status != 'void'
          AND i.invoice_date BETWEEN $3 AND $4

        UNION ALL

        -- Payments received in period (against any of this customer's invoices)
        SELECT
          p.payment_date   AS txn_date,
          p.created_at     AS sort_ts,
          'payment'        AS txn_type,
          COALESCE(p.reference_no, 'Payment') AS ref_no,
          p.method::text   AS doc_type,
          0                AS debit,
          p.amount         AS credit,
          p.id             AS ref_id,
          p.notes          AS notes
        FROM payments p
        JOIN invoices i ON i.id = p.reference_id
        WHERE i.customer_id = $1 AND p.company_id = $2
          AND p.reference_type = 'invoice'
          AND p.payment_date BETWEEN $3 AND $4

      ) t ORDER BY txn_date, sort_ts`,
      [customer_id, co_id, from, to]);

    // Add running balance
    let balance = openingBalance;
    const rows = txns.map(r => {
      balance += parseFloat(r.debit) - parseFloat(r.credit);
      return { ...r, balance: parseFloat(balance.toFixed(3)) };
    });

    const totalDebit  = rows.reduce((s, r) => s + parseFloat(r.debit),  0);
    const totalCredit = rows.reduce((s, r) => s + parseFloat(r.credit), 0);
    const closingBalance = openingBalance + totalDebit - totalCredit;

    res.json({
      data: {
        customer,
        company,
        period:          { from, to },
        opening_balance: parseFloat(openingBalance.toFixed(3)),
        rows,
        totals: {
          debit:   parseFloat(totalDebit.toFixed(3)),
          credit:  parseFloat(totalCredit.toFixed(3)),
        },
        closing_balance: parseFloat(closingBalance.toFixed(3)),
      }
    });
  } catch (err) { next(err); }
};

// ── Statement PDF ──────────────────────────────────────────
async function buildStatementData(req) {
  const { customer_id, from, to } = req.query;
  const co_id = req.user.company_id;

  if (!customer_id) throw Object.assign(new Error('customer_id required'), { status: 400 });
  if (!from || !to)  throw Object.assign(new Error('from and to dates required'), { status: 400 });

  const { rows: [customer] } = await db.query(
    `SELECT id, code, name, address, tel, email, vat_number, payment_terms_days
     FROM customers WHERE id = $1 AND company_id = $2`,
    [customer_id, co_id]);
  if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });

  const { rows: [company] } = await db.query(
    `SELECT name, name_ar, cr_number, vat_number, address, tel, email,
            bank_name, bank_acct_name, bank_iban, bank_swift, theme_color
     FROM companies WHERE id = $1`, [co_id]);

  const { rows: [ob] } = await db.query(
    `SELECT
       COALESCE(SUM(i.grand_total), 0) AS total_invoiced,
       COALESCE((
         SELECT SUM(p.amount) FROM payments p
         JOIN   invoices pi ON pi.id = p.reference_id
         WHERE  pi.customer_id = $1 AND pi.company_id = $2
           AND  p.reference_type = 'invoice' AND p.payment_date < $3
       ), 0) AS total_paid
     FROM invoices i
     WHERE i.customer_id = $1 AND i.company_id = $2
       AND i.type IN ('tax_invoice', 'credit_note')
       AND i.payment_status != 'void' AND i.invoice_date < $3`,
    [customer_id, co_id, from]);

  const openingBalance = parseFloat(ob.total_invoiced) - parseFloat(ob.total_paid);

  const { rows: txns } = await db.query(
    `SELECT * FROM (
      SELECT i.invoice_date AS txn_date, i.created_at AS sort_ts,
        CASE i.type WHEN 'credit_note' THEN 'credit_note' ELSE 'invoice' END AS txn_type,
        i.invoice_no AS ref_no, i.type::text AS doc_type,
        CASE WHEN i.type = 'credit_note' THEN 0 ELSE i.grand_total END AS debit,
        CASE WHEN i.type = 'credit_note' THEN i.grand_total ELSE 0  END AS credit,
        i.id AS ref_id, i.notes AS notes
      FROM invoices i
      WHERE i.customer_id = $1 AND i.company_id = $2
        AND i.type IN ('tax_invoice', 'credit_note')
        AND i.payment_status != 'void'
        AND i.invoice_date BETWEEN $3 AND $4
      UNION ALL
      SELECT p.payment_date AS txn_date, p.created_at AS sort_ts,
        'payment' AS txn_type,
        COALESCE(p.reference_no, 'Payment') AS ref_no,
        p.method::text AS doc_type, 0 AS debit, p.amount AS credit,
        p.id AS ref_id, p.notes AS notes
      FROM payments p
      JOIN invoices i ON i.id = p.reference_id
      WHERE i.customer_id = $1 AND p.company_id = $2
        AND p.reference_type = 'invoice'
        AND p.payment_date BETWEEN $3 AND $4
    ) t ORDER BY txn_date, sort_ts`,
    [customer_id, co_id, from, to]);

  let balance = openingBalance;
  const rows = txns.map(r => {
    balance += parseFloat(r.debit) - parseFloat(r.credit);
    return { ...r, balance: parseFloat(balance.toFixed(3)) };
  });

  const totalDebit   = rows.reduce((s, r) => s + parseFloat(r.debit),  0);
  const totalCredit  = rows.reduce((s, r) => s + parseFloat(r.credit), 0);
  const closingBalance = openingBalance + totalDebit - totalCredit;

  return {
    customer, company,
    period:          { from, to },
    opening_balance: parseFloat(openingBalance.toFixed(3)),
    rows,
    totals: { debit: parseFloat(totalDebit.toFixed(3)), credit: parseFloat(totalCredit.toFixed(3)) },
    closing_balance: parseFloat(closingBalance.toFixed(3)),
  };
}

exports.statementPdf = async (req, res, next) => {
  try {
    const data = await buildStatementData(req);
    const pdf  = await pdfSvc.generateStatementPdf(data);
    const name = `Statement-${data.customer.code || data.customer.name}-${data.period.from}-${data.period.to}.pdf`;
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${name}"`);
    res.send(pdf);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
};

exports.statementPrint = async (req, res, next) => {
  try {
    const data = await buildStatementData(req);
    const html = pdfSvc.statementPrintHtml(data);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { message: err.message } });
    next(err);
  }
};

// ── Dashboard Summary ─────────────────────────────────────

function computeDashboardRange(period, customFrom, customTo) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  switch (period) {
    case 'month': {
      const from = `${year}-${String(month).padStart(2,'0')}-01`;
      const to   = new Date(year, month, 0).toISOString().split('T')[0];
      const label = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
      return { from, to, label, groupBy: 'day' };
    }
    case 'ytd': {
      const from = `${year}-01-01`;
      const to   = now.toISOString().split('T')[0];
      return { from, to, label: `YTD ${year}`, groupBy: 'month' };
    }
    case 'year': {
      return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year), groupBy: 'month' };
    }
    case 'last_year': {
      const ly = year - 1;
      return { from: `${ly}-01-01`, to: `${ly}-12-31`, label: String(ly), groupBy: 'month' };
    }
    case 'custom': {
      if (!customFrom || !customTo) break;
      const days = Math.round((new Date(customTo) - new Date(customFrom)) / 86400000);
      return { from: customFrom, to: customTo, label: `${customFrom} – ${customTo}`, groupBy: days <= 35 ? 'day' : 'month' };
    }
  }
  // default: current quarter
  const qNum        = Math.ceil(month / 3);
  const qStartMonth = (qNum - 1) * 3 + 1;
  const qEndMonth   = qNum * 3;
  const from = `${year}-${String(qStartMonth).padStart(2,'0')}-01`;
  const to   = new Date(year, qEndMonth, 0).toISOString().split('T')[0];
  return { from, to, label: `Q${qNum} ${year}`, groupBy: 'month' };
}

exports.dashboard = async (req, res, next) => {
  try {
    const co_id = req.user.company_id;
    const { period = 'quarter', from: qFrom, to: qTo } = req.query;
    const { from, to, label, groupBy } = computeDashboardRange(period, qFrom, qTo);

    // All period-scoped queries run in parallel
    const [
      { rows: [vatOut] },
      { rows: [vatIn] },
      { rows: [revRow] },
      { rows: [purRow] },
      { rows: [expRow] },
      { rows: [salesRow] },
      { rows: [stockRow] },
      { rows: chartRows },
      { rows: catSales },
      { rows: [arRow] },
    ] = await Promise.all([
      // VAT output
      db.query(
        `SELECT COALESCE(SUM(total_vat), 0) AS v
         FROM invoices
         WHERE company_id=$1 AND type='tax_invoice' AND payment_status!='void'
           AND invoice_date BETWEEN $2 AND $3`,
        [co_id, from, to]),
      // VAT input
      db.query(
        `SELECT COALESCE(SUM(vat_amount), 0) AS v FROM v_vat_input
         WHERE company_id=$1 AND txn_date BETWEEN $2 AND $3`,
        [co_id, from, to]),
      // Revenue (net, excl VAT)
      db.query(
        `SELECT COALESCE(SUM(ii.net_amount), 0) AS v
         FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
         WHERE i.company_id=$1 AND i.type='tax_invoice' AND i.payment_status!='void'
           AND i.invoice_date BETWEEN $2 AND $3`,
        [co_id, from, to]),
      // Purchases (COGS)
      db.query(
        `SELECT COALESCE(SUM(subtotal), 0) AS v FROM purchases
         WHERE company_id=$1 AND purchase_date BETWEEN $2 AND $3`,
        [co_id, from, to]),
      // Expenses
      db.query(
        `SELECT COALESCE(SUM(net_amount), 0) AS v FROM expenses
         WHERE company_id=$1 AND expense_date BETWEEN $2 AND $3`,
        [co_id, from, to]),
      // Total sales (incl VAT) + count for the period KPI tile
      db.query(
        `SELECT COALESCE(SUM(grand_total), 0) AS v, COUNT(*) AS cnt
         FROM invoices
         WHERE company_id=$1 AND type='tax_invoice' AND payment_status!='void'
           AND invoice_date BETWEEN $2 AND $3`,
        [co_id, from, to]),
      // Stock value (always point-in-time)
      db.query(
        `SELECT COALESCE(SUM(cost_price * stock_qty), 0) AS v,
                COUNT(*) FILTER (WHERE stock_qty > 0) AS with_stock
         FROM products WHERE company_id=$1 AND is_active=true`,
        [co_id]),
      // Sales chart — daily or monthly depending on groupBy
      groupBy === 'day'
        ? db.query(
            `SELECT invoice_date::date                   AS date_val,
                    TO_CHAR(invoice_date, 'DD Mon')      AS label,
                    COALESCE(SUM(grand_total), 0)        AS total
             FROM invoices
             WHERE company_id=$1 AND type='tax_invoice' AND payment_status!='void'
               AND invoice_date BETWEEN $2 AND $3
             GROUP BY invoice_date::date ORDER BY date_val`,
            [co_id, from, to])
        : db.query(
            `SELECT TO_CHAR(invoice_date, 'Mon')         AS label,
                    EXTRACT(YEAR  FROM invoice_date)::int AS yr,
                    EXTRACT(MONTH FROM invoice_date)::int AS mo,
                    COALESCE(SUM(grand_total), 0)         AS total
             FROM invoices
             WHERE company_id=$1 AND type='tax_invoice' AND payment_status!='void'
               AND invoice_date BETWEEN $2 AND $3
             GROUP BY 1,2,3 ORDER BY yr, mo`,
            [co_id, from, to]),
      // Sales by category — top 5 for the period
      db.query(
        `SELECT COALESCE(cat.name, 'Uncategorised') AS category,
                COALESCE(SUM(ii.net_amount), 0)     AS total
         FROM invoice_items ii
         JOIN  invoices i     ON i.id  = ii.invoice_id
         LEFT JOIN products p     ON p.id  = ii.product_id
         LEFT JOIN categories cat ON cat.id = p.category_id
         WHERE i.company_id=$1 AND i.type='tax_invoice' AND i.payment_status!='void'
           AND i.invoice_date BETWEEN $2 AND $3
         GROUP BY 1 ORDER BY total DESC LIMIT 5`,
        [co_id, from, to]),
      // True AR outstanding — all unpaid/partial/overdue tax invoices (no date filter, point-in-time)
      db.query(
        `SELECT COALESCE(SUM(balance_due), 0) AS outstanding,
                COUNT(*) FILTER (WHERE payment_status = 'overdue') AS overdue_count,
                COALESCE(SUM(balance_due) FILTER (WHERE payment_status = 'overdue'), 0) AS overdue_amount
         FROM invoices
         WHERE company_id=$1 AND type='tax_invoice'
           AND payment_status IN ('unpaid','partial','overdue')`,
        [co_id]),
    ]);

    const rev       = parseFloat(revRow.v);
    const netProfit = rev - parseFloat(purRow.v) - parseFloat(expRow.v);
    const marginPct = rev > 0 ? ((netProfit / rev) * 100).toFixed(1) : '0.0';
    const vatPayable = Math.max(0, parseFloat(vatOut.v) - parseFloat(vatIn.v));
    const totalCatSales = catSales.reduce((s, r) => s + parseFloat(r.total), 0);

    res.json({
      data: {
        period:              { label, from, to, groupBy },
        total_sales:         parseFloat(salesRow.v).toFixed(3),
        invoice_count:       parseInt(salesRow.cnt),
        vat_payable:         vatPayable.toFixed(3),
        net_profit:          netProfit.toFixed(3),
        margin_pct:          marginPct,
        stock_value:         parseFloat(stockRow.v).toFixed(3),
        stock_product_count: parseInt(stockRow.with_stock),
        ar_outstanding:      parseFloat(arRow.outstanding).toFixed(3),
        ar_overdue_count:    parseInt(arRow.overdue_count),
        ar_overdue_amount:   parseFloat(arRow.overdue_amount).toFixed(3),
        sales_chart: chartRows.map(r => ({
          label: r.label,
          total: parseFloat(r.total),
          ...(groupBy === 'day'
            ? { date: r.date_val }                             // ISO date string e.g. "2025-04-15"
            : { yr: parseInt(r.yr), mo: parseInt(r.mo) }),    // month e.g. { yr:2025, mo:4 }
        })),
        sales_by_category: catSales.map(r => ({
          category: r.category,
          total:    parseFloat(r.total).toFixed(3),
          pct:      totalCatSales > 0
            ? Math.round(parseFloat(r.total) / totalCatSales * 100) : 0,
        })),
      }
    });
  } catch (err) { next(err); }
};

// ── AR Aging ───────────────────────────────────────────────
exports.arAging = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT i.id, i.invoice_no, i.invoice_date, i.due_date,
              i.grand_total, i.amount_paid, i.balance_due,
              (CURRENT_DATE - COALESCE(i.due_date, i.invoice_date))::int AS days_overdue,
              c.id AS customer_id, c.name AS customer_name, c.tel AS customer_tel, c.email AS customer_email
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.company_id = $1
         AND i.type = 'tax_invoice'
         AND i.payment_status IN ('unpaid','partial','overdue')
       ORDER BY c.name, days_overdue DESC`, [req.user.company_id]);

    // bucket each row
    const bucket = (days) =>
      days <= 0  ? 'current' :
      days <= 30 ? 'b1_30'   :
      days <= 60 ? 'b31_60'  :
      days <= 90 ? 'b61_90'  : 'b90plus';

    // group by customer
    const custMap = {};
    for (const r of rows) {
      if (!custMap[r.customer_id]) {
        custMap[r.customer_id] = {
          customer_id: r.customer_id, customer_name: r.customer_name,
          customer_tel: r.customer_tel, customer_email: r.customer_email,
          current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90plus: 0, total: 0,
          invoices: [],
        };
      }
      const b = parseFloat(r.balance_due);
      const bkt = bucket(r.days_overdue);
      custMap[r.customer_id][bkt] += b;
      custMap[r.customer_id].total += b;
      custMap[r.customer_id].invoices.push({ ...r, bucket: bkt });
    }

    const customers = Object.values(custMap).sort((a, b) => b.total - a.total);
    const summary = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90plus: 0, total: 0 };
    for (const c of customers) {
      for (const k of ['current','b1_30','b31_60','b61_90','b90plus','total']) summary[k] += c[k];
    }
    // round
    for (const k of Object.keys(summary)) summary[k] = parseFloat(summary[k].toFixed(3));

    res.json({ data: { customers, summary } });
  } catch (err) { next(err); }
};

// ── AP Aging ───────────────────────────────────────────────
exports.apAging = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.purchase_no, p.purchase_date,
              -- Effective due date: explicit due_date on purchase, or derived from supplier terms
              COALESCE(
                p.due_date,
                p.purchase_date + (COALESCE(c.supplier_payment_terms_days, c.payment_terms_days, 30) * INTERVAL '1 day')
              )::date AS due_date,
              p.supplier_invoice_no,
              p.grand_total, p.amount_paid,
              (p.grand_total - p.amount_paid) AS balance_due,
              -- Age from due date (negative = not yet due, positive = overdue)
              (CURRENT_DATE - COALESCE(
                p.due_date,
                p.purchase_date + (COALESCE(c.supplier_payment_terms_days, c.payment_terms_days, 30) * INTERVAL '1 day')
              )::date)::int AS days_overdue,
              c.id AS supplier_id, c.name AS supplier_name, c.tel AS supplier_tel, c.email AS supplier_email
       FROM purchases p
       JOIN customers c ON c.id = p.supplier_id
       WHERE p.company_id = $1
         AND p.payment_status IN ('unpaid','partial')
       ORDER BY c.name, days_overdue DESC`, [req.user.company_id]);

    // Buckets are days past due. Not-yet-due items (days_overdue < 0) go into 'current'.
    const bucket = (days) =>
      days <= 0  ? 'current' :
      days <= 30 ? 'b1_30'   :
      days <= 60 ? 'b31_60'  :
      days <= 90 ? 'b61_90'  : 'b90plus';

    const supplierMap = {};
    for (const r of rows) {
      if (!supplierMap[r.supplier_id]) {
        supplierMap[r.supplier_id] = {
          supplier_id: r.supplier_id, supplier_name: r.supplier_name,
          supplier_tel: r.supplier_tel, supplier_email: r.supplier_email,
          current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90plus: 0, total: 0,
          purchases: [],
        };
      }
      const b = parseFloat(r.balance_due);
      const bkt = bucket(r.days_overdue);
      supplierMap[r.supplier_id][bkt] += b;
      supplierMap[r.supplier_id].total += b;
      supplierMap[r.supplier_id].purchases.push({ ...r, bucket: bkt });
    }

    const suppliers = Object.values(supplierMap).sort((a, b) => b.total - a.total);
    const summary = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90plus: 0, total: 0 };
    for (const s of suppliers) {
      for (const k of ['current','b1_30','b31_60','b61_90','b90plus','total']) summary[k] += s[k];
    }
    for (const k of Object.keys(summary)) summary[k] = parseFloat(summary[k].toFixed(3));

    res.json({ data: { suppliers, summary } });
  } catch (err) { next(err); }
};

// ── Stock Valuation ────────────────────────────────────────
exports.stockValuation = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.sku, p.name, cat.name AS category, p.brand,
              p.stock_qty, p.cost_price,
              (p.stock_qty * p.cost_price) AS stock_value,
              p.price_1, p.stock_min,
              CASE WHEN p.stock_qty <= p.stock_min THEN true ELSE false END AS is_low_stock
       FROM products p
       LEFT JOIN categories cat ON cat.id = p.category_id
       WHERE p.company_id = $1 AND p.is_active = true AND p.is_stock_tracked = true
       ORDER BY cat.name, p.name`, [req.user.company_id]);
    const totalValue = rows.reduce((s, r) => s + parseFloat(r.stock_value), 0);
    res.json({ data: rows, total_value: totalValue.toFixed(3) });
  } catch (err) { next(err); }
};

// ── Bad Debt Candidates ────────────────────────────────────
exports.badDebtCandidates = async (req, res, next) => {
  try {
    const co = req.user.company_id;

    // Per-customer outstanding summary with last-activity date
    const { rows } = await db.query(`
      WITH outstanding AS (
        SELECT
          c.id                                             AS customer_id,
          c.name                                           AS customer_name,
          c.tel                                            AS customer_tel,
          c.email                                          AS customer_email,
          COUNT(i.id)                                      AS invoice_count,
          COALESCE(SUM(i.balance_due),0)                   AS balance_due,
          MIN(i.invoice_date)                              AS oldest_invoice,
          MAX(i.invoice_date)                              AS newest_outstanding,
          CURRENT_DATE - MAX(i.due_date)::date             AS max_days_overdue,
          (SELECT MAX(i2.invoice_date)
           FROM invoices i2
           WHERE i2.customer_id = c.id AND i2.type = 'tax_invoice'
             AND i2.company_id  = i.company_id)            AS last_invoice_ever,
          json_agg(json_build_object(
            'id',          i.id,
            'invoice_no',  i.invoice_no,
            'invoice_date',i.invoice_date,
            'due_date',    i.due_date,
            'grand_total', i.grand_total,
            'balance_due', i.balance_due,
            'payment_status', i.payment_status,
            'days_overdue', (CURRENT_DATE - COALESCE(i.due_date, i.invoice_date))::int
          ) ORDER BY i.due_date ASC NULLS LAST)            AS invoices
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        WHERE i.company_id     = $1
          AND i.type           = 'tax_invoice'
          AND i.payment_status IN ('unpaid','partial','overdue')
          AND i.write_off_date IS NULL
        GROUP BY c.id, c.name, c.tel, c.email, i.company_id
      )
      SELECT *,
        CASE
          WHEN customer_name ILIKE 'CASH%'
            THEN 'cash'
          WHEN max_days_overdue < 90
            THEN 'active'
          WHEN last_invoice_ever > CURRENT_DATE - 180
            THEN 'trading'
          WHEN max_days_overdue BETWEEN 90 AND 365
            THEN 'watchlist'
          ELSE 'candidate'
        END AS risk_category
      FROM outstanding
      ORDER BY
        CASE WHEN customer_name ILIKE 'CASH%' THEN 5
             WHEN max_days_overdue < 90        THEN 4
             WHEN last_invoice_ever > CURRENT_DATE - 180 THEN 3
             WHEN max_days_overdue BETWEEN 90 AND 365    THEN 2
             ELSE 1
        END,
        balance_due DESC
    `, [co]);

    // Segment totals
    const segments = { candidate: {customers:0,invoices:0,balance:0},
                       watchlist:  {customers:0,invoices:0,balance:0},
                       trading:    {customers:0,invoices:0,balance:0},
                       active:     {customers:0,invoices:0,balance:0},
                       cash:       {customers:0,invoices:0,balance:0} };
    for (const r of rows) {
      const seg = segments[r.risk_category];
      seg.customers++;
      seg.invoices += parseInt(r.invoice_count);
      seg.balance  += parseFloat(r.balance_due);
    }
    for (const s of Object.values(segments)) s.balance = parseFloat(s.balance.toFixed(3));

    res.json({ data: rows, segments });
  } catch (err) { next(err); }
};

// ── Sales by Product ─────────────────────────────────────────────────────────
// ?from=&to=&category_id=
exports.salesByProduct = async (req, res, next) => {
  try {
    const co   = req.user.company_id;
    const from = req.query.from || `${new Date().getFullYear()}-01-01`;
    const to   = req.query.to   || new Date().toISOString().slice(0, 10);

    const params    = [co, from, to];
    const catFilter = req.query.category_id
      ? `AND p.category_id = $${params.push(req.query.category_id)}`
      : '';

    const { rows } = await db.query(`
      SELECT
        p.id           AS product_id,
        p.sku,
        p.name         AS product_name,
        COALESCE(cat.name, 'Uncategorised') AS category,
        COUNT(DISTINCT i.id)::int           AS invoice_count,
        ROUND(SUM(ii.qty::numeric), 3)      AS qty_sold,
        ROUND(SUM(ii.net_amount::numeric), 3) AS net_revenue,
        ROUND(SUM(ii.qty::numeric * ii.unit_cost::numeric), 3) AS total_cogs,
        ROUND(SUM(ii.net_amount::numeric)
              - SUM(ii.qty::numeric * ii.unit_cost::numeric), 3) AS gross_profit,
        ROUND(
          CASE WHEN SUM(ii.net_amount::numeric) > 0
            THEN (SUM(ii.net_amount::numeric)
                  - SUM(ii.qty::numeric * ii.unit_cost::numeric))
                 / SUM(ii.net_amount::numeric) * 100
            ELSE 0
          END, 1)      AS margin_pct
      FROM invoice_items ii
      JOIN invoices  i   ON ii.invoice_id = i.id
      JOIN products  p   ON ii.product_id = p.id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE i.company_id     = $1
        AND i.type           = 'tax_invoice'
        AND i.payment_status != 'void'
        AND i.invoice_date BETWEEN $2 AND $3
        ${catFilter}
      GROUP BY p.id, p.sku, p.name, cat.name
      ORDER BY net_revenue DESC
      LIMIT 500
    `, params);

    const totals = rows.reduce((a, r) => {
      a.net_revenue  += +r.net_revenue;
      a.total_cogs   += +r.total_cogs;
      a.gross_profit += +r.gross_profit;
      return a;
    }, { net_revenue: 0, total_cogs: 0, gross_profit: 0 });
    totals.margin_pct = totals.net_revenue > 0
      ? +((totals.gross_profit / totals.net_revenue) * 100).toFixed(1)
      : 0;

    res.json({ data: rows, totals, from, to });
  } catch (err) { next(err); }
};

// ── Purchase Analysis ────────────────────────────────────────────────────────
// ?from=&to=&group_by=supplier|category
exports.purchaseAnalysis = async (req, res, next) => {
  try {
    const co      = req.user.company_id;
    const from    = req.query.from    || `${new Date().getFullYear()}-01-01`;
    const to      = req.query.to      || new Date().toISOString().slice(0, 10);
    const groupBy = req.query.group_by === 'category' ? 'category' : 'supplier';

    const { rows } = await db.query(groupBy === 'supplier' ? `
      SELECT
        s.id            AS supplier_id,
        s.code          AS supplier_code,
        s.name          AS supplier_name,
        COUNT(DISTINCT pur.id)::int          AS purchase_count,
        ROUND(SUM(pi.qty::numeric), 3)       AS total_qty,
        ROUND(SUM(pi.qty::numeric * pi.unit_price::numeric), 3) AS total_value,
        MAX(pur.purchase_date)               AS last_purchase
      FROM purchase_items pi
      JOIN purchases pur ON pur.id = pi.purchase_id
      JOIN customers  s  ON s.id  = pur.supplier_id
      WHERE pur.company_id   = $1
        AND pur.purchase_date BETWEEN $2 AND $3
      GROUP BY s.id, s.code, s.name
      ORDER BY total_value DESC
      LIMIT 200
    ` : `
      SELECT
        COALESCE(cat.name, 'Uncategorised') AS category,
        COUNT(DISTINCT pur.id)::int          AS purchase_count,
        ROUND(SUM(pi.qty::numeric), 3)       AS total_qty,
        ROUND(SUM(pi.qty::numeric * pi.unit_price::numeric), 3) AS total_value
      FROM purchase_items pi
      JOIN purchases   pur ON pur.id    = pi.purchase_id
      JOIN products    p   ON p.id      = pi.product_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE pur.company_id   = $1
        AND pur.purchase_date BETWEEN $2 AND $3
      GROUP BY cat.name
      ORDER BY total_value DESC
    `, [co, from, to]);

    const total_value = rows.reduce((s, r) => s + +r.total_value, 0);
    res.json({ data: rows, total_value: +total_value.toFixed(3), from, to, group_by: groupBy });
  } catch (err) { next(err); }
};

// ── Inventory Valuation at Date ──────────────────────────────────────────────
// ?at_date=YYYY-MM-DD  (defaults to today)
exports.inventoryAtDate = async (req, res, next) => {
  try {
    const co      = req.user.company_id;
    const at_date = req.query.at_date || new Date().toISOString().slice(0, 10);

    const { rows } = await db.query(`
      WITH movements AS (
        -- All stock-affecting events up to at_date
        SELECT product_id,
               SUM(CASE WHEN type IN ('purchase','adjustment_in','opening')
                        THEN qty::numeric ELSE 0 END)
             - SUM(CASE WHEN type IN ('sale','adjustment_out','write_off')
                        THEN qty::numeric ELSE 0 END) AS net_qty
        FROM stock_movements
        WHERE company_id = $1
          AND moved_at::date <= $2
        GROUP BY product_id
      )
      SELECT
        p.id, p.sku, p.name,
        COALESCE(cat.name, 'Uncategorised')  AS category,
        COALESCE(m.net_qty, p.stock_qty::numeric) AS qty_at_date,
        p.cost_price::numeric               AS unit_cost,
        ROUND(
          COALESCE(m.net_qty, p.stock_qty::numeric)
          * p.cost_price::numeric, 3)        AS stock_value
      FROM products p
      LEFT JOIN movements m ON m.product_id = p.id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE p.company_id     = $1
        AND p.is_active       = TRUE
        AND p.is_stock_tracked = TRUE
      ORDER BY stock_value DESC
    `, [co, at_date]);

    const total_value = rows.reduce((s, r) => s + +r.stock_value, 0);
    res.json({ data: rows, total_value: +total_value.toFixed(3), at_date });
  } catch (err) { next(err); }
};

// ── Daily Closing Report ──────────────────────────────────────────────────────
async function buildDailyClosingData(co_id, date) {
  const [invoicesRes, collectionsRes, expensesRes,
         chqIssuedRes, chqReceivedRes, dnsRes, arRes] = await Promise.all([

    db.query(`
      SELECT i.invoice_no, i.type, c.name AS customer_name,
             i.subtotal, i.total_vat, i.grand_total, i.payment_status
      FROM invoices i JOIN customers c ON c.id=i.customer_id
      WHERE i.company_id=$1 AND i.invoice_date=$2
        AND i.type IN ('tax_invoice','credit_note')
      ORDER BY i.created_at`, [co_id, date]),

    db.query(`
      SELECT p.amount, p.method, p.reference_no,
             i.invoice_no, c.name AS customer_name
      FROM payments p
      JOIN invoices i ON i.id=p.reference_id
      JOIN customers c ON c.id=i.customer_id
      WHERE p.company_id=$1 AND p.payment_date=$2 AND p.reference_type='invoice'
      ORDER BY p.created_at`, [co_id, date]),

    db.query(`
      SELECT e.expense_no, e.description, cat.name AS category_name,
             e.net_amount, e.vat_amount, e.total_amount
      FROM expenses e LEFT JOIN categories cat ON cat.id=e.category_id
      WHERE e.company_id=$1 AND e.expense_date=$2
      ORDER BY e.created_at`, [co_id, date]),

    db.query(`SELECT cheque_no,bank_name,party_name,amount,status FROM cheques
      WHERE company_id=$1 AND cheque_date=$2 AND direction='issued' ORDER BY created_at`, [co_id, date]),

    db.query(`SELECT cheque_no,bank_name,party_name,amount,status FROM cheques
      WHERE company_id=$1 AND cheque_date=$2 AND direction='received' ORDER BY created_at`, [co_id, date]),

    db.query(`SELECT dn_no,customer_name,project_ref,net_value,status FROM delivery_notes
      WHERE company_id=$1 AND dn_date=$2 ORDER BY created_at`, [co_id, date]),

    db.query(`SELECT COALESCE(SUM(balance_due),0) AS outstanding FROM invoices
      WHERE company_id=$1 AND type='tax_invoice'
        AND payment_status IN ('unpaid','partial','overdue')`, [co_id]),
  ]);

  const invoices        = invoicesRes.rows;
  const collections     = collectionsRes.rows;
  const expenses        = expensesRes.rows;
  const chequesIssued   = chqIssuedRes.rows;
  const chequesReceived = chqReceivedRes.rows;
  const dns             = dnsRes.rows;

  const totalInvoiced   = invoices.filter(r=>r.type==='tax_invoice').reduce((s,r)=>s+parseFloat(r.grand_total),0);
  const totalCollected  = collections.reduce((s,r)=>s+parseFloat(r.amount),0);
  const totalExpenses   = expenses.reduce((s,r)=>s+parseFloat(r.total_amount),0);
  const totalChqIssued  = chequesIssued.reduce((s,r)=>s+parseFloat(r.amount),0);
  const totalChqRecvd   = chequesReceived.reduce((s,r)=>s+parseFloat(r.amount),0);

  const byMethod = {};
  for (const p of collections) byMethod[p.method] = (byMethod[p.method]||0) + parseFloat(p.amount);

  return {
    date, invoices, collections, expenses, chequesIssued, chequesReceived, dns,
    summary: {
      total_invoiced:          +totalInvoiced.toFixed(3),
      total_credit_notes:      +invoices.filter(r=>r.type==='credit_note').reduce((s,r)=>s+parseFloat(r.grand_total),0).toFixed(3),
      total_collected:         +totalCollected.toFixed(3),
      total_expenses:          +totalExpenses.toFixed(3),
      cheques_issued:          +totalChqIssued.toFixed(3),
      cheques_received:        +totalChqRecvd.toFixed(3),
      net_cash_in:             +(totalCollected - totalExpenses).toFixed(3),
      ar_outstanding:          +parseFloat(arRes.rows[0].outstanding).toFixed(3),
      collections_by_method:   byMethod,
    },
  };
}

exports.dailyClosing = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const data = await buildDailyClosingData(req.user.company_id, date);
    res.json({ data });
  } catch (err) { next(err); }
};

exports.dailyClosingPrint = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const d    = await buildDailyClosingData(req.user.company_id, date);
    const s    = d.summary;
    const fmt  = (n) => parseFloat(n||0).toFixed(3);
    const fmtD = (dt) => dt ? new Date(dt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const METHOD = { cash:'Cash', bank_transfer:'Bank Transfer', cheque:'Cheque', card:'Card', other:'Other' };

    const tbl = (heads, rows, cols) => `
      <table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>
      ${rows.length ? rows.map(r=>`<tr>${cols.map(c=>`<td class="${c.cls||''}">${c.fn(r)}</td>`).join('')}</tr>`).join('') :
        `<tr><td colspan="${heads.length}" class="empty">No records</td></tr>`}
      </tbody></table>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Daily Closing — ${date}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:20px}
h1{font-size:18px;margin-bottom:2px}.sub{color:#666;font-size:11px;margin-bottom:16px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.card{border:1px solid #ddd;border-radius:5px;padding:10px 12px;background:#fafafa}
.card-lbl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
.card-val{font-size:15px;font-weight:700;color:#1a3a6c}
.green{color:#2e7d32}.red{color:#c62828}.orange{color:#e65100}
.sec{margin-bottom:16px}
.sec-title{font-size:12px;font-weight:700;color:#1a3a6c;border-bottom:2px solid #e0e0e0;padding-bottom:3px;margin-bottom:6px}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#f0f4fa;padding:4px 6px;text-align:left;font-weight:600;border:1px solid #ddd}
td{padding:3px 6px;border:1px solid #eee}.right{text-align:right}
.empty{text-align:center;color:#aaa;padding:8px}
.footer{margin-top:16px;border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#aaa;display:flex;justify-content:space-between}
</style></head><body>
<h1>Daily Closing Report</h1>
<div class="sub">${fmtD(date)} &nbsp;&middot;&nbsp; Generated: ${new Date().toLocaleString('en-GB')}</div>
<div class="cards">
  <div class="card"><div class="card-lbl">Invoiced Today</div><div class="card-val">BHD ${fmt(s.total_invoiced)}</div></div>
  <div class="card"><div class="card-lbl">Collections</div><div class="card-val green">BHD ${fmt(s.total_collected)}</div></div>
  <div class="card"><div class="card-lbl">Expenses</div><div class="card-val red">BHD ${fmt(s.total_expenses)}</div></div>
  <div class="card"><div class="card-lbl">Net Cash In</div><div class="card-val ${parseFloat(s.net_cash_in)>=0?'green':'red'}">BHD ${fmt(s.net_cash_in)}</div></div>
  <div class="card"><div class="card-lbl">AR Outstanding</div><div class="card-val orange">BHD ${fmt(s.ar_outstanding)}</div></div>
  <div class="card"><div class="card-lbl">Cheques Issued</div><div class="card-val red">BHD ${fmt(s.cheques_issued)}</div></div>
  <div class="card"><div class="card-lbl">Cheques Received</div><div class="card-val green">BHD ${fmt(s.cheques_received)}</div></div>
  <div class="card"><div class="card-lbl">DNs Issued</div><div class="card-val">${d.dns.length}</div></div>
</div>
<div class="sec"><div class="sec-title">Invoices Raised (${d.invoices.length})</div>
${tbl(['Invoice No.','Customer','Subtotal BHD','VAT BHD','Total BHD','Status'],d.invoices,[
  {fn:r=>r.invoice_no},{fn:r=>r.customer_name},
  {fn:r=>fmt(r.subtotal),cls:'right'},{fn:r=>fmt(r.total_vat),cls:'right'},
  {fn:r=>fmt(r.grand_total),cls:'right'},{fn:r=>r.payment_status}])}</div>
<div class="sec"><div class="sec-title">Collections (${d.collections.length} &middot; BHD ${fmt(s.total_collected)})</div>
${tbl(['Invoice No.','Customer','Amount BHD','Method','Reference'],d.collections,[
  {fn:r=>r.invoice_no},{fn:r=>r.customer_name},
  {fn:r=>fmt(r.amount),cls:'right'},{fn:r=>METHOD[r.method]||r.method},{fn:r=>r.reference_no||'&mdash;'}])}
${Object.keys(s.collections_by_method).length?`<div style="margin-top:6px;font-size:11px"><strong>By method:</strong> ${Object.entries(s.collections_by_method).map(([m,v])=>`${METHOD[m]||m}: <strong>BHD ${fmt(v)}</strong>`).join(' &middot; ')}</div>`:''}</div>
<div class="sec"><div class="sec-title">Expenses (${d.expenses.length} &middot; BHD ${fmt(s.total_expenses)})</div>
${tbl(['Expense No.','Category','Description','Net BHD','VAT BHD','Total BHD'],d.expenses,[
  {fn:r=>r.expense_no},{fn:r=>r.category_name||'&mdash;'},{fn:r=>r.description},
  {fn:r=>fmt(r.net_amount),cls:'right'},{fn:r=>fmt(r.vat_amount),cls:'right'},{fn:r=>fmt(r.total_amount),cls:'right'}])}</div>
<div class="sec"><div class="sec-title">Delivery Notes Issued (${d.dns.length})</div>
${tbl(['DN No.','Customer','Project / Ref','Net Value BHD','Status'],d.dns,[
  {fn:r=>r.dn_no},{fn:r=>r.customer_name},{fn:r=>r.project_ref||'&mdash;'},
  {fn:r=>fmt(r.net_value),cls:'right'},{fn:r=>r.status}])}</div>
${(d.chequesIssued.length||d.chequesReceived.length)?`
<div class="sec"><div class="sec-title">Cheques Due Today</div>
${d.chequesIssued.length?`<div style="font-size:11px;font-weight:600;color:#c62828;margin-bottom:4px">&uarr; Issued &mdash; BHD ${fmt(s.cheques_issued)}</div>
${tbl(['Cheque No.','Bank','Party','Amount BHD','Status'],d.chequesIssued,[
  {fn:r=>r.cheque_no},{fn:r=>r.bank_name||'&mdash;'},{fn:r=>r.party_name||'&mdash;'},{fn:r=>fmt(r.amount),cls:'right'},{fn:r=>r.status}])}`:'' }
${d.chequesReceived.length?`<div style="font-size:11px;font-weight:600;color:#2e7d32;margin:8px 0 4px">&darr; Received &mdash; BHD ${fmt(s.cheques_received)}</div>
${tbl(['Cheque No.','Bank','Party','Amount BHD','Status'],d.chequesReceived,[
  {fn:r=>r.cheque_no},{fn:r=>r.bank_name||'&mdash;'},{fn:r=>r.party_name||'&mdash;'},{fn:r=>fmt(r.amount),cls:'right'},{fn:r=>r.status}])}`:'' }
</div>`:''}
<div class="footer"><span>ElecTrade Pro &mdash; Daily Closing Report</span><span>Printed: ${new Date().toLocaleString('en-GB')}</span></div>
<script>window.onload=()=>window.print()</script>
</body></html>`;

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
};
