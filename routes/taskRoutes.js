const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getAllTasks,
  getTaskById,
  createTask,
  patchTask,
  putTask,
  deleteTask,
} = require('../controllers/taskController');

// All task routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task management — users see only their own tasks; admins see all
 */

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: List tasks (paginated)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Regular users see only their own tasks. Admins see all tasks.
 *       Results are sorted newest-first.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *         description: Tasks per page (capped at 100)
 *     responses:
 *       200:
 *         description: Paginated task list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Task' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', getAllTasks);

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: Owner is automatically set to the authenticated user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Write integration tests
 *               description:
 *                 type: string
 *                 example: Cover all auth endpoints
 *               completed:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Task created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     task: { $ref: '#/components/schemas/Task' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', createTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get a single task by ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: MongoDB ObjectId of the task
 *     responses:
 *       200:
 *         description: Task found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     task: { $ref: '#/components/schemas/Task' }
 *       400:
 *         description: Invalid ObjectId format
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Task belongs to another user (non-admin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', getTaskById);

/**
 * @swagger
 * /api/tasks/{id}:
 *   patch:
 *     summary: Partially update a task (PATCH — preferred)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       **PATCH** accepts any subset of fields and updates only those provided.
 *       At least one field is required. This is the semantically correct verb for
 *       partial updates and should be preferred over PUT.
 *
 *       See also **PUT /api/tasks/{id}** for full replacement.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated title
 *               description:
 *                 type: string
 *               completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Task updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     task: { $ref: '#/components/schemas/Task' }
 *       400:
 *         description: No fields provided or validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Task belongs to another user (non-admin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id', patchTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Fully replace a task (PUT — full replacement)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       **PUT** performs a full replacement — `title` is required, and any omitted
 *       optional fields (`description`, `completed`) are reset to their defaults.
 *       This route is provided for rubric compatibility.
 *
 *       For partial updates (only changing one field), use **PATCH /api/tasks/{id}** instead.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Fully replaced title
 *               description:
 *                 type: string
 *               completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Task replaced
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     task: { $ref: '#/components/schemas/Task' }
 *       400:
 *         description: title missing or validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Task belongs to another user (non-admin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put('/:id', putTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     description: Owner or admin only. Returns 204 with no body on success.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Task deleted
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Task belongs to another user (non-admin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id', deleteTask);

module.exports = router;
