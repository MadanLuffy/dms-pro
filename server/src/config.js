export function getClientOrigins() {
  const configured = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.replace(/\/+$/, '') : null;
  if (process.env.NODE_ENV === 'production') {
    const list = [configured].filter(Boolean);
    if (!list.length) {
      console.warn(
        '[dms-server] CLIENT_ORIGIN is not set. Browser calls from a named host will be blocked by CORS. Set CLIENT_ORIGIN to your public URL.'
      );
    }
    return list;
  }
  return [...new Set([configured, 'http://localhost:5188', 'http://127.0.0.1:5188'].filter(Boolean))];
}
