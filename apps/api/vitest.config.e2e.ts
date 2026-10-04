import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// Per-run BullMQ isolation: global-setup-e2e.ts picks this run's BULLMQ_PREFIX
		// (`e2e:<uuid>`, or the runner's E2E_BULLMQ_PREFIX — ci:local pins one),
		// provides it to every test file and deletes the run's keys afterwards, so a
		// dev API on the same Redis (prefix `bull`) can never steal this run's jobs.
		globalSetup: ["./test/global-setup-e2e.ts"],
		// setup-env.ts sets config defaults BEFORE test-file imports evaluate
		// (ESM hoisting would otherwise let the AppModule graph read undefined env).
		setupFiles: ["./test/setup-env.ts"],
		include: ["test/**/*.e2e-spec.ts"],
		// e2e boots the real Nest app against a live Postgres — allow slow boots.
		testTimeout: 30_000,
		hookTimeout: 30_000,
		fileParallelism: false,
	},
});
