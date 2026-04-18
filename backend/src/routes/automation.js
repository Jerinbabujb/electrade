/**
 * Automation Settings — /api/v1/automation
 *
 * GET  /api/v1/automation          — fetch current settings for this company
 * PUT  /api/v1/automation          — save settings (admin only)
 * POST /api/v1/automation/run-now  — trigger a manual run of all jobs (admin only)
 */

const { Router }                  = require('express')
const db                          = require('../db')
const { authenticate, authorize } = require('../middleware/auth')

const r = Router()
r.use(authenticate)

// GET — fetch (or return defaults if not yet configured)
r.get('/', async (req, res, next) => {
  try {
    const { rows: [row] } = await db.query(
      `SELECT * FROM automation_settings WHERE company_id = $1`,
      [req.user.company_id])

    // Return defaults when no row exists yet
    res.json({
      data: row || {
        company_id:            req.user.company_id,
        overdue_enabled:       false,
        overdue_interval_days: 7,
        lowstock_enabled:      false,
        lowstock_alert_email:  null,
        overdue_last_run:      null,
        overdue_last_count:    0,
        lowstock_last_run:     null,
        lowstock_last_count:   0,
      }
    })
  } catch (err) { next(err) }
})

// PUT — upsert settings (admin only)
r.put('/', authorize('admin'), async (req, res, next) => {
  try {
    const {
      overdue_enabled,
      overdue_interval_days,
      lowstock_enabled,
      lowstock_alert_email,
    } = req.body

    const { rows: [row] } = await db.query(`
      INSERT INTO automation_settings
        (company_id, overdue_enabled, overdue_interval_days,
         lowstock_enabled, lowstock_alert_email, updated_at)
      VALUES ($1,$2,$3,$4,$5,now())
      ON CONFLICT (company_id) DO UPDATE SET
        overdue_enabled       = EXCLUDED.overdue_enabled,
        overdue_interval_days = EXCLUDED.overdue_interval_days,
        lowstock_enabled      = EXCLUDED.lowstock_enabled,
        lowstock_alert_email  = EXCLUDED.lowstock_alert_email,
        updated_at            = now()
      RETURNING *
    `, [
      req.user.company_id,
      overdue_enabled       ?? false,
      overdue_interval_days ?? 7,
      lowstock_enabled      ?? false,
      lowstock_alert_email  || null,
    ])

    // Reload automation scheduler with new settings
    require('../services/scheduler').reloadAutomation()

    res.json({ data: row })
  } catch (err) { next(err) }
})

// POST /run-now — manual trigger for testing (admin only)
r.post('/run-now', authorize('admin'), async (req, res, next) => {
  try {
    const { job } = req.body  // 'overdue' | 'lowstock' | 'all'
    const scheduler = require('../services/scheduler')

    const results = {}
    if (!job || job === 'overdue' || job === 'all') {
      results.overdue = await scheduler.runOverdueReminders(req.user.company_id)
    }
    if (!job || job === 'lowstock' || job === 'all') {
      results.lowstock = await scheduler.runLowStockAlerts(req.user.company_id)
    }

    res.json({ message: 'Jobs completed', results })
  } catch (err) { next(err) }
})

module.exports = r
