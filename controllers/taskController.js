const Task = require('../models/Task');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const MAX_LIMIT = 100;

function ownershipGuard(task, req) {
  if (req.user.role === 'admin') return;
  if (task.owner.toString() !== req.user.id) {
    throw new AppError('You do not have permission to perform this action', 403);
  }
}

// GET /api/tasks
const getAllTasks = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  // Admins see all tasks; regular users see only their own
  const filter = req.user.role === 'admin' ? {} : { owner: req.user.id };

  const [tasks, total] = await Promise.all([
    Task.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Task.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

// GET /api/tasks/:id
const getTaskById = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  ownershipGuard(task, req);

  res.status(200).json({ status: 'success', data: { task } });
});

// POST /api/tasks
const createTask = asyncHandler(async (req, res) => {
  const { title, description, completed } = req.body;

  if (typeof title !== 'string' || title.trim() === '') {
    throw new AppError('Title is required and must be a non-empty string', 400);
  }
  if (completed !== undefined && typeof completed !== 'boolean') {
    throw new AppError('completed must be a boolean', 400);
  }

  const task = await Task.create({
    title: title.trim(),
    description: description?.trim() ?? '',
    completed: completed ?? false,
    owner: req.user.id,
  });

  res.status(201).json({ status: 'success', data: { task } });
});

// Shared logic for PATCH and PUT
async function applyUpdate(req, res, isPut) {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  ownershipGuard(task, req);

  const { title, description, completed } = req.body;

  if (isPut) {
    // PUT: full replacement — all fields required
    if (typeof title !== 'string' || title.trim() === '') {
      throw new AppError('Title is required for full replacement', 400);
    }
    if (completed !== undefined && typeof completed !== 'boolean') {
      throw new AppError('completed must be a boolean', 400);
    }
    task.title = title.trim();
    task.description = description?.trim() ?? '';
    task.completed = completed ?? false;
  } else {
    // PATCH: partial update — at least one field required
    const partial = {};
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        throw new AppError('title must be a non-empty string', 400);
      }
      partial.title = title.trim();
    }
    if (description !== undefined) partial.description = description.trim();
    if (completed !== undefined) {
      if (typeof completed !== 'boolean') {
        throw new AppError('completed must be a boolean', 400);
      }
      partial.completed = completed;
    }
    if (Object.keys(partial).length === 0) {
      throw new AppError('Provide at least one field to update: title, description, completed', 400);
    }
    Object.assign(task, partial);
  }

  await task.save();
  res.status(200).json({ status: 'success', data: { task } });
}

// PATCH /api/tasks/:id
const patchTask = asyncHandler((req, res) => applyUpdate(req, res, false));

// PUT /api/tasks/:id
const putTask = asyncHandler((req, res) => applyUpdate(req, res, true));

// DELETE /api/tasks/:id
const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  ownershipGuard(task, req);

  await task.deleteOne();
  res.status(204).end();
});

module.exports = { getAllTasks, getTaskById, createTask, patchTask, putTask, deleteTask };
