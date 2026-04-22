/**
 * Scheduler — backup cron + automation jobs (overdue reminders, low-stock alerts)
 */
const cron = require('node-cron');
const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const db          = require('../db');
const emailSvc    = require('./emailService');
const audit       = require('../utils/auditLog');

const BACKUP_DIR    = '/app/backups';
const SCHEDULE_FILE = path.join(BACKUP_DIR, 'schedule.json');

const PARTIAL_TABLES = [
  'categories', 'customers', 'products', 'stock_movements',
  'invoices', 'invoice_items', 'payments',
  'delivery_notes', 'delivery_note_items',
  'purchases', 'purchase_items',
  'expenses', 'cheques',
  'bank_accounts', 'bank_transactions',
  'employees', 'employee_leaves', 'payroll_runs', 'payslips',
  'document_conversions',
];

let currentTask = null;

function pgEnv() {
  const url = new URL(process.env.DATABASE_URL);
  return {
    PGHOST:     url.hostname,
    PGPORT:     url.port || '5432',
    PGUSER:     url.username,
    PGPASSWORD: url.password,
    PGDATABASE: url.pathname.replace('/', ''),
  };
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function buildDumpCmd(filePath, type) {
  const base = `pg_dump --no-owner --no-acl -F p`;
  if (type === 'partial') {
    const tables = PARTIAL_TABLES.map(t => `--table=${t}`).join(' ');
    return `${base} ${tables} -f "${filePath}"`;
  }
  return `${base} -f "${filePath}"`;
}

function pruneOld(keep) {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql') && f.includes('_auto'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    files.slice(keep).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f.name)); } catch {}
    });
  } catch {}
}

function runBackup(cfg) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const filename = `backup_${timestamp()}_${cfg.type}_auto.sql`;
  const filePath = path.join(BACKUP_DIR, filename);
  const cmd = buildDumpCmd(filePath, cfg.type);
  const env = { ...process.env, ...pgEnv() };

  exec(cmd, { env }, (err, stdout, stderr) => {
    if (err) {
      console.error(`[scheduler] Backup failed: ${stderr || err.message}`);
    } else {
      console.log(`[scheduler] Auto backup created: ${filename}`);
      pruneOld(cfg.keep || 7);
    }
  });
}

// Convert frequency + time to cron expression
function toCron(frequency, time) {
  const [hh, mm] = (time || '02:00').split(':').map(Number);
  switch (frequency) {
    case 'hourly':  return `0 * * * *`;
    case 'daily':   return `${mm} ${hh} * * *`;
    case 'weekly':  return `${mm} ${hh} * * 0`;   // Sunday
    case 'monthly': return `${mm} ${hh} 1 * *`;   // 1st of month
    default:        return `${mm} ${hh} * * *`;
  }
}

function reload(cfg) {
  // Stop existing task
  if (currentTask) { currentTask.stop(); currentTask = null; }

  if (!cfg || !cfg.enabled) {
    console.log('[scheduler] Scheduled backups disabled');
    return;
  }

  const expr = toCron(cfg.frequency, cfg.time);
  if (!cron.validate(expr)) {
    console.error(`[scheduler] Invalid cron expression: ${expr}`);
    return;
  }

  currentTask = cron.schedule(expr, () => runBackup(cfg));
  console.log(`[scheduler] Scheduled ${cfg.type} backup — cron: ${expr}`);
}

// Auto-load on startup
function init() {
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
      reload(cfg);
    }
  } catch (e) {
    console.error('[scheduler] Failed to load schedule on startup:', e.message);
  }
}

// ── Overdue Invoice Reminders ─────────────────────────────────────────────────
/**
 * For a given company (or all enabled companies if company_id is null):
 *  - Find unpaid invoices with due_date < today that have a customer email
 *  - Skip invoices where a reminder was sent within the configured interval
 *  - Send the reminder email and log to audit_log
 *  - Update overdue_last_run / overdue_last_count in automation_settings
 */
