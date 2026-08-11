function errorHandler(err, req, res, next) {
  console.error(err.message || err);

  const message = err.message || 'Something went wrong';
  const notFound = message.toLowerCase().includes('not found');
  const statusMap = {
    P2002: 409,
    P2025: 404,
    P2023: 400,
    P2014: 400
  };
  const status = statusMap[err.code] || (notFound ? 404 : 400);

  res.status(status).json({ error: message });
}

module.exports = errorHandler;