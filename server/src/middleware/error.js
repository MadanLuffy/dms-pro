export function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

export function errorHandler(err, req, res, _next) {
  if (err?.name === 'MulterError' || err?.message === 'Unsupported file type') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 25 MB)' : err.message;
    return res.status(400).json({ error: message });
  }

  console.error('[dms-server]', err);
  const status = err.status || err.statusCode || 500;
  let message = err.expose !== false ? (err.message || 'Internal server error') : 'Internal server error';
  if (status >= 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal server error';
  }
  res.status(status).json({ error: message });
}