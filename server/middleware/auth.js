const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', requestId: req.requestId });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-secret');
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', requestId: req.requestId });
  }
}

module.exports = authMiddleware;