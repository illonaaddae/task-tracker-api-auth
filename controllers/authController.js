const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { generateTokens } = require('../utils/generateTokens');
const config = require('../config/env');

// ── Validation rule sets ────────────────────────────────────────────────────

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const resetPasswordRules = [
  body('token').notEmpty().withMessage('token is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function validationGuard(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }
}

/**
 * Generates a plain random token + its SHA-256 hash.
 * Store only the hash; send only the plain token to the user.
 */
function makeToken() {
  const plain = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(plain).digest('hex');
  return { plain, hashed };
}

// ── Controllers ─────────────────────────────────────────────────────────────

const register = [
  ...registerRules,
  asyncHandler(async (req, res) => {
    validationGuard(req);

    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) throw new AppError('Email already registered', 409);

    const { plain, hashed } = makeToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    const user = await User.create({
      name,
      email,
      password,
      emailVerificationToken: hashed,
      emailVerificationExpires: expiry,
    });

    // Stub: replace with real mailer in production
    console.log(`[AUTH] Verify email link (stub): POST /auth/verify-email  { "token": "${plain}" }`);

    const tokens = generateTokens(user);

    res.status(201).json({ status: 'success', data: { user, ...tokens } });
  }),
];

const login = [
  ...loginRules,
  asyncHandler(async (req, res) => {
    validationGuard(req);

    const { email, password } = req.body;

    // select:false on password — must request it explicitly
    const user = await User.findOne({ email }).select('+password');

    const valid = user && (await user.comparePassword(password));
    if (!valid) {
      // Log server-side only — safe to record the email in server logs
      console.warn(`[AUTH] Failed login attempt for: ${email}`);
      // Generic client message — never reveal whether email or password was wrong
      throw new AppError('Invalid credentials', 401);
    }

    console.log(`[AUTH] Login: ${user.email} (id: ${user._id})`);

    const tokens = generateTokens(user);

    res.status(200).json({ status: 'success', data: { user, ...tokens } });
  }),
];

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token is required', 400);

  let payload;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(payload.id);
  if (!user) throw new AppError('Invalid or expired refresh token', 401);

  // Reject tokens issued before the last logout
  if (payload.tokenVersion !== user.tokenVersion) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // Rotate: bump version so consumed refresh token can never be reused.
  // Side effect: the prior access token is also immediately rejected.
  // Callers must use the new access token returned here.
  user.tokenVersion += 1;
  await user.save({ validateModifiedOnly: true });

  res.status(200).json({ status: 'success', data: generateTokens(user) });
});

const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { $inc: { tokenVersion: 1 } });
  console.log(`[AUTH] Logout: user ${req.user.id}`);
  res.status(200).json({ status: 'success', data: null });
});

// POST /auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError('Email is required', 400);

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  // Always respond success — never confirm whether the email exists
  if (!user) {
    return res.status(200).json({
      status: 'success',
      data: { message: 'If that email is registered you will receive a reset link' },
    });
  }

  const { plain, hashed } = makeToken();

  user.passwordResetToken = hashed;
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await user.save({ validateModifiedOnly: true });

  // Stub: replace with real mailer in production
  console.log(`[AUTH] Password reset link (stub): POST /auth/reset-password  { "token": "${plain}", "password": "<new>" }`);

  res.status(200).json({
    status: 'success',
    data: { message: 'If that email is registered you will receive a reset link' },
  });
});

// POST /auth/reset-password
const resetPassword = [
  ...resetPasswordRules,
  asyncHandler(async (req, res) => {
    validationGuard(req);

    const { token, password } = req.body;
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+password');

    if (!user) throw new AppError('Invalid or expired reset token', 400);

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // Invalidate all existing sessions — forces re-login after reset
    user.tokenVersion += 1;
    await user.save();

    res.status(200).json({ status: 'success', data: { message: 'Password reset successful' } });
  }),
];

// POST /auth/verify-email
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw new AppError('token is required', 400);

  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: Date.now() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) throw new AppError('Invalid or expired verification token', 400);

  user.isVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateModifiedOnly: true });

  res.status(200).json({ status: 'success', data: { message: 'Email verified successfully' } });
});

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword, verifyEmail };
