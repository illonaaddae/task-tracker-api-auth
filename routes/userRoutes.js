const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { listUsers, getMe, updateMe } = require('../controllers/userController');

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile management — /me for self; / for admins only
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Requires **admin** role. Password and token fields are never returned.
 *     responses:
 *       200:
 *         description: Array of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Authenticated but not an admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', roleMiddleware('admin'), listUsers);

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get the current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user's profile (no password)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/me', getMe);

/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Update the current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Allows updating `name` and/or `email`. Password changes must go through
 *       `/auth/reset-password`. Role changes are blocked (403).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Alice Updated
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice.new@example.com
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Validation error or attempt to change password via this route
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Attempt to change role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/me', updateMe);

module.exports = router;
