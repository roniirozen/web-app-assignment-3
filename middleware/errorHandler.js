function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  res.removeHeader('X-Stage-Correct');
  let status = 500;
  let message = 'An unexpected server error occurred.';
  if (error.type === 'entity.parse.failed') {
    status = 400; message = 'The request body contains malformed JSON.';
  } else if (error.type === 'entity.too.large') {
    status = 413; message = 'The request body exceeds the 16 KB limit.';
  } else if (error instanceof URIError) {
    status = 400; message = 'The request path contains invalid URL encoding.';
  } else if (error.status >= 400 && error.status < 500) {
    status = error.status; message = 'The request could not be processed.';
  }
  if (status === 500) console.error(error);
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    return res.status(status).json({ message, ...(req.get('X-Stage-Id') ? { stageCorrect: false } : {}) });
  }
  return res.status(status).render('error', { title: 'Something went wrong', status, message });
}

module.exports = errorHandler;
