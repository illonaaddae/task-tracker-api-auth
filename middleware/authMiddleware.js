const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config/env');

const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('No token provided', 401);
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Token has expired', 401);
    }
    throw new AppError('Invalid token', 401);
  }

  const user = await User.findById(payload.id);
  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  // Token was issued before the last logout — treat as invalid
  if (payload.tokenVersion !== user.tokenVersion) {
    throw new AppError('Token has been revoked', 401);
  }

  req.user = { id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion };
  next();
});

module.exports = authMiddleware;
