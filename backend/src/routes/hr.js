const router = require('express').Router();
const db     = require('../db');
const { v4: uuid } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GOSI rates: Bahraini = 7% employee / 12% employer
//             Expat    = 1% employee (unemployment) / 3% employer (work injury)
//             If employer_covers_gosi=true, employee deduction is 0 (employer absorbs 1%)
function calcGosi(basic, emp) {
  if (!emp.gosi_eligible) return { gosiEmp: 0, gosiEr: 0 };
  if (emp.is_bahraini) {
    return {
      gosiEmp: parseFloat((basic * 0.07).toFixed(3)),
      gosiEr:  parseFloat((basic * 0.12).toFixed(3)),
    };
  }
  // Expat
  const erAmount  = parseFloat((basic * 0.03).toFixed(3));
  const empAmount = emp.employer_covers_gosi ? 0 : parseFloat((basic * 0.01).toFixed(3));
  return { gosiEmp: empAmount, gosiEr: erAmount };
}

// EOSB: expat only (March 2024 reform)
// years of service at run date → 4.2% (≤3 yrs) or 8.4% (>3 yrs)
// basis = basic salary
function calcEosb(basic, emp, runYear, runMonth) {
  if (!emp.gosi_eligible || emp.is_bahraini || !emp.join_date) return { eosbRate: 0, eosbAmt: 0 };
  const joinDate = new Date(emp.join_date);
  const runDate  = new Date(runYear, runMonth - 1, 1);
  const diffMs   = runDate - joinDate;
  const years    = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  const rate     = years > 3 ? 8.4 : 4.2;
  return {
    eosbRate: rate,
    eosbAmt:  parseFloat((basic * rate / 100).toFixed(3)),
  };
}

// ─── EMPLOYEES ───────────────────────────────────────────────

