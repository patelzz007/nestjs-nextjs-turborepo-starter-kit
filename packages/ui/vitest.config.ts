import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		// Coverage floors (enhancement 3.1): measured on 2026-11-03, set just below. Raise them as tests are
		// added; never lower them. `pnpm test` measures (`--coverage`); a single-file `vitest run` doesn't.
		coverage: {
			provider: "v8",
			reporter: ["text-summary"],
			thresholds: { lines: 82, statements: 82, functions: 82, branches: 71 },
		},
		environment: "jsdom",
		// Tests live in `__tests__/` folders beside the code they test (rules/11 → "Where tests live").
		include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
	},
});
