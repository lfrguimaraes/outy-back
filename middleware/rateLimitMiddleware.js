const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for guest users (no authentication token)
 * Limit: 100 requests per IP per 15 minutes
 */
const guestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    const resetTime = new Date(Date.now() + 15 * 60 * 1000);
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    res.status(429)
      .set('Retry-After', retryAfter.toString())
      .json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryAfter
      });
  },
  // Use IP address as key for guest users
  keyGenerator: (req) => {
    // Get IP address, considering proxy headers
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
           'unknown';
  }
});

/**
 * Rate limiter for authenticated users
 * Limit: 500 requests per token per 15 minutes
 */
const authenticatedRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window
  message: {
    error: 'Rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = new Date(Date.now() + 15 * 60 * 1000);
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    
    res.status(429)
      .set('Retry-After', retryAfter.toString())
      .json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: retryAfter
      });
  },
  // Use user token as key for authenticated users
  keyGenerator: (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    return token || req.user?._id?.toString() || 'unknown';
  }
});

/**
 * Smart rate limiter that applies different limits based on authentication status
 */
const smartRateLimiter = (req, res, next) => {
  // Check if user is authenticated
  const token = req.headers.authorization?.split(' ')[1];
  const isAuthenticated = !!token && !!req.user;

  if (isAuthenticated) {
    // Use authenticated rate limiter
    return authenticatedRateLimiter(req, res, next);
  } else {
    // Use guest rate limiter
    return guestRateLimiter(req, res, next);
  }
};

module.exports = {
  guestRateLimiter,
  authenticatedRateLimiter,
  smartRateLimiter
};