// List employees
router.get('/employees', async (req, res, next) => {
  try {
    const { status, q } = req.query;
    const params = [req.user.company_id];
    let where = ['company_id = $1'];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (q)      { params.push(`%${q}%`); where.push(`(full_name ILIKE $${params.length} OR emp_no ILIKE $${params.length} OR position ILIKE $${params.length} OR department ILIKE $${params.length})`); }
    const { rows } = await db.query(
      `SELECT * FROM employees WHERE ${where.join(' AND ')} ORDER BY emp_no`, params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Get one employee
router.get('/employees/:id', async (req, res, next) => {
  try {
    const { rows: [row] } = await db.query(
      `SELECT * FROM employees WHERE id=$1 AND company_id=$2`, [req.params.id, req.user.company_id]
    );
    if (!row) return res.status(404).json({ error: { message: 'Employee not found' } });
    res.json({ data: row });
  } catch (err) { next(err); }
});

// Create employee
router.post('/employees', authorize('admin','accountant'), async (req, res, next) => {
  try {
    const {
      emp_no, full_name, nationality, id_number, position, department,
      join_date, status, basic_salary, housing_allow, transport_allow,
      other_allow, gosi_eligible, is_bahraini, employer_covers_gosi,
      annual_leave_days, bank_name, bank_iban, notes
    } = req.body;
    const { rows: [row] } = await db.query(
      `INSERT INTO employees
         (id,company_id,emp_no,full_name,nationality,id_number,position,department,
          join_date,status,basic_salary,housing_allow,transport_allow,other_allow,
          gosi_eligible,is_bahraini,employer_covers_gosi,annual_leave_days,bank_name,bank_iban,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [uuid(), req.user.company_id, emp_no, full_name, nationality||null, id_number||null,
       position||null, department||null, join_date||null, status||'active',
       basic_salary||0, housing_allow||0, transport_allow||0, other_allow||0,
       gosi_eligible !== false, is_bahraini === true, employer_covers_gosi === true,
       parseInt(annual_leave_days)||30, bank_name||null, bank_iban||null, notes||null]
    );
    res.status(201).json({ data: row });
  } catch (err) { next(err); }
});

// Update employee
router.put('/employees/:id', authorize('admin','accountant'), async (req, res, next) => {
  try {
    const {
      full_name, nationality, id_number, position, department,
      join_date, status, basic_salary, housing_allow, transport_allow,
      other_allow, gosi_eligible, is_bahraini, employer_covers_gosi,
      annual_leave_days, bank_name, bank_iban, notes
    } = req.body;
    const { rows: [row] } = await db.query(
      `UPDATE employees SET
         full_name=$3, nationality=$4, id_number=$5, position=$6, department=$7,
         join_date=$8, status=$9, basic_salary=$10, housing_allow=$11,
         transport_allow=$12, other_allow=$13, gosi_eligible=$14,
         is_bahraini=$15, employer_covers_gosi=$16, annual_leave_days=$17,
         bank_name=$18, bank_iban=$19, notes=$20
       WHERE id=$1 AND company_id=$2 RETURNING *`,
      [req.params.id, req.user.company_id,
       full_name, nationality||null, id_number||null, position||null, department||null,
       join_date||null, status||'active',
       basic_salary||0, housing_allow||0, transport_allow||0, other_allow||0,
       gosi_eligible !== false, is_bahraini === true, employer_covers_gosi === true,
       parseInt(annual_leave_days)||30, bank_name||null, bank_iban||null, notes||null]
    );
    if (!row) return res.status(404).json({ error: { message: 'Employee not found' } });
    res.json({ data: row });
  } catch (err) { next(err); }
});

// Terminate / status change
router.patch('/employees/:id/status', authorize('admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const { rows: [row] } = await db.query(
      `UPDATE employees SET status=$1 WHERE id=$2 AND company_id=$3 RETURNING *`,
      [status, req.params.id, req.user.company_id]
    );
    if (!row) return res.status(404).json({ error: { message: 'Employee not found' } });
    res.json({ data: row });
  } catch (err) { next(err); }
});

// ─── PAYROLL RUNS ────────────────────────────────────────────

// List runs
router.get('/payroll', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT pr.*,
              COUNT(ps.id)         AS slip_count,
              COALESCE(SUM(ps.net_pay),0) AS total_net,
              COALESCE(SUM(ps.gross_pay),0) AS total_gross
       FROM payroll_runs pr
       LEFT JOIN payslips ps ON ps.run_id = pr.id
       WHERE pr.company_id = $1
       GROUP BY pr.id
       ORDER BY pr.run_year DESC, pr.run_month DESC`,
      [req.user.company_id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Get run with payslips
router.get('/payroll/:id', async (req, res, next) => {
  try {
    const { rows: [run] } = await db.query(
      `SELECT * FROM payroll_runs WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.company_id]
    );
    if (!run) return res.status(404).json({ error: { message: 'Run not found' } });
    const { rows: slips } = await db.query(
      `SELECT ps.*, e.emp_no, e.full_name, e.position, e.department,
              e.bank_name, e.bank_iban, e.is_bahraini, e.nationality
       FROM payslips ps
       JOIN employees e ON e.id = ps.employee_id
       WHERE ps.run_id = $1
       ORDER BY e.emp_no`,
      [req.params.id]
    );
    res.json({ data: { ...run, payslips: slips } });
  } catch (err) { next(err); }
});

// Create payroll run (generates payslips for all active employees)
router.post('/payroll', authorize('admin','accountant'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { run_month, run_year, notes } = req.body;
    const co = req.user.company_id;

    // Check no duplicate
    const { rows: dup } = await client.query(
      `SELECT id FROM payroll_runs WHERE company_id=$1 AND run_year=$2 AND run_month=$3`,
      [co, run_year, run_month]
    );
    if (dup.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { message: `Payroll run for ${run_month}/${run_year} already exists` } });
    }

    // Create run
    const { rows: [run] } = await client.query(
      `INSERT INTO payroll_runs (id,company_id,run_month,run_year,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [uuid(), co, run_month, run_year, notes||null, req.user.id]
    );

    // Fetch active employees
    const { rows: emps } = await client.query(
      `SELECT * FROM employees WHERE company_id=$1 AND status='active'`, [co]
    );

    // Generate payslip for each
    for (const e of emps) {
      const basic   = parseFloat(e.basic_salary);
      const housing = parseFloat(e.housing_allow);
      const trans   = parseFloat(e.transport_allow);
      const other   = parseFloat(e.other_allow);
      const gross   = basic + housing + trans + other;
      const { gosiEmp, gosiEr }   = calcGosi(basic, e);
      const { eosbRate, eosbAmt } = calcEosb(basic, e, run_year, run_month);
      const totalDed = gosiEmp;
      const netPay   = parseFloat((gross - totalDed).toFixed(3));

      await client.query(
        `INSERT INTO payslips
           (id,run_id,company_id,employee_id,basic_salary,housing_allow,transport_allow,
            other_allow,overtime_pay,bonus,gross_pay,gosi_employee,gosi_employer,
            absence_deduct,loan_deduct,other_deduct,total_deductions,net_pay,
            eosb_rate,eosb_contribution)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,0,$9,$10,$11,0,0,0,$12,$13,$14,$15)`,
        [uuid(), run.id, co, e.id, basic, housing, trans, other,
         gross, gosiEmp, gosiEr, totalDed, netPay, eosbRate, eosbAmt]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ data: run, count: emps.length });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// Update single payslip (overtime, bonus, deductions)
router.put('/payroll/:runId/payslips/:slipId', authorize('admin','accountant'), async (req, res, next) => {
  try {
    const { overtime_pay, bonus, absence_deduct, loan_deduct, other_deduct, notes } = req.body;
    // Fetch current slip
    const { rows: [slip] } = await db.query(
      `SELECT ps.*, pr.run_month, pr.run_year,
              e.basic_salary, e.housing_allow, e.transport_allow, e.other_allow,
              e.gosi_eligible, e.is_bahraini, e.employer_covers_gosi, e.join_date
       FROM payslips ps
       JOIN employees e ON e.id = ps.employee_id
       JOIN payroll_runs pr ON pr.id = ps.run_id
       WHERE ps.id=$1 AND ps.company_id=$2`,
      [req.params.slipId, req.user.company_id]
    );
    if (!slip) return res.status(404).json({ error: { message: 'Payslip not found' } });

    const ot  = parseFloat(overtime_pay)||0;
    const bon = parseFloat(bonus)||0;
    const gross = parseFloat(slip.basic_salary) + parseFloat(slip.housing_allow) +
                  parseFloat(slip.transport_allow) + parseFloat(slip.other_allow) + ot + bon;
    const { gosiEmp, gosiEr }   = calcGosi(parseFloat(slip.basic_salary), slip);
    const { eosbRate, eosbAmt } = calcEosb(parseFloat(slip.basic_salary), slip, slip.run_year, slip.run_month);
    const absD = parseFloat(absence_deduct)||0;
    const loanD = parseFloat(loan_deduct)||0;
    const othD = parseFloat(other_deduct)||0;
    const totalDed = parseFloat((gosiEmp + absD + loanD + othD).toFixed(3));
    const netPay   = parseFloat((gross - totalDed).toFixed(3));

    const { rows: [updated] } = await db.query(
      `UPDATE payslips SET
         overtime_pay=$3, bonus=$4, gross_pay=$5, gosi_employee=$6, gosi_employer=$7,
         absence_deduct=$8, loan_deduct=$9, other_deduct=$10, total_deductions=$11,
         net_pay=$12, notes=$13, eosb_rate=$14, eosb_contribution=$15
       WHERE id=$1 AND company_id=$2 RETURNING *`,
      [req.params.slipId, req.user.company_id,
       ot, bon, gross, gosiEmp, gosiEr, absD, loanD, othD, totalDed, netPay, notes||null,
       eosbRate, eosbAmt]
    );
    res.json({ data: updated });
  } catch (err) { next(err); }
});

// Approve payroll run
router.patch('/payroll/:id/approve', authorize('admin'), async (req, res, next) => {
  try {
    const { rows: [row] } = await db.query(
      `UPDATE payroll_runs SET status='approved', approved_by=$1
       WHERE id=$2 AND company_id=$3 AND status='draft' RETURNING *`,
      [req.user.id, req.params.id, req.user.company_id]
    );
    if (!row) return res.status(404).json({ error: { message: 'Run not found or not in draft' } });
    res.json({ data: row });
  } catch (err) { next(err); }
});

// Mark payroll paid
router.patch('/payroll/:id/paid', authorize('admin'), async (req, res, next) => {
  try {
    const { rows: [row] } = await db.query(
      `UPDATE payroll_runs SET status='paid', paid_at=now()
       WHERE id=$2 AND company_id=$3 AND status='approved' RETURNING *`,
      [req.user.id, req.params.id, req.user.company_id]
    );
    if (!row) return res.status(404).json({ error: { message: 'Run not found or not approved' } });
    res.json({ data: row });
  } catch (err) { next(err); }
});

// Delete draft run
router.delete('/payroll/:id', authorize('admin'), async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM payroll_runs WHERE id=$1 AND company_id=$2 AND status='draft'`,
      [req.params.id, req.user.company_id]
    );
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// HR summary (for dashboard)
router.get('/summary', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const [empRows, lastRun] = await Promise.all([
      db.query(`SELECT status, COUNT(*) AS cnt FROM employees WHERE company_id=$1 GROUP BY status`, [co]),
      db.query(
        `SELECT pr.*, COALESCE(SUM(ps.net_pay),0) AS total_net, COUNT(ps.id) AS slip_count
         FROM payroll_runs pr LEFT JOIN payslips ps ON ps.run_id=pr.id
         WHERE pr.company_id=$1 GROUP BY pr.id ORDER BY pr.run_year DESC, pr.run_month DESC LIMIT 1`,
        [co]
      ),
    ]);
    const empMap = {};
    empRows.rows.forEach(r => empMap[r.status] = parseInt(r.cnt));
    res.json({
      data: {
        active_employees:     empMap.active    || 0,
        on_leave_employees:   empMap.on_leave  || 0,
        terminated_employees: empMap.terminated|| 0,
        last_run: lastRun.rows[0] || null,
      }
    });
  } catch (err) { next(err); }
});

// ─── LEAVE MANAGEMENT ────────────────────────────────────────

// Leave balance for an employee (current calendar year)
router.get('/employees/:id/leave-balance', async (req, res, next) => {
  try {
    const co  = req.user.company_id;
    const year = new Date().getFullYear();
    const [emp, used] = await Promise.all([
      db.query(`SELECT id, full_name, annual_leave_days FROM employees WHERE id=$1 AND company_id=$2`, [req.params.id, co]),
      db.query(
        `SELECT COALESCE(SUM(days_taken), 0)      AS taken_annual,
                COALESCE(SUM(days_requested)
                  FILTER (WHERE status='active'),0) AS pending_days
         FROM employee_leaves
         WHERE employee_id=$1 AND company_id=$2
           AND leave_type='annual'
           AND EXTRACT(YEAR FROM start_date)=$3`,
        [req.params.id, co, year]
      ),
    ]);
    if (!emp.rows[0]) return res.status(404).json({ error:{ message:'Employee not found' } });
    const entitlement = emp.rows[0].annual_leave_days;
    const taken       = parseFloat(used.rows[0].taken_annual);
    const pending     = parseFloat(used.rows[0].pending_days);
    res.json({ data: { entitlement, taken, pending, remaining: entitlement - taken - pending } });
  } catch (err) { next(err); }
});

// List leaves for an employee
router.get('/employees/:id/leaves', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM employee_leaves
       WHERE employee_id=$1 AND company_id=$2
       ORDER BY start_date DESC`,
      [req.params.id, req.user.company_id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// List all active leaves (for overview)
router.get('/leaves', async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const params = [req.user.company_id];
    let where = ['l.company_id=$1'];
    if (status) { params.push(status); where.push(`l.status=$${params.length}`); }
    if (type)   { params.push(type);   where.push(`l.leave_type=$${params.length}`); }
    const { rows } = await db.query(
      `SELECT l.*, e.emp_no, e.full_name, e.position, e.department
       FROM employee_leaves l
       JOIN employees e ON e.id = l.employee_id
       WHERE ${where.join(' AND ')}
       ORDER BY l.start_date DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Start leave — marks employee on_leave, creates leave record
router.post('/employees/:id/leaves', authorize('admin','accountant'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const co = req.user.company_id;
    const { leave_type, start_date, end_date, days_requested, notes } = req.body;

    // Verify employee exists and is active
    const { rows: [emp] } = await client.query(
      `SELECT id, status FROM employees WHERE id=$1 AND company_id=$2`, [req.params.id, co]
    );
    if (!emp) { await client.query('ROLLBACK'); return res.status(404).json({ error:{ message:'Employee not found' } }); }

    // Check no overlapping active leave
    const { rows: overlap } = await client.query(
      `SELECT id FROM employee_leaves
       WHERE employee_id=$1 AND status='active'
         AND start_date <= $2 AND (end_date IS NULL OR end_date >= $3)`,
      [req.params.id, end_date || '9999-12-31', start_date]
    );
    if (overlap.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error:{ message:'Employee already has an overlapping active leave' } });
    }

    // Insert leave record
    const { rows: [leave] } = await client.query(
      `INSERT INTO employee_leaves
         (id,company_id,employee_id,leave_type,start_date,end_date,days_requested,status,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9) RETURNING *`,
      [require('uuid').v4(), co, req.params.id, leave_type||'annual',
       start_date, end_date||null, days_requested||0, notes||null, req.user.id]
    );

    // Set employee status to on_leave
    await client.query(
      `UPDATE employees SET status='on_leave' WHERE id=$1 AND company_id=$2`,
      [req.params.id, co]
    );

    await client.query('COMMIT');
    res.status(201).json({ data: leave });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// Resume duty — closes leave, marks employee active, records actual days taken
router.patch('/leaves/:leaveId/resume', authorize('admin','accountant'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const co = req.user.company_id;
    const { resume_date, days_taken, notes } = req.body;
    const effectiveResume = resume_date || new Date().toISOString().split('T')[0];

    // Fetch leave
    const { rows: [leave] } = await client.query(
      `SELECT l.*, e.id AS emp_id FROM employee_leaves l
       JOIN employees e ON e.id=l.employee_id
       WHERE l.id=$1 AND l.company_id=$2 AND l.status='active'`,
      [req.params.leaveId, co]
    );
    if (!leave) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error:{ message:'Active leave not found' } });
    }

    // Calculate days_taken if not provided
    let actualDays = days_taken != null ? parseFloat(days_taken) : null;
    if (actualDays == null) {
      const start = new Date(leave.start_date);
      const end   = new Date(effectiveResume);
      actualDays  = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    }

    // Update leave record
    const { rows: [updated] } = await client.query(
      `UPDATE employee_leaves SET
         status='resumed', resume_date=$1, days_taken=$2,
         end_date=COALESCE(end_date,$1), notes=COALESCE($3,notes)
       WHERE id=$4 RETURNING *`,
      [effectiveResume, actualDays, notes||null, req.params.leaveId]
    );

    // Set employee back to active only if no other active leave
    const { rows: other } = await client.query(
      `SELECT id FROM employee_leaves WHERE employee_id=$1 AND status='active' AND id!=$2`,
      [leave.emp_id, req.params.leaveId]
    );
    if (!other.length) {
      await client.query(
        `UPDATE employees SET status='active' WHERE id=$1 AND company_id=$2`,
        [leave.emp_id, co]
      );
    }

    await client.query('COMMIT');
    res.json({ data: updated });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// Cancel a leave (admin only, while still active)
router.patch('/leaves/:leaveId/cancel', authorize('admin'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const co = req.user.company_id;
    const { rows: [leave] } = await client.query(
      `UPDATE employee_leaves SET status='cancelled'
       WHERE id=$1 AND company_id=$2 AND status='active' RETURNING *`,
      [req.params.leaveId, co]
    );
    if (!leave) { await client.query('ROLLBACK'); return res.status(404).json({ error:{ message:'Active leave not found' } }); }
    // Restore employee to active
    const { rows: other } = await client.query(
      `SELECT id FROM employee_leaves WHERE employee_id=$1 AND status='active'`, [leave.employee_id]
    );
    if (!other.length) {
      await client.query(`UPDATE employees SET status='active' WHERE id=$1 AND company_id=$2`, [leave.employee_id, co]);
    }
    await client.query('COMMIT');
    res.json({ data: leave });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

module.exports = router;
