/**
 * Tasks & Ticketing routes
 * All authenticated roles can view; assignment/creation open to all
 */
const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');
const cron   = require('node-cron');

router.use(authenticate);

// ── Run migration on module load (idempotent) ───────────────
async function migrate() {
  try {
    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='task_status') THEN
          CREATE TYPE task_status AS ENUM ('open','in_progress','on_hold','completed','cancelled');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='task_priority') THEN
          CREATE TYPE task_priority AS ENUM ('low','medium','high','urgent');
        END IF;
      END $$;
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id      UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        task_no         VARCHAR(20)   NOT NULL,
        title           VARCHAR(300)  NOT NULL,
        description     TEXT,
        category        VARCHAR(100),
        priority        task_priority NOT NULL DEFAULT 'medium',
        status          task_status   NOT NULL DEFAULT 'open',
        assigned_to     UUID          REFERENCES users(id),
        created_by      UUID          REFERENCES users(id),
        due_date        DATE,
        completed_at    TIMESTAMPTZ,
        is_recurring    BOOLEAN       NOT NULL DEFAULT false,
        recur_freq      VARCHAR(20)   NOT NULL DEFAULT 'none',
        recur_interval  SMALLINT      NOT NULL DEFAULT 1,
        recur_end_date  DATE,
        recur_parent_id UUID          REFERENCES tasks(id),
        recur_next_date DATE,
        notes           TEXT,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        UNIQUE(company_id, task_no)
      );
      CREATE TABLE IF NOT EXISTS task_comments (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id     UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        company_id  UUID         NOT NULL REFERENCES companies(id),
        comment     TEXT         NOT NULL,
        created_by  UUID         REFERENCES users(id),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_co     ON tasks(company_id, status, due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_assign ON tasks(assigned_to, status);
      CREATE INDEX IF NOT EXISTS idx_task_comments ON task_comments(task_id, created_at);
    `);
    console.log('[tasks] Tables ready');
  } catch (e) {
    console.error('[tasks] Migration error:', e.message);
  }
}
migrate();

// ── Spawn due recurring tasks (called by scheduler) ─────────
async function spawnDueRecurring() {
  try {
    const { rows: templates } = await db.query(
      `SELECT * FROM tasks
       WHERE is_recurring = true AND recur_parent_id IS NULL
         AND recur_next_date <= CURRENT_DATE
         AND status NOT IN ('cancelled','completed')
         AND (recur_end_date IS NULL OR recur_end_date >= CURRENT_DATE)`
    );
    for (const t of templates) {
      // Compute next task_no
      const { rows: [seq] } = await db.query(
        `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(task_no,'[^0-9]','','g') AS int)),0)+1 AS n
         FROM tasks WHERE company_id=$1`, [t.company_id]);
      const taskNo = 'T-' + String(seq.n).padStart(4, '0');

      await db.query(
        `INSERT INTO tasks
           (company_id,task_no,title,description,category,priority,status,
            assigned_to,created_by,due_date,is_recurring,recur_freq,recur_interval,
            recur_parent_id,notes)
         VALUES($1,$2,$3,$4,$5,$6,'open',$7,$8,$9,false,'none',1,$10,$11)`,
        [t.company_id, taskNo, t.title, t.description, t.category, t.priority,
         t.assigned_to, t.created_by, t.recur_next_date, t.id, t.notes]
      );

      // Advance recur_next_date
      let next = new Date(t.recur_next_date);
      const interval = t.recur_interval || 1;
      if (t.recur_freq === 'daily')        next.setDate(next.getDate() + interval);
      else if (t.recur_freq === 'weekly')  next.setDate(next.getDate() + 7 * interval);
      else if (t.recur_freq === 'monthly') next.setMonth(next.getMonth() + interval);

      await db.query(
        `UPDATE tasks SET recur_next_date=$1, updated_at=now() WHERE id=$2`,
        [next.toISOString().split('T')[0], t.id]
      );
    }
    if (templates.length) console.log(`[tasks] Spawned ${templates.length} recurring instances`);
  } catch (e) {
    console.error('[tasks] Recurring spawn error:', e.message);
  }
}

// Daily at 00:05 — spawn recurring instances
cron.schedule('5 0 * * *', spawnDueRecurring);
// Also run once on startup
setTimeout(spawnDueRecurring, 5000);

// ── Helpers ─────────────────────────────────────────────────
const WITH_USERS = `
  LEFT JOIN users au ON au.id = t.assigned_to
  LEFT JOIN users cu ON cu.id = t.created_by
  LEFT JOIN users pu ON pu.id = t.recur_parent_id
