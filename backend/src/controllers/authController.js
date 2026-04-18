const db      = require('../db')
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const { v4: uuid } = require('uuid')

const sign = (user) => jwt.sign(
  { id: user.id, company_id: user.company_id, role: user.role, name: user.name },
  process.env.JWT_SECRET,
  { expiresIn: '12h' }
)

// POST /api/v1/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: { message: 'Email and password required' } })

    const { rows: [user] } = await db.query(
      `SELECT u.*, c.name AS company_name, c.cr_number, c.vat_number,
              c.default_vat_rate, c.default_currency, c.logo_url,
              c.bank_name, c.bank_iban, c.bank_swift
       FROM users u JOIN companies c ON c.id = u.company_id
       WHERE u.email = $1 AND u.is_active = true`, [email.toLowerCase()])

    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: { message: 'Invalid email or password' } })
    }

    await db.query(`UPDATE users SET last_login = now() WHERE id = $1`, [user.id])

    const token = sign(user)
    const { password_hash, ...safe } = user

    res.json({
      token,
      user: {
        id:         safe.id,
        name:       safe.name,
        email:      safe.email,
        role:       safe.role,
        company_id: safe.company_id,
        company: {
          id:               safe.company_id,
          name:             safe.company_name,
          cr_number:        safe.cr_number,
          vat_number:       safe.vat_number,
          default_vat_rate: safe.default_vat_rate,
          default_currency: safe.default_currency,
          logo_url:         safe.logo_url,
          bank_name:        safe.bank_name,
          bank_iban:        safe.bank_iban,
          bank_swift:       safe.bank_swift,
        }
      }
    })
  } catch (err) { next(err) }
}

// GET /api/v1/auth/me
exports.me = async (req, res, next) => {
  try {
    const { rows: [user] } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.company_id,
              c.name AS company_name, c.cr_number, c.vat_number
       FROM users u JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1`, [req.user.id])
    res.json({ data: user })
  } catch (err) { next(err) }
}

// GET /api/v1/auth/users  (admin only)
exports.listUsers = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, role, is_active, last_login, created_at
       FROM users WHERE company_id = $1 ORDER BY name`, [req.user.company_id])
    res.json({ data: rows })
  } catch (err) { next(err) }
}

// POST /api/v1/auth/users  (admin only)
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body
    const hash = await bcrypt.hash(password, 12)
    const { rows: [user] } = await db.query(
      `INSERT INTO users (id, company_id, name, email, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role`,
      [uuid(), req.user.company_id, name, email.toLowerCase(), hash, role || 'sales'])
    res.status(201).json({ data: user })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: { message: 'Email already in use' } })
    next(err)
  }
}

// PUT /api/v1/auth/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, is_active, password } = req.body
    const updates = []
    const params  = []
    if (name      !== undefined) { params.push(name);                  updates.push(`name=$${params.length}`) }
    if (email     !== undefined) { params.push(email.toLowerCase());   updates.push(`email=$${params.length}`) }
    if (role      !== undefined) { params.push(role);                  updates.push(`role=$${params.length}`) }
    if (is_active !== undefined) { params.push(is_active);             updates.push(`is_active=$${params.length}`) }
    if (password)                { params.push(await bcrypt.hash(password, 12)); updates.push(`password_hash=$${params.length}`) }
    if (!updates.length) return res.status(400).json({ error: { message: 'Nothing to update' } })
    params.push(req.params.id, req.user.company_id)
    const { rows: [u] } = await db.query(
      `UPDATE users SET ${updates.join(',')} WHERE id=$${params.length-1} AND company_id=$${params.length} RETURNING id,name,email,role,is_active`,
      params)
    if (!u) return res.status(404).json({ error: { message: 'User not found' } })
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
    const hash = await bcrypt.hash(password, 12)
    await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 AND company_id = $3`,
      [hash, req.params.id, req.user.company_id])
    res.json({ message: 'Password updated' })
  } catch (err) { next(err) }
}
