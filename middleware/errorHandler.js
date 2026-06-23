const config = require('../config/env');

/**
 * Normalize known third-party errors into { statusCode, message, isOperational }
 * so the generic handler below can treat them uniformly.
 */
function normalizeError(err) {
  // Mongoose — invalid ObjectId (e.g. /api/tasks/not-an-id)
  if (err.name === 'CastError') {
    return { statusCode: 400, message: `Invalid value for field '${err.path}': ${err.value}`, isOperational: true };
  }

  // Mongoose — unique index violation
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return { statusCode: 409, message: `${field} already exists`, isOperational: true };
  }

  // Mongoose — schema validation failure
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return { statusCode: 400, message, isOperational: true };
  }

  // JWT — signature invalid or malformed
  if (err.name === 'JsonWebTokenError') {
    return { statusCode: 401, message: 'Invalid token', isOperational: true };
  }

  // JWT — token expired (separate from invalid so callers can distinguish)
  if (err.name === 'TokenExpiredError') {
    return { statusCode: 401, message: 'Token has expired', isOperational: true };
  }

  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);

  const statusCode = normalized?.statusCode ?? (typeof err.statusCode === 'number' ? err.statusCode : 500);
  const isOperational = normalized?.isOperational ?? err.isOperational ?? false;
  const rawMessage = normalized?.message ?? err.message ?? 'Internal server error';

  // Always log — full stack for unexpected errors
  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} → ${statusCode}`);
    console.error(err.stack || err);
  } else {
    console.error(`[ERROR] ${statusCode} ${rawMessage}`);
  }

  // In production never leak internals for unhandled 500s
  const message = isOperational || statusCode < 500 ? rawMessage : 'Internal server error';

  res.status(statusCode).json({ status: 'error', message });
}

module.exports = errorHandler;
