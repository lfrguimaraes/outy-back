
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

/**
 * Optional authentication middleware
 * Tries to authenticate if token is present, but doesn't fail if token is missing
 * Sets req.user if authentication succeeds, otherwise leaves it undefined
 */
const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    // No token provided, continue as guest
    req.user = undefined;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (err) {
    // Invalid token, continue as guest
    req.user = undefined;
    next();
  }
};

module.exports = { protect, optionalAuth };

