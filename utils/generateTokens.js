const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Builds the minimal JWT payload — id, role, tokenVersion only.
 * No email or other PII in the token.
 */
function buildPayload(user) {
  return {
    id: user._id.toString(),
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

function generateAccessToken(user) {
  return jwt.sign(buildPayload(user), config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

function generateRefreshToken(user) {
  return jwt.sign(buildPayload(user), config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

function generateTokens(user) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
}

module.exports = { generateTokens, generateAccessToken, generateRefreshToken };
