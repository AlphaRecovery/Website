const buckets = new Map();

function clientKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

export function createRateLimiter({ windowMs, max, keyPrefix = 'global', methods = null, message = 'Too many requests. Please try again shortly.' }) {
  return (req, res, next) => {
    if (methods && !methods.includes(req.method)) return next();

    const now = Date.now();
    const key = `${keyPrefix}:${clientKey(req)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }

    next();
  };
}
