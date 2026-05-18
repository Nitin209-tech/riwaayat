const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cyber-riwaayat-premium-jwt-super-secret-key-256-change-me-in-production';

/**
 * Validate JWT sessions and bind user payload to request.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.eiq_token;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Session expired or corrupted' });
    }
    req.user = user;
    next();
  });
}

/**
 * RBAC Role Check Guards
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'System alert: Access tier restricted'
      });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRoles };
