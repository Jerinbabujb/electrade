/**
 * Backup & Restore routes — admin only
 * Full backup: all tables (pg_dump)
 * Partial backup: business data tables only (no users, companies, auth)
 */
const router   = require('express').Router();
const { exec } = require('child_process');
const fs       = require('fs');
const path     = require('path');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('admin'));

const BACKUP_DIR = '/app/backups';
const SCHEDULE_FILE = path.join(BACKUP_DIR, 'schedule.json');

// Business-data-only tables for partial backup (excludes users, companies)
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

// Parse DATABASE_URL into pg_dump compatible env vars
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

function buildDumpCmd(filePath, type) {
  const base = `pg_dump --no-owner --no-acl -F p`;
  if (type === 'partial') {
    const tables = PARTIAL_TABLES.map(t => `--table=${t}`).join(' ');
    return `${base} ${tables} -f "${filePath}"`;
  }
  return `${base} -f "${filePath}"`;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ── GET /api/v1/backup/list ──────────────────────────────────
router.get('/list', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        const parts = f.replace('.sql', '').split('_');
        return {
          filename: f,
          type:     f.includes('_partial') ? 'partial' : 'full',
          trigger:  f.includes('_auto') ? 'auto' : 'manual',
          size:     stat.size,
          created:  stat.mtime,
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json({ data: files });
  } catch (err) { res.status(500).json({ error: { message: err.message } }); }
});

// ── POST /api/v1/backup/create ───────────────────────────────
router.post('/create', (req, res) => {
  const { type = 'full' } = req.body;
  if (!['full', 'partial'].includes(type)) {
    return res.status(400).json({ error: { message: 'type must be full or partial' } });
  }
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const filename = `backup_${timestamp()}_${type}_manual.sql`;
  const filePath = path.join(BACKUP_DIR, filename);
  const cmd      = buildDumpCmd(filePath, type);
  const env      = { ...process.env, ...pgEnv() };

  exec(cmd, { env }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: { message: stderr || err.message } });
    const stat = fs.statSync(filePath);
    res.json({ data: { filename, type, size: stat.size, created: stat.mtime } });
  });
});

// ── GET /api/v1/backup/download/:filename ────────────────────
router.get('/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: { message: 'Backup not found' } });
  res.download(filePath, filename);
});

// ── POST /api/v1/backup/restore ──────────────────────────────
// Accepts multipart upload of a .sql file OR a filename from existing backups
router.post('/restore', (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: { message: 'filename required' } });

  const safe     = path.basename(filename);
  const filePath = path.join(BACKUP_DIR, safe);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: { message: 'Backup file not found' } });

  const url = new URL(process.env.DATABASE_URL);
  const cmd = `psql -f "${filePath}"`;
  const env = { ...process.env, ...pgEnv() };

  exec(cmd, { env }, (err, stdout, stderr) => {
    // psql returns non-zero on warnings too — only fail on hard errors
    if (err && !stderr.includes('already exists') && !stderr.includes('NOTICE')) {
      return res.status(500).json({ error: { message: stderr || err.message } });
    }
    res.json({ message: `Restored from ${safe}` });
  });
});

// ── DELETE /api/v1/backup/:filename ─────────────────────────
router.delete('/:filename', (req, res) => {
  const safe     = path.basename(req.params.filename);
  const filePath = path.join(BACKUP_DIR, safe);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: { message: 'Not found' } });
  fs.unlinkSync(filePath);
  res.json({ message: 'Deleted' });
});

// ── GET /api/v1/backup/schedule ──────────────────────────────
router.get('/schedule', (req, res) => {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return res.json({ data: { enabled: false, frequency: 'daily', time: '02:00', type: 'full', keep: 7 } });
    const cfg = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    res.json({ data: cfg });
  } catch { res.json({ data: { enabled: false, frequency: 'daily', time: '02:00', type: 'full', keep: 7 } }); }
});

// ── PUT /api/v1/backup/schedule ──────────────────────────────
router.put('/schedule', (req, res) => {
  const { enabled, frequency, time, type, keep } = req.body;
  const cfg = { enabled: !!enabled, frequency: frequency||'daily', time: time||'02:00', type: type||'full', keep: parseInt(keep)||7 };
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(cfg, null, 2));
  // Signal scheduler to reload
  require('../services/scheduler').reload(cfg);
  res.json({ data: cfg, message: 'Schedule saved' });
});

module.exports = router;