`;
const SELECT_TASK = `
  SELECT t.*,
    au.name AS assigned_to_name,
    cu.name AS created_by_name
  FROM tasks t
  ${WITH_USERS}
`;

// ── GET /tasks ───────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const { status, priority, assigned_to, mine, search, overdue } = req.query;

    const conds = ['t.company_id = $1'];
    const vals  = [co];
    let p = 2;

    if (status)      { conds.push(`t.status = $${p}::task_status`);    vals.push(status);      p++ }
    if (priority)    { conds.push(`t.priority = $${p}::task_priority`); vals.push(priority);    p++ }
    if (assigned_to) { conds.push(`t.assigned_to = $${p}`);             vals.push(assigned_to); p++ }
    if (mine === '1') { conds.push(`t.assigned_to = $${p}`); vals.push(req.user.id); p++ }
    if (overdue === '1') {
      conds.push(`t.due_date < CURRENT_DATE AND t.status NOT IN ('completed','cancelled')`);
    }
    if (search) {
      conds.push(`(t.title ILIKE $${p} OR t.task_no ILIKE $${p} OR t.category ILIKE $${p})`);
      vals.push(`%${search}%`); p++;
    }

    const where = conds.join(' AND ');
    const { rows } = await db.query(
      `${SELECT_TASK} WHERE ${where} ORDER BY
         CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         t.due_date NULLS LAST, t.created_at DESC`,
      vals
    );

    // Summary counts
    const { rows: counts } = await db.query(
      `SELECT status, COUNT(*) AS n FROM tasks WHERE company_id=$1 GROUP BY status`, [co]);
    const summary = Object.fromEntries(counts.map(r => [r.status, parseInt(r.n)]));

    res.json({ data: rows, summary });
  } catch (e) { next(e); }
});

// ── GET /tasks/users ─────────────────────────────────────────
// Returns team members for assignment dropdown
router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, uc.role
       FROM user_companies uc
       JOIN users u ON u.id = uc.user_id
       WHERE uc.company_id=$1 AND u.is_active=true
       ORDER BY u.name`,
      [req.user.company_id]);
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// ── POST /tasks ──────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const {
      title, description, category, priority = 'medium',
      assigned_to, due_date, notes,
      is_recurring = false, recur_freq = 'none', recur_interval = 1,
      recur_end_date, recur_next_date,
    } = req.body;

    if (!title) return res.status(400).json({ error: { message: 'title required' } });

    // Generate task_no
    const { rows: [seq] } = await db.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(task_no,'[^0-9]','','g') AS int)),0)+1 AS n
       FROM tasks WHERE company_id=$1`, [co]);
    const taskNo = 'T-' + String(seq.n).padStart(4, '0');

    const firstDue = recur_next_date || due_date || null;

    const { rows: [task] } = await db.query(
      `INSERT INTO tasks
         (company_id,task_no,title,description,category,priority,
          assigned_to,created_by,due_date,notes,
          is_recurring,recur_freq,recur_interval,recur_end_date,recur_next_date)
       VALUES($1,$2,$3,$4,$5,$6::task_priority,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [co, taskNo, title, description, category, priority,
       assigned_to || null, req.user.id, due_date || null, notes || null,
       !!is_recurring, recur_freq, parseInt(recur_interval) || 1,
       recur_end_date || null, firstDue]
    );

    res.status(201).json({ data: task });
  } catch (e) { next(e); }
});

