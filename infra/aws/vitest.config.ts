import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Coverage floors (enhancement 3.1): measured on 2026-11-03, set just below. Raise them as tests are
		// added; never lower them. `pnpm test` measures (`--coverage`); a single-file `vitest run` doesn't.
		coverage: {
			provider: "v8",
			reporter: ["text-summary"],
			thresholds: { lines: 88, statements: 86, functions: 75, branches: 68 },
		},
		environment: "node",
		// Tests live in a `__tests__/` folder (rules/11 → "Where tests live").
		include: ["__tests__/**/*.test.ts"],
	},
});
