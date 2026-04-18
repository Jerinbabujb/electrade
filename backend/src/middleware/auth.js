const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  // Allow token in query string for browser-navigated requests (PDF, print)
  const raw = header?.startsWith('Bearer ') ? header.split(' ')[1] : req.query.token;
  if (!raw) {
    return res.status(401).json({ error: { message: 'No token provided' } });
  }
  try {
    req.user = jwt.verify(raw, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }
};

// Role guard factory — usage: authorize('admin','accountant')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: { message: 'Insufficient permissions' } });
  }
  next();
};

module.exports = { authenticate, authorize };
