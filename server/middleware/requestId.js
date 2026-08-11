const { randomUUID } = require('crypto');

function requestIdMiddleware(req, res, next) {
  const incoming = req.get('x-request-id');
  req.requestId = incoming && incoming.trim() ? incoming.trim() : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

module.exports = requestIdMiddleware;