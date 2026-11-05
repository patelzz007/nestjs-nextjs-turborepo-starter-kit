import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Coverage floors (enhancement 3.1): measured on 2026-11-03, set just below. Raise them as tests are
		// added; never lower them. `pnpm test` measures (`--coverage`); a single-file `vitest run` doesn't.
		coverage: {
			provider: "v8",
			reporter: ["text-summary"],
			thresholds: { lines: 98, statements: 98, functions: 99, branches: 83 },
		},
		environment: "node",
		// Tests live in `__tests__/` folders beside the code they test (rules/11 → "Where tests live").
		include: ["src/**/__tests__/**/*.test.ts"],
		// The token tests are pure functions over constant data: no mocks, no
		// globals, no module state. One worker per file would start ~20
		// processes for ~3 s of tests — a cost the whole monorepo pays when
		// `turbo run test` runs every package's suite at once. Sharing workers
		// between files is safe here and keeps the CPU for the tests.
		isolate: false,
	},
});
