#!/usr/bin/env bash
# Legacy entry point — kept so existing invocations keep working.
#
# The canonical apply (order + validation) lives in scripts/apply-rls.ts:
# running `rls.sql` alone skips the helper/grant fragments and fails on a
# fresh database, so this wrapper just delegates.
#
# Prefer: pnpm db:apply-security
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$API_DIR"
exec pnpm db:apply-security
