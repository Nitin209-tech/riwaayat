const memoryCache = new Map();

/**
 * Double-layered IP/Session Rate Limiter middleware.
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60000, // 1 minute window
    max = 5,          // limit each IP to 5 requests per windowMs
    message = 'Too many requests from this source. Please decelerate.'
  } = options;

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!memoryCache.has(ip)) {
      memoryCache.set(ip, []);
    }

    const timestamps = memoryCache.get(ip);
    // Filter out expired timestamps
    const activeTimestamps = timestamps.filter(t => now - t < windowMs);
    
    if (activeTimestamps.length >= max) {
      return res.status(429).json({
        success: false,
        error: message,
        cooldownRemaining: Math.ceil((windowMs - (now - activeTimestamps[0])) / 1000)
      });
    }

    activeTimestamps.push(now);
    memoryCache.set(ip, activeTimestamps);
    next();
  };
}

module.exports = {
  globalLimit: createRateLimiter({ windowMs: 60000, max: 60, message: 'Global rate limit reached.' }),
  redeemLimit: createRateLimiter({ windowMs: 60000, max: 3, message: 'Redemption limit reached (3 claims/min max). Cooldown active.' }),
  authLimit: createRateLimiter({ windowMs: 60000, max: 5, message: 'Authentication attempts limited. Try again later.' })
};
