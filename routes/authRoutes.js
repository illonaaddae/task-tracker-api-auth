const express = require('express');
const router = express.Router();
const {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { strictLimiter } = require('../middleware/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Registration, login, token refresh, and password management
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Alice
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: s3cr3tPass
 *     responses:
 *       201:
 *         description: User created — returns user (no password) + access/refresh tokens
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
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Too many registration attempts (5/min)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/register', strictLimiter, register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in and obtain tokens
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *               password:
 *                 type: string
 *                 example: s3cr3tPass
 *     responses:
 *       200:
 *         description: Login successful
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
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       401:
 *         description: Invalid credentials (generic — never reveals which field was wrong)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Too many login attempts (5/min)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/login', strictLimiter, login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Rotate refresh token and obtain a new access token
 *     tags: [Auth]
 *     description: >
 *       Verifies the refresh token signature and tokenVersion, then rotates the token
 *       (old refresh token is invalidated). Returns a fresh access + refresh token pair.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New token pair issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { $ref: '#/components/schemas/Tokens' }
 *       400:
 *         description: refreshToken field missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Invalid, expired, or already-rotated refresh token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Invalidate all tokens for the current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     description: >
 *       Bumps tokenVersion on the user — all outstanding access and refresh tokens
 *       issued before this call are immediately rejected.
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data: { type: object, nullable: true }
 *       401:
 *         description: Missing or invalid access token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/logout', authMiddleware, logout);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     tags: [Auth]
 *     description: >
 *       Generates a time-limited (10 min) reset token, stores its SHA-256 hash on
 *       the user, and logs the plain token as a stub email. Always returns 200
 *       regardless of whether the email is registered (prevents user enumeration).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@example.com
 *     responses:
 *       200:
 *         description: Reset link sent (or silently ignored if email unknown)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *       400:
 *         description: Email field missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Too many attempts (5/min)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/forgot-password', strictLimiter, forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using a token from forgot-password
 *     tags: [Auth]
 *     description: >
 *       Hashes the incoming token and looks up a user whose stored hash matches
 *       and whose expiry is in the future. Sets the new password, clears the token
 *       fields (single-use), and bumps tokenVersion to invalidate all existing sessions.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Plain token from the reset link
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: newS3cr3t!
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *       400:
 *         description: Missing fields, short password, or invalid/expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Too many attempts (5/min)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/reset-password', strictLimiter, resetPassword);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email address using token issued at registration
 *     tags: [Auth]
 *     description: >
 *       Token is valid for 24 hours and single-use. Sets isVerified = true and
 *       clears both token fields on success.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Plain token from the verification link
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *       400:
 *         description: Missing token or invalid/expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/verify-email', verifyEmail);

module.exports = router;
