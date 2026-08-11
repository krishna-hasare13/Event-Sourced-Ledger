function createValidationMiddleware(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const message = result.error.issues.map(issue => issue.message).join('; ');
      const error = new Error(message);
      error.status = 400;
      error.code = 'BAD_REQUEST';
      return next(error);
    }

    req[target] = result.data;
    return next();
  };
}

module.exports = { createValidationMiddleware };