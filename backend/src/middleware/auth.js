const jwt = require('jsonwebtoken');
const db  = require('../db');

// ── In-process membership cache ───────────────────────────────────────────────
// Avoids a DB round-trip on every authenticated request for the common case
// where the user's membership hasn't changed.  TTL = 30 s.  Invalidated
// explicitly whenever role or membership changes (see invalidateAuthCache).
const _authCache = new Map()  // key: 'userId:companyId' → { role, token_version, expiresAt }
const AUTH_CACHE_TTL = 30_000 // ms

function _getCached(userId, companyId) {
  const entry = _authCache.get(`${userId}:${companyId}`)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { _authCache.delete(`${userId}:${companyId}`); return null }
  return entry
}

function _setCached(userId, companyId, role, token_version) {
  _authCache.set(`${userId}:${companyId}`, { role, token_version, expiresAt: Date.now() + AUTH_CACHE_TTL })
}

// Exported so other modules (user management, company routes) can evict stale entries
function invalidateAuthCache(userId, companyId) {
  if (companyId) {
    _authCache.delete(`${userId}:${companyId}`)
  } else {
    for (const key of _authCache.keys()) {
      if (key.startsWith(`${userId}:`)) _authCache.delete(key)
    }
  }
}

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

  // Re-verify company membership and token_version — uses a 30 s in-process
  // cache to avoid a DB hit on every request while still catching revocations
  // and force-logouts promptly.
  try {
    let cached = _getCached(req.user.id, req.user.company_id)
    if (cached === null) {
      const { rows: [uc] } = await db.query(
        `SELECT uc.role, u.token_version
         FROM user_companies uc
         JOIN users u ON u.id = uc.user_id
         WHERE uc.user_id=$1 AND uc.company_id=$2`,
        [req.user.id, req.user.company_id]);
      if (!uc) {
        return res.status(401).json({ error: { message: 'Access to this company has been revoked' } });
      }
      cached = { role: uc.role, token_version: uc.token_version }
      _setCached(req.user.id, req.user.company_id, uc.role, uc.token_version)
    }
    // If token_version in JWT is behind the DB value, the user has been force-logged out
    const jwtVersion = req.user.token_version ?? 0
    if (jwtVersion < cached.token_version) {
      return res.status(401).json({ error: { message: 'Session has been terminated' } });
    }
    req.user.role = cached.role;
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

module.exports = { authenticate, authorize, invalidateAuthCache };
