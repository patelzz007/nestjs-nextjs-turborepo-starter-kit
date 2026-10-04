// ── E2E env bootstrap ─────────────────────────────────────────────────────
// Vitest loads `setupFiles` BEFORE any test-file imports are evaluated, so
// these values are set before the AppModule graph parses the config
// (src/config/api-config.ts). Only `DATABASE_URL` pointing at a reachable
// Postgres (usually from apps/api/.env) is strictly required:
//
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hello_world \
//   pnpm --filter @workspace/api test:e2e
//
// Precedence (see test/support/test-api-env.ts for the TEST-ONLY fixtures):
//   1. apps/api/.env               — database, Redis, tenant master key, …
//   2. infrastructure fixtures     — only fill variables .env left unset
//   3. secrets + switches          — always forced (test-only signing keys,
//                                    no OTP step, fixed CORS, EMAIL_MODE=noop,
//                                    loopback as the trusted proxy)
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { inject } from "vitest";

import { TEST_API_INFRASTRUCTURE, TEST_API_SECRETS, TEST_API_SWITCHES, TEST_E2E_PROXY, TEST_E2E_STORAGE } from "./support/test-api-env";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(apiRoot, ".env"), quiet: true });

for (const [name, value] of Object.entries(TEST_API_INFRASTRUCTURE)) {
	process.env[name] ??= value;
}
for (const [name, value] of Object.entries({ ...TEST_API_SECRETS, ...TEST_API_SWITCHES, ...TEST_E2E_PROXY, ...TEST_E2E_STORAGE })) {
	process.env[name] = value;
}
// This run's own BullMQ key prefix (test/global-setup-e2e.ts) — forced, so a
// BULLMQ_PREFIX in apps/api/.env can never put e2e jobs on the dev API's queues.
process.env.BULLMQ_PREFIX = inject("bullMqPrefix");
// …and its own REDIS_NAMESPACE (authz:invalidate channel, session cache,
// throttler and login-verification keys): a dev API on the same Redis never
// hears this run's invalidations, and the run never reads the dev API's keys.
process.env.REDIS_NAMESPACE = inject("redisNamespace");
