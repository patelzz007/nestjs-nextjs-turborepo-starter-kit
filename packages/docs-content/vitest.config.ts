import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text-summary"],
			include: ["src/**/*.ts"],
			thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 },
		},
		environment: "node",
		// Tests live in `__tests__/` folders beside the code they test (rules/11 → "Where tests live").
		include: ["src/**/__tests__/**/*.test.ts"],
	},
});
