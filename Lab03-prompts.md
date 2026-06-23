# Lab 03 — Claude Code Build Prompts (Task Tracker with Authentication)

Use these in order, in your existing Task Tracker repo in VS Code, with
`Lab03-CLAUDE.md` saved as `CLAUDE.md` at the project root. Run one prompt,
review the diff, test, then move to the next. Don't paste them all at once.

---

## Prompt 0 — Orient (read-only)

```
Read CLAUDE.md and the existing codebase. Summarize the current structure of
the Task Tracker API, what the Task model and routes look like today, and which
files you'll need to add or change to implement authentication and RBAC.
Don't write any code yet — just give me the plan and flag anything in the
current code that will conflict with the auth work.
```

---

## Prompt 1 — Dependencies & environment

```
Install and wire up the auth/security dependencies: bcrypt, jsonwebtoken,
helmet, express-rate-limit, cors, swagger-jsdoc, swagger-ui-express, morgan
(plus dev: nodemon if not present).

Create config/env.js that loads dotenv and validates required env vars at
startup — PORT, DB_URI, JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_SECRET,
JWT_REFRESH_EXPIRES_IN, NODE_ENV. Fail fast with a clear message naming any
missing/invalid var. Export a typed config object the rest of the app imports.

Add .env.example (keys only), make sure .env is gitignored. Don't print real
secret values anywhere.
```

---

## Prompt 2 — User model

```
Create models/User.js (Mongoose): name (required, trimmed), email (required,
unique, lowercase, valid email), password (required, min length, select:false),
role (enum user|admin, default user), plus isVerified (default false) and a
tokenVersion (default 0) for logout/refresh invalidation.

- pre('save') hook hashes password with bcrypt cost 12, only when modified.
- comparePassword(candidate) instance method.
- Strip password in toJSON.
Add password-reset and email-verification token fields (hashed value + expiry).
```

---

## Prompt 3 — Token utils & auth controller

```
Create utils/generateTokens.js (sign access + refresh tokens; payload is only
{ id, role, tokenVersion }) and utils/asyncHandler.js and utils/AppError.js.

Create controllers/authController.js with:
- register: validate body, reject duplicate email with 409, create user, return
  user (no password) + access/refresh tokens.
- login: find user (+password), comparePassword; on any failure return a generic
  401 "Invalid credentials". On success return tokens.
- refresh: verify refresh token + tokenVersion, rotate and reissue.
- logout: bump tokenVersion to invalidate existing tokens.
Use AppError + asyncHandler everywhere. Consistent { status, data } / { status,
message } envelopes.
```

---

## Prompt 4 — Auth & role middleware

```
Create middleware/authMiddleware.js: read Authorization: Bearer <token>, verify
with JWT_SECRET, load the user, check tokenVersion still matches, attach req.user.
Return precise codes: 401 for missing token, invalid token, and expired token
(distinct messages); never 500 for an expired/garbled token.

Create middleware/roleMiddleware.js: roleMiddleware(...allowedRoles) that runs
after authMiddleware and returns 403 if req.user.role isn't allowed.
```

---

## Prompt 5 — Auth routes + rate limiting + helmet

```
Create routes/authRoutes.js mounting register, login, refresh, logout under
/auth. Create middleware/rateLimiter.js with a strict limiter (5/min) for
/auth/login and /auth/register and a looser global limiter. In server.js wire
up helmet (early), cors, morgan, the global limiter, body parsing, and mount
/auth. Keep server.js readable.
```

---

## Prompt 6 — Protect tasks + ownership + pagination

```
Update the Task model to add owner (ObjectId ref User, required, indexed).

Protect all task routes with authMiddleware. In taskController:
- create: set owner = req.user.id.
- list (GET /api/tasks): support ?page & ?limit (default 1/10, capped), return
  pagination metadata (page, limit, total, totalPages). Non-admins see only their
  own tasks; admins see all.
- get/update/delete by id: load the task first (404 if absent), then enforce
  ownership (403 if not owner and not admin).

Implement update as PATCH (partial) AND keep PUT working for full replacement,
per CLAUDE.md. Delete allowed for owner or admin.
```

---

## Prompt 7 — Admin user management

```
Create controllers/userController.js + routes/userRoutes.js:
- GET /api/users — admin only (roleMiddleware('admin')) — list all users.
- GET/PATCH /api/users/me — the logged-in user's own profile.
Mount under /api/users. Never return password fields.
```

---

## Prompt 8 — Password reset & email verification (stubbed email)

```
Add to authController + authRoutes:
- POST /auth/forgot-password: generate a time-limited reset token, store its
  hash + expiry on the user, log the reset link (stub email).
- POST /auth/reset-password: verify token + expiry, set new password, clear token.
- POST /auth/verify-email + issue-verification flow: set isVerified true on valid
  token. Log the verification link (stub email).
Keep tokens hashed at rest and single-use.
```

---

## Prompt 9 — Central error handling & 404

```
Create middleware/errorHandler.js as the last-registered middleware: convert
AppError and known Mongoose/JWT errors into the { status:"error", message }
envelope with the right status code; in production never leak stack traces (log
them instead). Add a 404 handler that returns `Route ${req.originalUrl} not
found`. Make sure all controllers route errors here via asyncHandler.
```

---

## Prompt 10 — Swagger docs

```
Create config/swagger.js using swagger-jsdoc + swagger-ui-express, served at
/api-docs. Define a Bearer (JWT) security scheme. Add JSDoc @swagger annotations
to every route (auth, tasks, users) documenting request bodies, responses, and
which endpoints require auth / admin. Note the PATCH vs PUT behavior on the task
update endpoint.
```

---

## Prompt 11 — README & final review

```
Update README.md: setup steps, env vars (reference .env.example), full endpoint
table with access levels, auth flow (access + refresh tokens), and an explicit
note that updates use PATCH (partial) with PUT also supported. Use precise terms
throughout (authentication vs authorization, hashing not encryption, 401 vs 403).

Then review the whole implementation against the Definition of Done in CLAUDE.md
and list anything missing or weak.
```

---

## Manual test pass (Postman/Insomnia) before submitting

1. Register two users (A, B) + one admin.
2. Login each → save tokens.
3. Call a task route with no token → 401; with expired token → 401.
4. A creates a task; B tries to GET/PATCH/DELETE it → 403; unknown id → 404.
5. A lists tasks → only own; admin lists → all; check pagination metadata.
6. Non-admin hits GET /api/users → 403; admin → 200.
7. Hammer /auth/login → 429 after the limit.
8. Remove JWT_SECRET from .env → server refuses to start.
9. Hit an unknown route → message includes the path.
10. Open /api-docs → all endpoints documented with the Bearer scheme.
```
