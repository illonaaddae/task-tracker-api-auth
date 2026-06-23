# CLAUDE.md — Task Tracker with Authentication (FEM32 / Lab 03)

This file guides Claude Code while extending the existing Task Tracker API with
authentication, authorization, and security hardening. Follow it exactly.

## Goal

Secure the existing Task Tracker API so that:

- Only registered users can log in and manage tasks.
- Users manage only their **own** tasks.
- Admins can manage **all** users and tasks.

Build on the current codebase — do **not** scaffold a new project.

## Stack & key decisions

- **Runtime:** Node.js + Express (existing).
- **Database:** MongoDB via Mongoose (existing Task Tracker DB).
- **Password hashing:** `bcrypt` (cost factor 12). If native build issues appear, fall back to `bcryptjs` — keep the same API.
- **Tokens:** `jsonwebtoken`. Short-lived access token (`JWT_EXPIRES_IN=1h`) + long-lived refresh token (`JWT_REFRESH_EXPIRES_IN=7d`).
- **Validation:** existing validator (keep what Lab 2 used — e.g. `express-validator` or `zod`). Validate every request body.
- **Security middleware:** `helmet`, `express-rate-limit`, `cors`.
- **Docs:** `swagger-jsdoc` + `swagger-ui-express` served at `/api-docs`.

## Project structure (MVC — extend, don't rename)

```
config/        db.js, env.js (env validation), swagger.js
controllers/   authController.js, taskController.js, userController.js
middleware/    authMiddleware.js, roleMiddleware.js, errorHandler.js, rateLimiter.js
models/        User.js, Task.js
routes/        authRoutes.js, taskRoutes.js, userRoutes.js
utils/         AppError.js, generateTokens.js, asyncHandler.js
server.js
```

## Data models

**User**

| Field    | Type   | Rules                                              |
|----------|--------|----------------------------------------------------|
| name     | String | required, trimmed                                  |
| email    | String | required, unique, lowercase, valid email           |
| password | String | required, min length, hashed, `select: false`      |
| role     | String | enum `["user","admin"]`, default `"user"`          |

- Hash password in a Mongoose `pre("save")` hook **only when modified**.
- Add a `comparePassword(candidate)` instance method.
- Never return `password` in any response (use `select: false` + strip in `toJSON`).

**Task** — add an `owner` field: `ObjectId` ref `User`, required, indexed. Every
task created is stamped with `owner = req.user.id`.

## Auth conventions

- Routes: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.
- Register: validate, reject duplicate email (409), hash, return user (no password) + tokens.
- Login: verify credentials with `comparePassword`; on failure return a **generic** `401 Invalid credentials` (never reveal whether email or password was wrong).
- Token payload: `{ id, role }` only — no email/password in the token.
- `authMiddleware`: read `Authorization: Bearer <token>`, verify, attach `req.user`. Reject missing/invalid/expired with precise codes (see below).
- `roleMiddleware(...allowedRoles)`: runs after `authMiddleware`; `403` if role not allowed.

## Authorization rules (RBAC)

| Action                | user                         | admin              |
|-----------------------|------------------------------|--------------------|
| Register / login      | yes                          | yes                |
| List tasks            | own tasks only               | all tasks          |
| Create task           | yes (owner = self)           | yes                |
| Update task           | own only                     | any                |
| Delete task           | own only                     | any                |
| List all users        | no                           | yes                |

- Ownership check lives in the controller (compare `task.owner` to `req.user.id`),
  **not** only in middleware — a user requesting another user's task ID must get `403`, and a non-existent ID must get `404`. Check existence first, then ownership.

## HTTP status codes (use precisely)

- `400` malformed/validation error · `401` missing/invalid/expired token or bad credentials · `403` authenticated but not allowed (wrong role or not owner) · `404` resource not found · `409` duplicate (email already registered) · `429` rate limit exceeded.
- Distinguish 401 vs 403 carefully: 401 = "who are you?", 403 = "I know you, you can't".

## Error handling & responses

