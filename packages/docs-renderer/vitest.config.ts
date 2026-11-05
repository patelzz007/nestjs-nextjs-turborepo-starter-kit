import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		// Coverage floors carried over from apps/docs, where these modules were measured on 2026-11-03.
		// Raise them as tests are added; never lower them. `pnpm test` measures (`--coverage`).
		coverage: {
			provider: "v8",
			reporter: ["text-summary"],
			include: ["src/**/*.ts"],
			thresholds: { lines: 96, statements: 96, functions: 96, branches: 85 },
		},
		environment: "node",
		// Tests live in `__tests__/` folders beside the code they test (rules/11 → "Where tests live").
		include: ["src/**/__tests__/**/*.test.ts"],
	},
});
