#!/usr/bin/env bash
# Manual smoke tests for the Task Tracker API.
# Usage: ./tests/manual-tests.sh
# Requires the server to be running on http://localhost:3000.

set -u

BASE="http://localhost:3000"
H_JSON="Content-Type: application/json"

hr() { printf '\n----------------------------------------\n'; }

run() {
  local label="$1"; shift
  hr
  echo "# $label"
  echo "$ curl $*"
  curl -sS -w "\n[HTTP %{http_code}]\n" "$@"
}

run "Healthcheck — GET /health" \
  "$BASE/health"

run "1. GET /api/tasks (empty list)" \
  "$BASE/api/tasks"

run "3a. POST /api/tasks — create task #1" \
  -X POST "$BASE/api/tasks" -H "$H_JSON" -d '{"title":"Buy groceries"}'

run "3b. POST /api/tasks — create task #2 with completed=true" \
  -X POST "$BASE/api/tasks" -H "$H_JSON" -d '{"title":"Walk the dog","completed":true}'

run "3c. POST /api/tasks — invalid body (missing title) → 400" \
  -X POST "$BASE/api/tasks" -H "$H_JSON" -d '{}'

run "3d. POST /api/tasks — empty title → 400" \
  -X POST "$BASE/api/tasks" -H "$H_JSON" -d '{"title":""}'

run "3e. POST /api/tasks — non-boolean completed → 400" \
  -X POST "$BASE/api/tasks" -H "$H_JSON" -d '{"title":"x","completed":"yes"}'

run "1b. GET /api/tasks (two items)" \
  "$BASE/api/tasks"

run "2a. GET /api/tasks/1 (exists)" \
  "$BASE/api/tasks/1"

run "2b. GET /api/tasks/abc — invalid id → 400" \
  "$BASE/api/tasks/abc"

run "2c. GET /api/tasks/999 — not found → 404" \
  "$BASE/api/tasks/999"

run "4a. PUT /api/tasks/1 — mark completed" \
  -X PUT "$BASE/api/tasks/1" -H "$H_JSON" -d '{"completed":true}'

run "4b. PUT /api/tasks/1 — change title" \
  -X PUT "$BASE/api/tasks/1" -H "$H_JSON" -d '{"title":"Buy organic groceries"}'

run "4c. PUT /api/tasks/1 — empty body → 400" \
  -X PUT "$BASE/api/tasks/1" -H "$H_JSON" -d '{}'

run "4d. PUT /api/tasks/999 — not found → 404" \
  -X PUT "$BASE/api/tasks/999" -H "$H_JSON" -d '{"completed":true}'

run "4e. PUT /api/tasks/abc — invalid id → 400" \
  -X PUT "$BASE/api/tasks/abc" -H "$H_JSON" -d '{"completed":true}'

run "5a. DELETE /api/tasks/2 — should return 204" \
  -X DELETE "$BASE/api/tasks/2"

run "5b. DELETE /api/tasks/999 — not found → 404" \
  -X DELETE "$BASE/api/tasks/999"

run "5c. DELETE /api/tasks/abc — invalid id → 400" \
  -X DELETE "$BASE/api/tasks/abc"

run "1c. GET /api/tasks (after delete)" \
  "$BASE/api/tasks"

run "Unknown route → 404 JSON envelope" \
  "$BASE/api/does-not-exist"

hr
echo "Done."
