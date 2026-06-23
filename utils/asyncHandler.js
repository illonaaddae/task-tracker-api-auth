/**
 * Wraps an async route handler so rejected promises reach the Express error handler.
 * Eliminates try/catch boilerplate in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
