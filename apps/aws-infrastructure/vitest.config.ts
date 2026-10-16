import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// Tests live in a `__tests__/` folder (rules/11 → "Where tests live").
		include: ["__tests__/**/*.test.ts"],
	},
});
