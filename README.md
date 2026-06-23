# Task Tracker API — Lab 03

RESTful Task Tracker with JWT authentication and role-based access control (RBAC). Built with Node.js, Express, and MongoDB.

---

## Setup

### Prerequisites

- Node.js 18+
- MongoDB running locally (`brew services start mongodb-community`) or a connection string from MongoDB Atlas

### Install

```bash
npm install
```

### Environment variables

Copy `.env.example` and fill in real values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: 3000) |
| `NODE_ENV` | No | `development` or `production` |
| `DB_URI` | **Yes** | MongoDB connection string |
| `JWT_SECRET` | **Yes** | Secret for signing access tokens (long random string) |
| `JWT_EXPIRES_IN` | **Yes** | Access token lifetime, e.g. `1h` |
| `JWT_REFRESH_SECRET` | **Yes** | Secret for signing refresh tokens (different from JWT_SECRET) |
| `JWT_REFRESH_EXPIRES_IN` | **Yes** | Refresh token lifetime, e.g. `7d` |

Generate secrets:
```bash
node -e "const c=require('crypto'); console.log(c.randomBytes(64).toString('hex'))"
```
Run twice — use a different value for each secret.

The server **refuses to start** if any required variable is missing.

### Run

```bash
npm run dev    # nodemon (auto-restart)
npm start      # production
```

### API docs

Interactive Swagger UI available at `http://localhost:3000/api-docs` once the server is running.

---

## Authentication flow

This API uses two-token authentication:

- **Access token** — short-lived JWT (`JWT_EXPIRES_IN`, e.g. 1 hour). Sent as `Authorization: Bearer <token>` on every protected request.
- **Refresh token** — long-lived JWT (`JWT_REFRESH_EXPIRES_IN`, e.g. 7 days). Used only to obtain a new access token when the current one expires.

```
1. POST /auth/register  → access token + refresh token
2. POST /auth/login     → access token + refresh token
3. Access token expires →
   POST /auth/refresh { refreshToken }  → new access token + new refresh token
4. POST /auth/logout   → bumps tokenVersion; all outstanding tokens immediately rejected
```

Token payload contains only `{ id, role, tokenVersion }` — no email or password.

> **Important:** Calling `/auth/refresh` rotates the `tokenVersion`. The previous access token is immediately rejected — always use the new access token returned by the refresh call. This is stricter than the typical "wait for expiry" approach but closes the window between refresh and old-token invalidation.

Passwords are **hashed** with bcrypt (cost factor 12) before storage. They are never returned in any API response.

---

## Authorization

Two roles:

| Role | Capabilities |
|---|---|
| `user` | Register, login, manage own tasks, view/update own profile |
| `admin` | All of the above + list all users + manage any task |

**Authentication** (401): verifying identity via token. Missing, invalid, or expired token → 401.

**Authorization** (403): verifying permissions after identity is confirmed. Valid token but wrong role or not the resource owner → 403.

Ownership check order: existence first (404), then ownership (403). A user requesting another user's task ID never learns whether the task exists.

---

## Endpoints

### Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | None | Register new user; returns user + tokens. 409 if email already registered. |
| POST | `/auth/login` | None | Authenticate; returns user + tokens. Always 401 on any credential failure (no field leak). |
| POST | `/auth/refresh` | None | Exchange refresh token for new token pair (rotates refresh token). |
| POST | `/auth/logout` | Bearer | Invalidates all tokens by bumping tokenVersion. |
| POST | `/auth/forgot-password` | None | Issues time-limited (10 min) reset token; stubs email to console. Always 200. |
| POST | `/auth/reset-password` | None | Consumes reset token, sets new password, invalidates all sessions. |
| POST | `/auth/verify-email` | None | Consumes 24 h email verification token; sets `isVerified = true`. |

### Tasks — `/api/tasks`

All task routes require a valid Bearer token.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/tasks` | user (own), admin (all) | Paginated list. Query: `?page=1&limit=10` (max 100). Returns `pagination` metadata. |
| POST | `/api/tasks` | user, admin | Create task. `owner` set automatically to the authenticated user. |
| GET | `/api/tasks/:id` | owner, admin | Fetch by ID. 404 if absent, 403 if not owner (non-admin). |
| **PATCH** | `/api/tasks/:id` | owner, admin | **Partial update** — send only the fields to change. Preferred verb. |
| PUT | `/api/tasks/:id` | owner, admin | **Full replacement** — `title` required; omitted fields reset to defaults. Supported for compatibility. |
| DELETE | `/api/tasks/:id` | owner, admin | Delete task. 404 first, then 403 if not owner. |

> **PATCH vs PUT:** Use `PATCH` for partial updates (change only `completed`, for example). Use `PUT` only when replacing the entire task. Sending `PUT` without `title` returns 400.

### Users — `/api/users`

All user routes require a valid Bearer token.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/users` | **admin only** | List all users. Never returns password fields. |
| GET | `/api/users/me` | user, admin | Current user's profile. |
| PATCH | `/api/users/me` | user, admin | Update `name` or `email`. Password changes → `/auth/reset-password`. Role changes blocked (403). |

---

## HTTP status codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | Deleted (no body) |
| 400 | Malformed request / validation error |
| 401 | **Unauthenticated** — missing, invalid, or expired token; bad credentials |
| 403 | **Unauthorized** — authenticated but not permitted (wrong role or not owner) |
| 404 | Resource not found |
| 409 | Conflict — email already registered |
| 429 | Rate limit exceeded |
| 500 | Internal server error (details logged server-side, never exposed to client) |

---

## Error response format

All errors return:

```json
{
  "status": "error",
  "message": "Human-readable description"
}
```

Success responses return:

```json
{
  "status": "success",
  "data": { ... }
}
```

---

## Security hardening

- **Helmet** sets secure HTTP headers on every response.
- **CORS** enabled via `cors` middleware.
- **Rate limiting:** global 100 req/15 min; strict 5 req/min on `/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`.
- **Password hashing:** bcrypt, cost factor 12. Never encryption — hashing is one-way.
- **Token secrets** loaded from environment at startup; server exits if any are missing.
- **Stack traces** never returned in production responses.
- **Credential error messages** are generic (`"Invalid credentials"`) — never reveal whether email or password was wrong.
- **Password reset / email verification tokens** stored as SHA-256 hashes in the database; single-use.
