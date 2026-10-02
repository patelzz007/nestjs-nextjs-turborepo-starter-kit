import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		// Declares the React act environment so `act()` runs silently (React 19
		// requires `globalThis.IS_REACT_ACT_ENVIRONMENT = true` in jsdom tests).
		setupFiles: ["./vitest.setup.ts"],
		include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "app/**/*.test.tsx", "proxy.test.ts", "instrumentation.test.ts", "e2e/**/*.e2e-spec.ts"],
		fileParallelism: false,
		// Deterministic public config for the env modules (lib/env/*), which
		// parse at import and fail fast when a required variable is missing.
		// Vitest does not load `.env`, so tests never depend on a developer's
		// local file. Fixture values only — never real endpoints or secrets.
		// NEXT_PUBLIC_SESSION_POLL_MS is intentionally unset (zero-poll default).
		env: {
			NEXT_PUBLIC_API_URL: "http://api.test",
			NEXT_PUBLIC_ADMIN_URL: "http://localhost:3001",
			NEXT_PUBLIC_WEB_URL: "http://localhost:3000",
			NEXT_PUBLIC_MERCHANT_URL: "http://localhost:3003",
		},
	},
	resolve: {
		alias: [
			{ find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
			// `server-only` resolves to Next's empty module under the react-server
			// condition; mirror that here so server modules load in node tests.
			// Client Components importing it are still rejected by `next build`
			// and by the `workspace-boundaries` lint rule.
			{ find: /^server-only$/, replacement: require.resolve("next/dist/compiled/server-only/empty.js") },
		],
	},
});
