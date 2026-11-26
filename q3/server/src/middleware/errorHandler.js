function errorHandler(error, req, res, next) {
  console.error(error);
  if (res.headersSent) return next(error);
  if (error.code === 11000) {
    return res.status(409).json({ message: 'A record with that value already exists.' });
  }
  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError' || error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'The request contains invalid data.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'The request body is too large.' });
  }
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
}

module.exports = errorHandler;
