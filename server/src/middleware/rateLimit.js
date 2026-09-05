const buckets = new Map();

function prune(now) {
  if (buckets.size < 2000) return;
  for (const [key, timestamps] of buckets) {
    if (!timestamps.length || now - timestamps[timestamps.length - 1] > 60 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}

/**
 * In-memory sliding window. For multi-instance production, set RATE_LIMIT_STORE=redis
 * and put a shared store in front (see DEPLOY.md). Memory is correct for a single Node process.
 */
export function rateLimit({ windowMs, max, name = 'api', keyFn } = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  const resolvedMax = max ?? (isProd ? 300 : 1000);
  const resolvedWindow = windowMs ?? 60 * 1000;

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${name}:${keyFn ? keyFn(req) : ip}`;
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((t) => now - t < resolvedWindow);
    if (recent.length >= resolvedMax) {
      res.setHeader('Retry-After', String(Math.ceil(resolvedWindow / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please wait and try again.' });
    }
    recent.push(now);
    buckets.set(key, recent);
    prune(now);
    next();
  };
}

export const loginRateLimit = rateLimit({
  name: 'login',
  windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 30,
});

export const apiRateLimit = rateLimit({
  name: 'api',
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 1200,
});

export const uploadRateLimit = rateLimit({
  name: 'upload',
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 40 : 120,
});
