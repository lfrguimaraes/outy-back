/**
 * Middleware to validate X-App-ID header
 * Required for all API requests to ensure requests come from the official app
 */
const validateAppId = (req, res, next) => {
  const appId = req.headers['x-app-id'];
  const expectedAppId = 'outy-ios-app-2025';

  if (!appId || appId !== expectedAppId) {
    return res.status(401).json({
      error: 'Invalid or missing app identifier',
      code: 'INVALID_APP_ID'
    });
  }

  next();
};

module.exports = { validateAppId };


