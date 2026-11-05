import { defineConfig } from "vitest/config";

// Vitest's defaults otherwise (tests in `__tests__/`, found by name).
export default defineConfig({
	test: {
		// Coverage floors (enhancement 3.1): measured on 2026-11-03, set just below. Raise them as tests are
		// added; never lower them. `pnpm test` measures (`--coverage`); a single-file `vitest run` doesn't.
		coverage: {
			provider: "v8",
			reporter: ["text-summary"],
			thresholds: { lines: 71, statements: 70, functions: 71, branches: 49 },
		},
	},
});
