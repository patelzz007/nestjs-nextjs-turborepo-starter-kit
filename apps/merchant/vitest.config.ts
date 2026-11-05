import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
	plugins: [react()],
	test: {
		// Coverage floors (enhancement 3.1): measured on 2026-11-03, set just below. Raise them as tests are
		// added; never lower them. `pnpm test` measures (`--coverage`); a single-file `vitest run` doesn't.
		coverage: {
			provider: "v8",
			reporter: ["text-summary"],
			thresholds: { lines: 82, statements: 82, functions: 77, branches: 70 },
		},
		environment: "node",
		// Declares the React act environment so `act()` runs silently (React 19
		// requires `globalThis.IS_REACT_ACT_ENVIRONMENT = true` in jsdom tests).
		setupFiles: ["./vitest.setup.ts"],
		// Every test file in the app — a new folder never silently falls outside the run.
		// Tests live in `__tests__/` folders beside the code they test (rules/11 → "Where tests live").
		include: ["**/__tests__/**/*.test.{ts,tsx}"],
		exclude: ["**/node_modules/**", "**/.next/**"],
		// Deterministic public config for the env modules (lib/env/*), which
		// parse at import and fail fast when a required variable is missing.
		// Vitest does not load `.env`, so tests never depend on a developer's
		// local file. Fixture values only — never real endpoints or secrets.
		env: {
			NEXT_PUBLIC_API_URL: "http://api.test",
			NEXT_PUBLIC_MERCHANT_URL: "http://localhost:3003",
		},
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL(".", import.meta.url)),
			// `server-only` resolves to Next's empty module under the react-server
			// condition; mirror that here so server modules load in node tests.
			// Client Components importing it are still rejected by `next build`
			// and by the `workspace-boundaries` lint rule.
			"server-only": require.resolve("next/dist/compiled/server-only/empty.js"),
		},
	},
});
