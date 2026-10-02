import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// Integration tests against the live Postgres in apps/api/.env (migrations + RLS applied).
		include: ["src/**/*.e2e-spec.ts"],
		testTimeout: 30_000,
		hookTimeout: 30_000,
		fileParallelism: false,
	},
});
