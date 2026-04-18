const jwt = require('jsonwebtoken');
const db  = require('../db');

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  // Allow token in query string for browser-navigated requests (PDF, print)
  const raw = header?.startsWith('Bearer ') ? header.split(' ')[1] : req.query.token;
  if (!raw) {
    return res.status(401).json({ error: { message: 'No token provided' } });
  }
  try {
    req.user = jwt.verify(raw, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }

  // Re-verify company membership on every request so that a revoked user
  // cannot continue using a still-valid JWT after being removed from a company.
  try {
    const { rows: [uc] } = await db.query(
      `SELECT role FROM user_companies WHERE user_id=$1 AND company_id=$2`,
      [req.user.id, req.user.company_id]);
    if (!uc) {
      return res.status(401).json({ error: { message: 'Access to this company has been revoked' } });
    }
    // Always use the DB role (not the JWT role) so role changes take effect immediately
    req.user.role = uc.role;
  } catch (err) {
    return next(err);
  }

  next();
};

// Role guard factory — usage: authorize('admin','accountant')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: { message: 'Insufficient permissions' } });
  }
  next();
};

module.exports = { authenticate, authorize };