- Single central `errorHandler` middleware, registered last.
- All errors flow through a custom `AppError(message, statusCode)`; wrap async controllers in `asyncHandler` so rejected promises reach the handler.
- Consistent JSON envelope:

```json
{ "status": "error", "message": "Unauthorized access" }
```

- Success envelope: `{ "status": "success", "data": ... }`.
- **404 handler** must report the attempted path using `req.originalUrl` (e.g. `Route ${req.originalUrl} not found`). [Lab 2 fix]
- Never leak stack traces or internal errors in production responses; log them server-side instead.

## Environment configuration

- `.env` keys: `PORT`, `DB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `NODE_ENV`.
- Load with `dotenv`.
- **Validate env at startup** in `config/env.js` — fail fast with a clear message if any required var is missing or malformed. Do not let the server boot with an undefined `JWT_SECRET`. [Lab 2 fix]
- Commit a `.env.example` (keys only, no values). Ensure `.env` is in `.gitignore`. Never hardcode secrets.

## Carry-over fixes from Lab 2 (apply throughout)

1. **PATCH vs PUT.** The lab brief lists `PUT /api/tasks/:id`. Implement updates as **`PATCH`** for partial updates (the semantically correct verb), and additionally accept `PUT` for full replacement so the rubric's listed route still works. Document both in Swagger and note the distinction in the README. [Lab 2 fix]
2. **Pagination.** `GET /api/tasks` must support `?page` and `?limit` with sane defaults (page 1, limit 10, capped max) and return pagination metadata (`page`, `limit`, `total`, `totalPages`). Apply the owner filter *before* paginating. [Lab 2 fix]
3. **`req.originalUrl`** in the 404 handler (see Error handling). [Lab 2 fix]
4. **Env validation** at startup (see Environment). [Lab 2 fix]
5. **Precise vocabulary.** In code comments, commit messages, and the README, use exact terms: *authentication* (identity) vs *authorization* (permissions); *hashing* (not "encryption") for passwords; *access token* vs *refresh token*; *401 Unauthorized* vs *403 Forbidden*. [Lab 2 fix]

## Extensions to include (scope: all)

- **Refresh tokens:** `/auth/refresh` issues a new access token from a valid refresh token; rotate refresh tokens on use.
- **Logout / session invalidation:** maintain a token denylist (or store a token version on the user and bump it on logout) so refresh tokens can be revoked.
- **Password reset:** `/auth/forgot-password` issues a time-limited reset token (hashed in DB); `/auth/reset-password` consumes it. Stub the email send (log the link) — no real SMTP needed.
- **Email verification:** mark new users `isVerified: false`, issue a verification token, expose `/auth/verify-email`. Stub the email send.
- **Rate limiting:** stricter limiter on `/auth/login` and `/auth/register` (e.g. 5/min) plus a global limiter.
- **Helmet:** apply early in the middleware chain.
- **Activity logging:** lightweight request logger (`morgan`) + log auth events (login, failed login, logout).
- **User profile:** `GET/PATCH /users/me` for the logged-in user.
- **Swagger:** document every endpoint (request body, responses, auth requirement) at `/api-docs`, with a Bearer security scheme.

## Definition of done (maps to the 100% rubric)

- [ ] Register + login work; passwords bcrypt-hashed; duplicate email → 409. (20%)
- [ ] JWT issued on login, verified by middleware, expires; refresh works. (20%)
- [ ] Task routes protected; unauthenticated → 401. (20%)
- [ ] RBAC enforced; user limited to own tasks, admin to all; wrong role → 403. (15%)
- [ ] Env vars used + validated; consistent secure JSON errors; no secret leaks. (15%)
- [ ] Clean MVC structure; README documents setup, routes, auth, and PUT/PATCH note; Swagger live. (10%)

## Testing checklist (Postman/Insomnia)

Successful register/login · login with wrong password (401, generic) · access task route with no token (401) · with expired token (401) · user A reads/updates/deletes user B's task (403) · user hits admin-only route (403) · admin manages any task · missing env var → server refuses to start · pagination metadata correct · 404 on unknown route shows `req.originalUrl`.
