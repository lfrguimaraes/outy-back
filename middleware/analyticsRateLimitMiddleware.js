const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for analytics events
 * Limit: 100 events per minute per deviceId
 * Uses deviceId from request body for rate limiting
 */
const analyticsRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 events per minute
  keyGenerator: (req) => {
    // Extract deviceId from request body (first event's deviceId)
    // Note: This requires body parsing to happen before rate limiting
    try {
      const events = req.body;
      if (Array.isArray(events) && events.length > 0 && events[0]?.deviceId) {
        return `analytics:device:${events[0].deviceId}`;
      }
    } catch (err) {
      // Body not parsed yet or invalid, fall through to IP-based limiting
    }
    // Fallback to IP if deviceId not available
    return `analytics:ip:${req.ip || req.connection?.remoteAddress || 'unknown'}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = new Date(Date.now() + 60 * 1000);
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    res.status(429)
      .set('Retry-After', retryAfter.toString())
      .json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryAfter
      });
  },
  // Skip rate limiting if we can't determine deviceId (shouldn't happen in normal flow)
  skip: (req) => {
    const events = req.body;
    return !Array.isArray(events) || events.length === 0;
  }
});

module.exports = { analyticsRateLimiter };