// ── GET /tasks/:id ───────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [task] } = await db.query(
      `${SELECT_TASK} WHERE t.id=$1 AND t.company_id=$2`,
      [req.params.id, req.user.company_id]);
    if (!task) return res.status(404).json({ error: { message: 'Task not found' } });

    // Comments
    const { rows: comments } = await db.query(
      `SELECT tc.*, u.name AS author_name FROM task_comments tc
       LEFT JOIN users u ON u.id = tc.created_by
       WHERE tc.task_id=$1 ORDER BY tc.created_at ASC`,
      [req.params.id]);

    // Recurring instances (if template)
    let instances = [];
    if (task.is_recurring && !task.recur_parent_id) {
      const { rows } = await db.query(
        `SELECT id,task_no,title,status,due_date,completed_at FROM tasks
         WHERE recur_parent_id=$1 ORDER BY due_date DESC LIMIT 20`,
        [req.params.id]);
      instances = rows;
    }

    res.json({ data: { ...task, comments, instances } });
  } catch (e) { next(e); }
});

// ── PUT /tasks/:id ───────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const {
      title, description, category, priority, status,
      assigned_to, due_date, notes,
      is_recurring, recur_freq, recur_interval, recur_end_date, recur_next_date,
    } = req.body;

    const completedAt = status === 'completed' ? 'now()' : 'NULL';

    const { rows: [task] } = await db.query(
      `UPDATE tasks SET
         title=$1, description=$2, category=$3,
         priority=$4::task_priority, status=$5::task_status,
         assigned_to=$6, due_date=$7, notes=$8,
         is_recurring=$9, recur_freq=$10, recur_interval=$11,
         recur_end_date=$12, recur_next_date=$13,
         completed_at=CASE WHEN $5::task_status='completed' THEN COALESCE(completed_at,now()) ELSE NULL END,
         updated_at=now()
       WHERE id=$14 AND company_id=$15
       RETURNING *`,
      [title, description, category, priority, status,
       assigned_to || null, due_date || null, notes || null,
       !!is_recurring, recur_freq || 'none', parseInt(recur_interval) || 1,
       recur_end_date || null, recur_next_date || null,
       req.params.id, req.user.company_id]
    );
    if (!task) return res.status(404).json({ error: { message: 'Task not found' } });
    res.json({ data: task });
  } catch (e) { next(e); }
});

// ── PATCH /tasks/:id/status ──────────────────────────────────
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const { rows: [task] } = await db.query(
      `UPDATE tasks SET
         status=$1::task_status,
         completed_at=CASE WHEN $1::task_status='completed' THEN COALESCE(completed_at,now()) ELSE NULL END,
         updated_at=now()
       WHERE id=$2 AND company_id=$3 RETURNING *`,
      [status, req.params.id, req.user.company_id]);
    if (!task) return res.status(404).json({ error: { message: 'Task not found' } });
    res.json({ data: task });
  } catch (e) { next(e); }
});

// ── DELETE /tasks/:id ────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM tasks WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.company_id]);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

// ── POST /tasks/:id/comments ─────────────────────────────────
router.post('/:id/comments', async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment?.trim()) return res.status(400).json({ error: { message: 'comment required' } });
    const { rows: [c] } = await db.query(
      `INSERT INTO task_comments(task_id,company_id,comment,created_by)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [req.params.id, req.user.company_id, comment.trim(), req.user.id]);
    // Touch task updated_at
    await db.query(`UPDATE tasks SET updated_at=now() WHERE id=$1`, [req.params.id]);
    res.status(201).json({ data: { ...c, author_name: req.user.name } });
  } catch (e) { next(e); }
});

// ── DELETE /tasks/comments/:commentId ───────────────────────
router.delete('/comments/:commentId', async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM task_comments WHERE id=$1 AND company_id=$2`,
      [req.params.commentId, req.user.company_id]);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
