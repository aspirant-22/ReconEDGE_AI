/**
 * Lightweight in-memory rate limiter for AI endpoints (hackathon/demo-suitable).
 *
 * Suitable for a single-instance demo deployment. It is NOT a distributed
 * limiter and resets on process restart. It protects against abusive/accidental
 * repeated AI (Gemini) requests that incur API usage.
 *
 * When a client exceeds the window limit it receives HTTP 429.
 */
function createRateLimiter({ windowMs = 60000, max = 20, keyPrefix = 'rl' } = {}) {
  const buckets = new Map();

  function getKey(req) {
    const id = req.user && req.user._id ? req.user._id.toString() : req.ip;
    return `${keyPrefix}:${id}`;
  }

  function cleanup(now) {
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    cleanup(now);

    const key = getKey(req);
    const entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
      });
    }

    entry.count += 1;
    return next();
  };
}

function createAILimiter() {
  return createRateLimiter({
    windowMs: 60000,
    max: 20,
    keyPrefix: 'ai',
  });
}

module.exports = { createRateLimiter, createAILimiter };
