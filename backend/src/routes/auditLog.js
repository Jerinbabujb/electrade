/**
 * Audit Log — GET /api/v1/audit-log
 *
 * Admin-only.  Returns a paginated, filterable list of audit entries
 * for the caller's current company.
 *
 * Query params:
 *   page        int    (default 1)
 *   limit       int    (default 50, max 200)
 *   user_id     uuid
 *   entity_type text   e.g. 'invoice' | 'user' | 'company'
 *   action      text   e.g. 'invoice.void'
 *   from        YYYY-MM-DD
 *   to          YYYY-MM-DD
 */

const { Router }              = require('express')
const db                      = require('../db')
const { authenticate, authorize } = require('../middleware/auth')

const r = Router()
r.use(authenticate)
r.use(authorize('admin'))

r.get('/', async (req, res, next) => {
  try {
    const co    = req.user.company_id
    const page  = Math.max(1, parseInt(req.query.page)  || 1)
    const limit = Math.min(200, parseInt(req.query.limit) || 50)
    const offset = (page - 1) * limit

    const params  = [co]
    const filters = []

    if (req.query.user_id) {
      filters.push(`al.user_id = $${params.push(req.query.user_id)}`)
    }
    if (req.query.entity_type) {
      filters.push(`al.entity_type = $${params.push(req.query.entity_type)}`)
    }
    if (req.query.action) {
      filters.push(`al.action = $${params.push(req.query.action)}`)
    }
    if (req.query.from) {
      filters.push(`al.created_at >= $${params.push(req.query.from)}::date`)
    }
    if (req.query.to) {
      filters.push(`al.created_at <  ($${params.push(req.query.to)}::date + INTERVAL '1 day')`)
    }

    const where = filters.length ? 'AND ' + filters.join(' AND ') : ''

    const { rows } = await db.query(`
      SELECT
        al.id, al.user_id, al.user_name, al.action,
        al.entity_type, al.entity_id, al.entity_label,
        al.old_value, al.new_value, al.ip,
        al.created_at
      FROM audit_log al
      WHERE al.company_id = $1
        ${where}
      ORDER BY al.created_at DESC
      LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}
    `, params)

    // Total count (for pagination)
    const { rows: [{ total }] } = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM audit_log al
      WHERE al.company_id = $1
        ${where}
    `, params.slice(0, params.length - 2))  // exclude limit/offset params

    res.json({
      data:  rows,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (err) { next(err) }
})

// Distinct action types for the filter dropdown
r.get('/actions', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT action FROM audit_log WHERE company_id=$1 ORDER BY action`,
      [req.user.company_id])
    res.json({ data: rows.map(r => r.action) })
  } catch (err) { next(err) }
})

module.exports = r
