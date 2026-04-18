/**
 * Audit Log utility
 *
 * Usage (from an Express route):
 *   await audit.log(db_or_client, req, 'invoice.void', 'invoice', inv.id, inv.invoice_no)
 *
 * Usage (from a cron job / system context):
 *   await audit.log(db, { company_id, id: null, name: 'system' },
 *                   'invoice.reminder_auto_sent', 'invoice', invId, invNo)
 *
 * The second argument can be:
 *   - An Express req object  (reads req.user.company_id, req.user.id, req.ip)
 *   - A plain object         { company_id, id, name, ip }   (cron / system calls)
 *
 * Never throws — failures are logged to stderr but don't break the calling operation.
 */

const db = require('../db')

/**
 * @param {object}         conn          - db pool or transaction client
 * @param {object|Request} ctx           - Express req OR { company_id, id, name, ip }
 * @param {string}         action        - dotted action key e.g. 'invoice.void'
 * @param {string}         entityType    - 'invoice' | 'user' | 'company' | …
 * @param {string}         [entityId]    - UUID or other stable ID
 * @param {string}         [entityLabel] - Human-readable label (invoice_no, user name…)
 * @param {object}         [oldValue]    - Before state (JSONB)
 * @param {object}         [newValue]    - After state (JSONB)
 */
async function log(conn, ctx, action, entityType, entityId, entityLabel, oldValue, newValue) {
  try {
    // Support both Express req objects and plain system context objects
    const isReq     = ctx && typeof ctx.headers !== 'undefined'
    const companyId = isReq ? ctx?.user?.company_id : ctx?.company_id
    const userId    = isReq ? ctx?.user?.id          : ctx?.id
    const userName  = isReq ? ctx?.user?.name        : ctx?.name
    const ip        = isReq
      ? (ctx?.ip || ctx?.headers?.['x-forwarded-for'] || null)
      : (ctx?.ip || 'system')

    await (conn || db).query(
      `INSERT INTO audit_log
         (company_id, user_id, user_name, action, entity_type, entity_id, entity_label,
          old_value, new_value, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        companyId, userId, userName,
        action, entityType,
        entityId   || null,
        entityLabel || null,
        oldValue   ? JSON.stringify(oldValue) : null,
        newValue   ? JSON.stringify(newValue) : null,
        ip,
      ]
    )
  } catch (err) {
    // Never propagate — audit must not break primary operations
    console.error('[audit] write failed:', err.message)
  }
}

module.exports = { log }
