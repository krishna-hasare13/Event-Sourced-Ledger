const logger = require('../logger');

function errorHandler(err, req, res, next) {
  const message = err.message || 'Something went wrong';
  const notFound = message.toLowerCase().includes('not found');
  const statusMap = {
    P2002: 409,
    P2025: 404,
    P2023: 400,
    P2014: 400
  };
  const status = err.status || statusMap[err.code] || (notFound ? 404 : 400);

  logger.error({
    requestId: req.requestId,
    status,
    code: err.code || null,
    error: message
  }, 'request failed');

  res.status(status).json({ error: message, requestId: req.requestId });
}

module.exports = errorHandler;