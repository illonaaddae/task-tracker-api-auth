const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/users — admin only
const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find();
  res.status(200).json({ status: 'success', data: { users } });
});

// GET /api/users/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);
  res.status(200).json({ status: 'success', data: { user } });
});

// PATCH /api/users/me
const updateMe = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  const updates = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new AppError('name must be a non-empty string', 400);
    }
    updates.name = name.trim();
  }
  if (email !== undefined) {
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new AppError('email must be a valid email address', 400);
    }
    updates.email = email.toLowerCase().trim();
  }

  // Block password changes through this route — use /auth/reset-password instead
  if (req.body.password !== undefined) {
    throw new AppError('Use /auth/reset-password to change your password', 400);
  }
  // Block role self-escalation
  if (req.body.role !== undefined) {
    throw new AppError('You cannot change your own role', 403);
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('Provide at least one field to update: name, email', 400);
  }

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new AppError('User not found', 404);

  res.status(200).json({ status: 'success', data: { user } });
});

module.exports = { listUsers, getMe, updateMe };
