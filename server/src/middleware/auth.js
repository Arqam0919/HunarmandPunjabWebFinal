const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.get('authorization');
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Sign in is required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      !['organizer', 'customer'].includes(payload.role)
    ) {
      return res.status(401).json({ message: 'Your session is invalid or has expired.' });
    }
    req.user = { _id: payload.sub, role: payload.role, name: payload.name };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Your session is invalid or has expired.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Sign in is required.' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ message: `${role} access is required.` });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };
