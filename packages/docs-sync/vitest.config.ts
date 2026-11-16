import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text-summary"],
			include: ["src/**/*.ts"],
			// The CLIs only wire the environment to the tested modules.
			exclude: ["src/cli.ts", "src/sources/notion/import/cli.ts"],
			thresholds: { lines: 90, statements: 90, functions: 90, branches: 80 },
		},
		environment: "node",
		// Tests live in `__tests__/` folders beside the code they test (rules/11 → "Where tests live").
		include: ["src/**/__tests__/**/*.test.ts"],
	},
});
