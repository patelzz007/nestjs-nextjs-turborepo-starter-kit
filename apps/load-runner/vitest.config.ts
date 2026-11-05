import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Coverage floors (enhancement 3.1): measured on 2026-11-03, set just below. Raise them as tests are
		// added; never lower them. `pnpm test` measures (`--coverage`); a single-file `vitest run` doesn't.
		coverage: {
			provider: "v8",
			reporter: ["text-summary"],
			thresholds: { lines: 97, statements: 97, functions: 99, branches: 95 },
		},
		environment: "node",
		// Unit tests only: the machine readings and the API are ports, faked in the tests.
		include: ["src/**/*.spec.ts"],
	},
});
