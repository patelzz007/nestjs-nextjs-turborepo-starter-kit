#!/usr/bin/env bash
# Apply Row-Level Security (RLS) to the database.
# Usage: pnpm --filter @workspace/api db:rls
#
# Reads DATABASE_URL from .env (strips Prisma's ?schema= param) and runs
# prisma/rls.sql. Idempotent — safe to run any number of times.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RLS_FILE="${API_DIR}/prisma/rls.sql"
ENV_FILE="${API_DIR}/.env"

if [ ! -f "$RLS_FILE" ]; then
  echo "Error: rls.sql not found at $RLS_FILE" >&2
  exit 1
fi

# Prefer DATABASE_URL from the environment (set by dotenv in package.json
# scripts). Fall back to reading .env directly so this also works when
# called manually without dotenv.
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC2086
    DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set and .env was not found" >&2
  exit 1
fi

# Strip Prisma's ?schema=… query param (psql doesn't understand it)
DB_URL="${DATABASE_URL%%\?*}"

echo "Applying RLS from rls.sql ..."
psql "$DB_URL" -f "$RLS_FILE"
echo "RLS applied successfully."
