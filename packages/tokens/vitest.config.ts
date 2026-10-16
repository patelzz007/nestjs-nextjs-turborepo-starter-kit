import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
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
