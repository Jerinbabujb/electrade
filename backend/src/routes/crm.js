/**
 * CRM Routes — Contacts, Interactions, Opportunities
 * GET/POST /api/v1/crm/contacts
 * GET/POST /api/v1/crm/interactions
 * GET/POST/PUT/DELETE /api/v1/crm/opportunities
 * GET /api/v1/crm/dashboard
 */
const router = require('express').Router();
const db     = require('../db');
const { v4: uuid } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ── Auto-migration (idempotent) ────────────────────────────
async function migrate() {
  try {
    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interaction_type') THEN
          CREATE TYPE interaction_type AS ENUM ('call','email','meeting','visit','note','whatsapp');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opp_stage') THEN
          CREATE TYPE opp_stage AS ENUM ('lead','contacted','quoted','negotiation','won','lost');
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS customer_contacts (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        name        VARCHAR(200) NOT NULL,
        title       VARCHAR(100),
        department  VARCHAR(100),
        tel         VARCHAR(30),
        mobile      VARCHAR(30),
        email       VARCHAR(150),
        is_primary  BOOLEAN NOT NULL DEFAULT false,
        notes       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_contacts_customer ON customer_contacts(customer_id);

      CREATE TABLE IF NOT EXISTS customer_interactions (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        contact_id     UUID REFERENCES customer_contacts(id) ON DELETE SET NULL,
        type           interaction_type NOT NULL DEFAULT 'note',
        subject        VARCHAR(300),
        body           TEXT,
        occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by     UUID REFERENCES users(id),
        follow_up_date DATE,
        follow_up_done BOOLEAN NOT NULL DEFAULT false,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_interactions_customer ON customer_interactions(customer_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_interactions_followup ON customer_interactions(company_id, follow_up_date)
        WHERE follow_up_done = false;

      CREATE TABLE IF NOT EXISTS crm_opportunities (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        customer_id    UUID NOT NULL REFERENCES customers(id),
        contact_id     UUID REFERENCES customer_contacts(id) ON DELETE SET NULL,
        quotation_id   UUID REFERENCES invoices(id) ON DELETE SET NULL,
        title          VARCHAR(300) NOT NULL,
        stage          opp_stage NOT NULL DEFAULT 'lead',
        value          NUMERIC(15,3) NOT NULL DEFAULT 0,
        probability    SMALLINT NOT NULL DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
        expected_close DATE,
        description    TEXT,
        lost_reason    TEXT,
        created_by     UUID REFERENCES users(id),
        assigned_to    UUID REFERENCES users(id),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_opp_company  ON crm_opportunities(company_id, stage);
      CREATE INDEX IF NOT EXISTS idx_opp_customer ON crm_opportunities(customer_id);
    `);
  } catch (err) {
    console.error('[crm] migrate error:', err.message);
  }
}
migrate();

// ════════════════════════════════════════════════════════════
// CONTACTS
// ════════════════════════════════════════════════════════════

// GET /crm/contacts?customer_id=X
router.get('/contacts', async (req, res, next) => {
  try {
    const { customer_id } = req.query;
    const params = [req.user.company_id];
    let where = 'cc.company_id = $1';
    if (customer_id) { params.push(customer_id); where += ` AND cc.customer_id = $${params.length}`; }
    const { rows } = await db.query(
      `SELECT cc.* FROM customer_contacts cc WHERE ${where} ORDER BY cc.is_primary DESC, cc.name`, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// POST /crm/contacts
router.post('/contacts', authorize('admin','sales'), async (req, res, next) => {
  try {
    const { customer_id, name, title, department, tel, mobile, email, is_primary, notes } = req.body;
    if (!customer_id || !name) return res.status(400).json({ error: { message: 'customer_id and name required' } });
    if (is_primary) {
      await db.query(`UPDATE customer_contacts SET is_primary = false WHERE customer_id = $1 AND company_id = $2`,
        [customer_id, req.user.company_id]);
    }
    const { rows: [row] } = await db.query(
      `INSERT INTO customer_contacts (id, company_id, customer_id, name, title, department, tel, mobile, email, is_primary, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [uuid(), req.user.company_id, customer_id, name, title||null, department||null,
       tel||null, mobile||null, email||null, !!is_primary, notes||null]);
    res.status(201).json({ data: row });
  } catch (err) { next(err); }
});

// PUT /crm/contacts/:id
router.put('/contacts/:id', authorize('admin','sales'), async (req, res, next) => {
  try {
    const { name, title, department, tel, mobile, email, is_primary, notes } = req.body;
    if (is_primary) {
      const { rows: [c] } = await db.query(`SELECT customer_id FROM customer_contacts WHERE id = $1`, [req.params.id]);
      if (c) await db.query(`UPDATE customer_contacts SET is_primary = false WHERE customer_id = $1 AND company_id = $2 AND id != $3`,
        [c.customer_id, req.user.company_id, req.params.id]);
    }
    const { rows: [row] } = await db.query(
      `UPDATE customer_contacts SET name=$1, title=$2, department=$3, tel=$4, mobile=$5, email=$6, is_primary=$7, notes=$8
       WHERE id=$9 AND company_id=$10 RETURNING *`,
      [name, title||null, department||null, tel||null, mobile||null, email||null, !!is_primary, notes||null,
       req.params.id, req.user.company_id]);
    if (!row) return res.status(404).json({ error: { message: 'Contact not found' } });
    res.json({ data: row });
  } catch (err) { next(err); }
});

// DELETE /crm/contacts/:id
router.delete('/contacts/:id', authorize('admin','sales'), async (req, res, next) => {
  try {
    await db.query(`DELETE FROM customer_contacts WHERE id = $1 AND company_id = $2`, [req.params.id, req.user.company_id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════
// INTERACTIONS
// ════════════════════════════════════════════════════════════

// GET /crm/interactions?customer_id=X&limit=50
router.get('/interactions', async (req, res, next) => {
  try {
    const { customer_id, limit = 100 } = req.query;
    const params = [req.user.company_id];
    let where = 'ci.company_id = $1';
    if (customer_id) { params.push(customer_id); where += ` AND ci.customer_id = $${params.length}`; }
    params.push(Number(limit));
    const { rows } = await db.query(
      `SELECT ci.*, u.name AS created_by_name, cc.name AS contact_name
       FROM customer_interactions ci
       LEFT JOIN users u ON u.id = ci.created_by
       LEFT JOIN customer_contacts cc ON cc.id = ci.contact_id
       WHERE ${where}
       ORDER BY ci.occurred_at DESC
       LIMIT $${params.length}`, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// POST /crm/interactions
router.post('/interactions', authorize('admin','sales'), async (req, res, next) => {
  try {
    const { customer_id, contact_id, type, subject, body, occurred_at, follow_up_date } = req.body;
    if (!customer_id) return res.status(400).json({ error: { message: 'customer_id required' } });
    const { rows: [row] } = await db.query(
      `INSERT INTO customer_interactions
         (id, company_id, customer_id, contact_id, type, subject, body, occurred_at, created_by, follow_up_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [uuid(), req.user.company_id, customer_id, contact_id||null,
       type||'note', subject||null, body||null,
       occurred_at || new Date(), req.user.id, follow_up_date||null]);
    // Fetch with joined fields
    const { rows: [full] } = await db.query(
      `SELECT ci.*, u.name AS created_by_name, cc.name AS contact_name
       FROM customer_interactions ci
       LEFT JOIN users u ON u.id = ci.created_by
       LEFT JOIN customer_contacts cc ON cc.id = ci.contact_id
       WHERE ci.id = $1`, [row.id]);
    res.status(201).json({ data: full });
  } catch (err) { next(err); }
});

// PATCH /crm/interactions/:id/done  (mark follow-up done)
router.patch('/interactions/:id/done', authorize('admin','sales'), async (req, res, next) => {
  try {
    await db.query(
      `UPDATE customer_interactions SET follow_up_done = true WHERE id = $1 AND company_id = $2`,
      [req.params.id, req.user.company_id]);
    res.json({ message: 'Follow-up marked done' });
  } catch (err) { next(err); }
});

// DELETE /crm/interactions/:id
router.delete('/interactions/:id', authorize('admin','sales'), async (req, res, next) => {
  try {
    await db.query(`DELETE FROM customer_interactions WHERE id = $1 AND company_id = $2`,
      [req.params.id, req.user.company_id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════
// OPPORTUNITIES
// ════════════════════════════════════════════════════════════

// GET /crm/opportunities?customer_id=X&stage=lead
router.get('/opportunities', async (req, res, next) => {
  try {
    const { customer_id, stage } = req.query;
    const params = [req.user.company_id];
    const conds = ['o.company_id = $1'];
    if (customer_id) { params.push(customer_id); conds.push(`o.customer_id = $${params.length}`); }
    if (stage)       { params.push(stage);       conds.push(`o.stage = $${params.length}`); }
    const { rows } = await db.query(
      `SELECT o.*, c.name AS customer_name, c.code AS customer_code,
              cc.name AS contact_name,
              u.name AS assigned_to_name,
              inv.invoice_no AS quotation_no
       FROM crm_opportunities o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN customer_contacts cc ON cc.id = o.contact_id
       LEFT JOIN users u ON u.id = o.assigned_to
       LEFT JOIN invoices inv ON inv.id = o.quotation_id
       WHERE ${conds.join(' AND ')}
       ORDER BY o.updated_at DESC`, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// POST /crm/opportunities
router.post('/opportunities', authorize('admin','sales'), async (req, res, next) => {
  try {
    const { customer_id, contact_id, quotation_id, title, stage, value,
            probability, expected_close, description, assigned_to } = req.body;
    if (!customer_id || !title) return res.status(400).json({ error: { message: 'customer_id and title required' } });
    const { rows: [row] } = await db.query(
      `INSERT INTO crm_opportunities
         (id, company_id, customer_id, contact_id, quotation_id, title, stage, value,
          probability, expected_close, description, created_by, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [uuid(), req.user.company_id, customer_id, contact_id||null, quotation_id||null,
       title, stage||'lead', Number(value)||0, Number(probability)||50,
       expected_close||null, description||null, req.user.id, assigned_to||req.user.id]);
    // Return with joins
    const { rows: [full] } = await db.query(
      `SELECT o.*, c.name AS customer_name, c.code AS customer_code,
              u.name AS assigned_to_name
       FROM crm_opportunities o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.assigned_to
       WHERE o.id = $1`, [row.id]);
    res.status(201).json({ data: full });
  } catch (err) { next(err); }
});

// PUT /crm/opportunities/:id
router.put('/opportunities/:id', authorize('admin','sales'), async (req, res, next) => {
  try {
    const { customer_id, contact_id, quotation_id, title, stage, value,
            probability, expected_close, description, lost_reason, assigned_to } = req.body;
    const { rows: [row] } = await db.query(
      `UPDATE crm_opportunities SET
         customer_id=$1, contact_id=$2, quotation_id=$3, title=$4, stage=$5,
         value=$6, probability=$7, expected_close=$8, description=$9,
         lost_reason=$10, assigned_to=$11, updated_at=now()
       WHERE id=$12 AND company_id=$13 RETURNING *`,
      [customer_id, contact_id||null, quotation_id||null, title, stage||'lead',
       Number(value)||0, Number(probability)||50, expected_close||null,
       description||null, lost_reason||null, assigned_to||null,
       req.params.id, req.user.company_id]);
    if (!row) return res.status(404).json({ error: { message: 'Opportunity not found' } });
    res.json({ data: row });
  } catch (err) { next(err); }
});

// DELETE /crm/opportunities/:id
router.delete('/opportunities/:id', authorize('admin','sales'), async (req, res, next) => {
  try {
    await db.query(`DELETE FROM crm_opportunities WHERE id = $1 AND company_id = $2`,
      [req.params.id, req.user.company_id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ════════════════════════════════════════════════════════════

router.get('/dashboard', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.slice(0, 7) + '-01';

    const [pipeline, wonMonth, followUps, recentActivity] = await Promise.all([
      // Pipeline value by stage (excluding won/lost)
      db.query(
        `SELECT stage, COUNT(*) AS count, SUM(value) AS total_value,
                SUM(value * probability / 100) AS weighted_value
         FROM crm_opportunities
         WHERE company_id = $1 AND stage NOT IN ('won','lost')
         GROUP BY stage`, [co]),
      // Won this month
      db.query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(value),0) AS total_value
         FROM crm_opportunities
         WHERE company_id = $1 AND stage = 'won' AND updated_at >= $2`, [co, firstOfMonth]),
      // Follow-ups due today or overdue
      db.query(
        `SELECT COUNT(*) AS count FROM customer_interactions
         WHERE company_id = $1 AND follow_up_done = false AND follow_up_date <= $2`, [co, today]),
      // Recent interactions (last 5)
      db.query(
        `SELECT ci.type, ci.subject, ci.occurred_at, c.name AS customer_name, u.name AS created_by_name
         FROM customer_interactions ci
         JOIN customers c ON c.id = ci.customer_id
         LEFT JOIN users u ON u.id = ci.created_by
         WHERE ci.company_id = $1
         ORDER BY ci.occurred_at DESC LIMIT 5`, [co]),
    ]);

    res.json({
      data: {
        pipeline:       pipeline.rows,
        won_month:      wonMonth.rows[0],
        follow_ups_due: Number(followUps.rows[0].count),
        recent_activity: recentActivity.rows,
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
