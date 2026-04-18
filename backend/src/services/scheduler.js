/**
 * Backup scheduler — reads /app/backups/schedule.json and runs pg_dump on cron schedule
 */
const cron = require('node-cron');
const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');

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

module.exports = { reload, init };
