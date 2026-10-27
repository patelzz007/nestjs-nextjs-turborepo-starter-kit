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

import { BooleanFlagEnvSchema } from "@workspace/shared";
import { config as loadEnv } from "dotenv";
import { inject } from "vitest";

import { e2eRedisNamespaceFor, e2eWorkerBullMqPrefix } from "./support/e2e-bullmq-prefix";
import { workerDatabaseUrl } from "./support/e2e-worker-databases";
import { TEST_API_INFRASTRUCTURE, TEST_API_SECRETS, TEST_API_SWITCHES, TEST_E2E_PROXY, TEST_E2E_STORAGE } from "./support/test-api-env";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(apiRoot, ".env"), quiet: true });

for (const [name, value] of Object.entries(TEST_API_INFRASTRUCTURE)) {
	process.env[name] ??= value;
}
// EMAIL_TEST_TO is a developer's local redirect of every recipient to their own inbox: e2e asserts the
// real recipients and sends nothing (EMAIL_MODE=noop), so a redirect in apps/api/.env never applies.
delete process.env.EMAIL_TEST_TO;
// Multi-tenant mode has no fallback tenant (D12) and refuses to boot with one: a DEFAULT_TENANT_ID
// from the fixtures or a single-mode apps/api/.env does not apply to a multi-tenant run.
if (BooleanFlagEnvSchema.parse(process.env.TENANCY_ENABLED)) {
	delete process.env.DEFAULT_TENANT_ID;
}
for (const [name, value] of Object.entries({ ...TEST_API_SECRETS, ...TEST_API_SWITCHES, ...TEST_E2E_PROXY, ...TEST_E2E_STORAGE })) {
	process.env[name] = value;
}
// Test files run in parallel, one per worker. This worker's own copy of the
// database (test/global-setup-e2e.ts): no file ever sees another file's rows,
// and the database DATABASE_URL named is only copied, never written.
process.env.DATABASE_URL = workerDatabaseUrl(inject("workerDatabaseUrls"), process.env.VITEST_POOL_ID);
// This worker's own BullMQ key prefix inside the run's — forced, so a
// BULLMQ_PREFIX in apps/api/.env can never put e2e jobs on the dev API's
// queues, and a worker never runs another worker's jobs against its database.
process.env.BULLMQ_PREFIX = e2eWorkerBullMqPrefix(inject("bullMqPrefix"), process.env.VITEST_POOL_ID);
// …and its own REDIS_NAMESPACE (authz:invalidate channel, session cache,
// throttler and login-verification keys): neither a dev API on the same Redis
// nor another worker hears its invalidations or counts its requests.
process.env.REDIS_NAMESPACE = e2eRedisNamespaceFor(process.env.BULLMQ_PREFIX);

// Tenancy suites share this loader (plan MT-26). `multi` must not keep a fallback tenant id.
const tenancySuite = process.env.TENANCY_E2E_SUITE;
if (tenancySuite === "multi") {
	process.env.TENANCY_ENABLED = "true";
	delete process.env.DEFAULT_TENANT_ID;
}
if (tenancySuite === "single") {
	process.env.TENANCY_ENABLED = "false";
	process.env.DEFAULT_TENANT_ID = "019b76da-a810-7000-8000-0000000000a1";
}
