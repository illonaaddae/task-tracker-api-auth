const AppError = require('../utils/AppError');

/**
 * Factory — returns middleware that allows only the listed roles.
 * Must run after authMiddleware (req.user must exist).
 *
 * Usage: router.delete('/:id', authMiddleware, roleMiddleware('admin'), handler)
 */
const roleMiddleware = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};

module.exports = roleMiddleware;