async function runOverdueReminders(companyId = null) {
  try {
    // Fetch companies that have overdue reminders enabled
    const { rows: settings } = await db.query(`
      SELECT a.company_id, a.overdue_interval_days, c.name AS company_name
      FROM automation_settings a
      JOIN companies c ON c.id = a.company_id
      WHERE a.overdue_enabled = true
        ${companyId ? 'AND a.company_id = $1' : ''}
    `, companyId ? [companyId] : [])

    let totalSent = 0

    for (const cfg of settings) {
      try {
        // Find overdue unpaid invoices with a customer email
        // that have NOT had a reminder in the last interval_days
        const { rows: invoices } = await db.query(`
          SELECT
            i.id, i.invoice_no, i.invoice_date, i.due_date,
            i.grand_total, i.balance_due, i.company_id,
            c.name AS customer_name, c.email AS customer_email
          FROM invoices i
          JOIN customers c ON c.id = i.customer_id
          WHERE i.company_id     = $1
            AND i.type           = 'tax_invoice'
            AND i.payment_status = 'unpaid'
            AND i.due_date       < CURRENT_DATE
            AND c.email IS NOT NULL AND c.email <> ''
            AND NOT EXISTS (
              SELECT 1 FROM audit_log al
              WHERE al.company_id  = i.company_id
                AND al.action      = 'invoice.reminder_auto_sent'
                AND al.entity_id   = i.id::text
                AND al.created_at  > now() - ($2::int * INTERVAL '1 day')
            )
        `, [cfg.company_id, cfg.overdue_interval_days])

        let sent = 0
        for (const inv of invoices) {
          try {
            await emailSvc.sendPaymentReminder(inv, inv.customer_email)
            await audit.log(db,
              { company_id: cfg.company_id, id: null, name: 'system' },
              'invoice.reminder_auto_sent', 'invoice',
              inv.id, inv.invoice_no,
              null, { customer_email: inv.customer_email })
            sent++
          } catch (emailErr) {
            console.error(`[scheduler] Reminder failed for ${inv.invoice_no}:`, emailErr.message)
          }
        }

        // Update run stats
        await db.query(`
          UPDATE automation_settings
          SET overdue_last_run = now(), overdue_last_count = $2
          WHERE company_id = $1
        `, [cfg.company_id, sent])

        if (sent > 0) console.log(`[scheduler] Overdue reminders: sent ${sent} for company ${cfg.company_name}`)
        totalSent += sent
      } catch (companyErr) {
        console.error(`[scheduler] Overdue reminder error for company ${cfg.company_id}:`, companyErr.message)
      }
    }

    return { sent: totalSent }
  } catch (err) {
    console.error('[scheduler] runOverdueReminders failed:', err.message)
    return { sent: 0, error: err.message }
  }
}

// ── Low-Stock Alerts ──────────────────────────────────────────────────────────
/**
 * For a given company (or all enabled companies if company_id is null):
 *  - Find stock-tracked products where stock_qty <= stock_min AND stock_min > 0
 *  - Send one consolidated alert email to lowstock_alert_email
 *  - Only send if there are new below-minimum products since the last run
 *  - Update lowstock_last_run / lowstock_last_count in automation_settings
 */
async function runLowStockAlerts(companyId = null) {
  try {
    const { rows: settings } = await db.query(`
      SELECT a.company_id, a.lowstock_alert_email, c.name AS company_name
      FROM automation_settings a
      JOIN companies c ON c.id = a.company_id
      WHERE a.lowstock_enabled = true
        AND a.lowstock_alert_email IS NOT NULL
        AND a.lowstock_alert_email <> ''
        ${companyId ? 'AND a.company_id = $1' : ''}
    `, companyId ? [companyId] : [])

    let totalAlerts = 0

    for (const cfg of settings) {
      try {
        const { rows: products } = await db.query(`
          SELECT
            p.sku, p.name,
            COALESCE(cat.name, 'Uncategorised') AS category,
            p.stock_qty::numeric AS stock_qty,
            p.stock_min::numeric AS stock_min,
            p.cost_price::numeric AS cost_price
          FROM products p
          LEFT JOIN categories cat ON cat.id = p.category_id
          WHERE p.company_id     = $1
            AND p.is_active       = true
            AND p.is_stock_tracked = true
            AND p.stock_min       > 0
            AND p.stock_qty       <= p.stock_min
          ORDER BY (p.stock_qty - p.stock_min) ASC
        `, [cfg.company_id])

        await db.query(`
          UPDATE automation_settings
          SET lowstock_last_run = now(), lowstock_last_count = $2
          WHERE company_id = $1
        `, [cfg.company_id, products.length])

        if (products.length === 0) continue

        await emailSvc.sendLowStockAlert(products, cfg.lowstock_alert_email, cfg.company_id)
        await audit.log(db,
          { company_id: cfg.company_id, id: null, name: 'system' },
          'lowstock.alert_sent', 'company',
          cfg.company_id, cfg.company_name,
          null, { products_count: products.length, email: cfg.lowstock_alert_email })

        console.log(`[scheduler] Low-stock alert: ${products.length} products for ${cfg.company_name}`)
        totalAlerts++
      } catch (companyErr) {
        console.error(`[scheduler] Low-stock error for company ${cfg.company_id}:`, companyErr.message)
      }
    }

    return { alerts_sent: totalAlerts }
  } catch (err) {
    console.error('[scheduler] runLowStockAlerts failed:', err.message)
    return { alerts_sent: 0, error: err.message }
  }
}

