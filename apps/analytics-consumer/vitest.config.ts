import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Coverage floors (enhancement 3.1): measured on 2026-11-03, set just below. Raise them as tests are
		// added; never lower them. `pnpm test` measures (`--coverage`); a single-file `vitest run` doesn't.
		coverage: {
			provider: "v8",
			reporter: ["text-summary"],
			thresholds: { lines: 72, statements: 72, functions: 68, branches: 56 },
		},
		environment: "node",
		// Unit tests: the inbox store is an in-memory port — no Kafka, no Postgres.
		include: ["src/**/*.spec.ts"],
		exclude: ["src/**/*.e2e-spec.ts"],
	},
});
