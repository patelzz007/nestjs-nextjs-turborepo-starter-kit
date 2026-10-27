import { defineConfig } from "vitest/config";

import { e2eMaxWorkers } from "./test/support/e2e-worker-databases";

export default defineConfig({
	test: {
		environment: "node",
		// Per-run isolation: global-setup-e2e.ts copies the run's database once per
		// worker and picks this run's BULLMQ_PREFIX (`e2e:<uuid>`, or the runner's
		// E2E_BULLMQ_PREFIX — ci:local pins one), provides both to every test file
		// and drops the copies / deletes the run's keys afterwards, so a dev API on
		// the same Redis (prefix `bull`) can never steal this run's jobs.
		globalSetup: ["./test/global-setup-e2e.ts"],
		// setup-env.ts sets config defaults BEFORE test-file imports evaluate
		// (ESM hoisting would otherwise let the AppModule graph read undefined env),
		// and points the file at its worker's own database, BullMQ prefix and Redis namespace.
		setupFiles: ["./test/setup-env.ts"],
		include: ["test/**/*.e2e-spec.ts"],
		// e2e boots the real Nest app against a live Postgres — allow slow boots.
		testTimeout: 30_000,
		hookTimeout: 30_000,
		// Test files run in parallel, each worker on its own database copy
		// (test/support/e2e-worker-databases.ts). `E2E_MAX_WORKERS` overrides the
		// default (half the cores, at most four); `--no-file-parallelism` runs one file at a time.
		maxWorkers: e2eMaxWorkers(process.env.E2E_MAX_WORKERS),
	},
});