// ── Automation cron (daily 08:00) ─────────────────────────────────────────────
let automationTask = null

// ── Recurring Expense Auto-Generation ────────────────────────────────────────
/**
 * Finds all active recurring expense templates where next_due_date <= today,
 * generates an expense record for each, advances next_due_date to the next cycle.
 * Safe to run multiple times per day — last_generated prevents double-posting.
 */
async function runRecurringExpenses() {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { rows: templates } = await db.query(`
      SELECT t.*, c.name AS company_name
      FROM recurring_expense_templates t
      JOIN companies c ON c.id = t.company_id
      WHERE t.is_active = true
        AND t.next_due_date <= $1
        AND (t.end_date IS NULL OR t.end_date >= $1)
        AND (t.last_generated IS NULL OR t.last_generated < t.next_due_date)
    `, [today])

    if (!templates.length) return { generated: 0 }

    let generated = 0
    for (const tmpl of templates) {
      try {
        const client = await db.pool.connect()
        try {
          await client.query('BEGIN')

          // Generate a unique expense_no
          const { rows: [co] } = await client.query(
            `SELECT COUNT(*) AS cnt FROM expenses WHERE company_id=$1`, [tmpl.company_id])
          const year = new Date(tmpl.next_due_date).getFullYear()
          const expense_no = `EXP-${year}-${String(parseInt(co.cnt)+1).padStart(4,'0')}`

          await client.query(
            `INSERT INTO expenses (id,company_id,expense_no,category_id,supplier_id,
               expense_date,description,net_amount,vat_amount,total_amount,notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [uuid(), tmpl.company_id, expense_no,
             tmpl.category_id, tmpl.supplier_id, tmpl.next_due_date,
             tmpl.description, tmpl.net_amount, tmpl.vat_amount, tmpl.total_amount,
             tmpl.notes])

          // Advance next_due_date
          const newNext = advanceDate(tmpl.frequency, tmpl.day_of_month, tmpl.next_due_date)
          await client.query(
            `UPDATE recurring_expense_templates
             SET last_generated=$1, next_due_date=$2, updated_at=now() WHERE id=$3`,
            [tmpl.next_due_date, newNext, tmpl.id])

          await client.query('COMMIT')
          generated++
          console.log(`[scheduler] Recurring expense generated: ${expense_no} — ${tmpl.description} (${tmpl.company_name})`)
        } catch (e) {
          await client.query('ROLLBACK')
          console.error(`[scheduler] Failed to generate recurring expense ${tmpl.id}:`, e.message)
        } finally { client.release() }
      } catch (e) {
        console.error(`[scheduler] Recurring expense error for template ${tmpl.id}:`, e.message)
      }
    }

    return { generated }
  } catch (err) {
    console.error('[scheduler] runRecurringExpenses failed:', err.message)
    return { generated: 0, error: err.message }
  }
}

function advanceDate(frequency, dayOfMonth, fromDateStr) {
  const dom = Math.min(dayOfMonth || 1, 28)
  const d = new Date(fromDateStr)
  switch (frequency) {
    case 'weekly':      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).toISOString().split('T')[0]
    case 'monthly':     return new Date(d.getFullYear(), d.getMonth() + 1,  dom).toISOString().split('T')[0]
    case 'quarterly':   return new Date(d.getFullYear(), d.getMonth() + 3,  dom).toISOString().split('T')[0]
    case 'half_yearly': return new Date(d.getFullYear(), d.getMonth() + 6,  dom).toISOString().split('T')[0]
    case 'yearly':      return new Date(d.getFullYear() + 1, d.getMonth(),  dom).toISOString().split('T')[0]
    case 'bi_annual':   return new Date(d.getFullYear() + 2, d.getMonth(),  dom).toISOString().split('T')[0]
    default:            return new Date(d.getFullYear(), d.getMonth() + 1,  dom).toISOString().split('T')[0]
  }
}

function reloadAutomation() {
  if (automationTask) { automationTask.stop(); automationTask = null }

  // Always schedule the daily check — it reads per-company enabled flags at runtime
  automationTask = cron.schedule('0 8 * * *', async () => {
    console.log('[scheduler] Running daily automation jobs…')
    await runRecurringExpenses()
    await runOverdueReminders()
    await runLowStockAlerts()
  })
  console.log('[scheduler] Automation jobs scheduled — daily at 08:00')
}

module.exports = { reload, init, reloadAutomation, runOverdueReminders, runLowStockAlerts, runRecurringExpenses };
