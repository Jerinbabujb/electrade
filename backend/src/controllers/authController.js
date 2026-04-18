const db      = require('../db')
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const { v4: uuid } = require('uuid')

const sign = ({ id, company_id, role, name }) =>
  jwt.sign({ id, company_id, role, name }, process.env.JWT_SECRET, { expiresIn: '12h' })

// Fetch all companies a user belongs to (ordered: default first, then alpha)
const getUserCompanies = (userId) =>
  db.query(
    `SELECT c.id, c.name, c.cr_number, c.vat_number, c.default_vat_rate,
            c.default_currency, c.logo_url, c.logo,
            c.bank_name, c.bank_iban, c.bank_swift,
            uc.role, uc.is_default
     FROM user_companies uc
     JOIN companies c ON c.id = uc.company_id
     WHERE uc.user_id = $1
     ORDER BY uc.is_default DESC, c.name`,
    [userId]
  ).then(r => r.rows)

// POST /api/v1/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: { message: 'Email and password required' } })

    const { rows: [user] } = await db.query(
      `SELECT * FROM users WHERE email = $1 AND is_active = true`,
      [email.toLowerCase()])

    if (!user || !await bcrypt.compare(password, user.password_hash))
      return res.status(401).json({ error: { message: 'Invalid email or password' } })

    const companies = await getUserCompanies(user.id)

    // Fallback: if junction table has no rows yet, use user.company_id directly
    let activeCompany, activeRole
    if (companies.length > 0) {
      activeCompany = companies.find(c => c.is_default) || companies[0]
      activeRole    = activeCompany.role
    } else {
      const { rows: [co] } = await db.query(
        `SELECT * FROM companies WHERE id = $1`, [user.company_id])
      activeCompany = co
      activeRole    = user.role
    }

    await db.query(`UPDATE users SET last_login = now() WHERE id = $1`, [user.id])

    const token = sign({ id: user.id, company_id: activeCompany.id, role: activeRole, name: user.name })

    res.json({
      token,
      user: {
        id:         user.id,
        name:       user.name,
        email:      user.email,
        role:       activeRole,
        company_id: activeCompany.id,
        company:    activeCompany,
        companies:  companies.map(c => ({ id: c.id, name: c.name, role: c.role })),
      }
    })
  } catch (err) { next(err) }
}

// POST /api/v1/auth/switch-company
exports.switchCompany = async (req, res, next) => {
  try {
    const { company_id } = req.body
    if (!company_id)
      return res.status(400).json({ error: { message: 'company_id required' } })

    // Verify the user actually has access to this company
    const { rows: [uc] } = await db.query(
      `SELECT uc.role, c.id, c.name, c.cr_number, c.vat_number,
              c.default_vat_rate, c.default_currency, c.logo_url, c.logo,
              c.bank_name, c.bank_iban, c.bank_swift
       FROM user_companies uc
       JOIN companies c ON c.id = uc.company_id
       WHERE uc.user_id = $1 AND uc.company_id = $2`,
      [req.user.id, company_id])

    if (!uc)
      return res.status(403).json({ error: { message: 'No access to this company' } })

    const { rows: [user] } = await db.query(
      `SELECT id, name, email FROM users WHERE id = $1`, [req.user.id])

    const token     = sign({ id: user.id, company_id: uc.id, role: uc.role, name: user.name })
    const companies = await getUserCompanies(user.id)

    res.json({
      token,
      user: {
        id:         user.id,
        name:       user.name,
        email:      user.email,
        role:       uc.role,
        company_id: uc.id,
        company:    uc,
        companies:  companies.map(c => ({ id: c.id, name: c.name, role: c.role })),
      }
    })
  } catch (err) { next(err) }
}

// GET /api/v1/auth/me
exports.me = async (req, res, next) => {
  try {
    const { rows: [user] } = await db.query(
      `SELECT u.id, u.name, u.email, u.company_id,
              c.name AS company_name, c.cr_number, c.vat_number
       FROM users u JOIN companies c ON c.id = $2
       WHERE u.id = $1`,
      [req.user.id, req.user.company_id])
    res.json({ data: { ...user, role: req.user.role } })
  } catch (err) { next(err) }
}

// GET /api/v1/auth/users  (admin only — lists users who have access to current company)
exports.listUsers = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, uc.role, u.is_active, u.last_login, u.created_at
       FROM users u
       JOIN user_companies uc ON uc.user_id = u.id AND uc.company_id = $1
       ORDER BY u.name`,
      [req.user.company_id])
    res.json({ data: rows })
  } catch (err) { next(err) }
}

// POST /api/v1/auth/users  (admin only)
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body
    const hash   = await bcrypt.hash(password, 12)
    const userId = uuid()

    const result = await db.withTransaction(async (client) => {
      const { rows: [user] } = await client.query(
        `INSERT INTO users (id, company_id, name, email, password_hash, role)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role`,
        [userId, req.user.company_id, name, email.toLowerCase(), hash, role || 'sales'])
      await client.query(
        `INSERT INTO user_companies (id, user_id, company_id, role, is_default)
         VALUES ($1,$2,$3,$4,true)`,
        [uuid(), userId, req.user.company_id, role || 'sales'])
      return user
    })

    res.status(201).json({ data: result })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: { message: 'Email already in use' } })
    next(err)
  }
}

// PUT /api/v1/auth/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, is_active, password } = req.body

    // Verify target user belongs to this company
    const { rows: [check] } = await db.query(
      `SELECT user_id FROM user_companies WHERE user_id = $1 AND company_id = $2`,
      [req.params.id, req.user.company_id])
    if (!check) return res.status(404).json({ error: { message: 'User not found' } })

    const updates = []
    const params  = []
    if (name      !== undefined) { params.push(name);                  updates.push(`name=$${params.length}`) }
    if (email     !== undefined) { params.push(email.toLowerCase());   updates.push(`email=$${params.length}`) }
    if (is_active !== undefined) { params.push(is_active);             updates.push(`is_active=$${params.length}`) }
    if (password)                { params.push(await bcrypt.hash(password, 12)); updates.push(`password_hash=$${params.length}`) }

    if (updates.length) {
      params.push(req.params.id)
      await db.query(
        `UPDATE users SET ${updates.join(',')} WHERE id=$${params.length}`, params)
    }

    // Update role in user_companies (role is per-company)
    if (role !== undefined) {
      await db.query(
        `UPDATE user_companies SET role=$1 WHERE user_id=$2 AND company_id=$3`,
        [role, req.params.id, req.user.company_id])
    }

    const { rows: [u] } = await db.query(
      `SELECT u.id, u.name, u.email, uc.role, u.is_active
       FROM users u
       JOIN user_companies uc ON uc.user_id = u.id AND uc.company_id = $2
       WHERE u.id = $1`,
      [req.params.id, req.user.company_id])

    res.json({ data: u })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: { message: 'Email already in use' } })
    next(err)
  }
}

// PUT /api/v1/auth/users/:id/password
exports.changePassword = async (req, res, next) => {
  try {
    const { password } = req.body

    // Verify target user belongs to this company
    const { rows: [check] } = await db.query(
      `SELECT user_id FROM user_companies WHERE user_id = $1 AND company_id = $2`,
      [req.params.id, req.user.company_id])
    if (!check) return res.status(404).json({ error: { message: 'User not found' } })

    const hash = await bcrypt.hash(password, 12)
    await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.params.id])
    res.json({ message: 'Password updated' })
  } catch (err) { next(err) }
}
