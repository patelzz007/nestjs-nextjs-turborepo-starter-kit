import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		// Declares the React act environment for jsdom component tests.
		setupFiles: ["./vitest.setup.ts"],
		include: ["**/*.test.{ts,tsx}"],
		fileParallelism: false,
		// Deterministic public config for the env modules (lib/env/*), which
		// parse at import and fail fast when a required variable is missing.
		// Vitest does not load `.env`, so tests never depend on a developer's
		// local file. Fixture values only — never real endpoints or secrets.
		env: {
			NEXT_PUBLIC_API_URL: "http://api.test",
			NEXT_PUBLIC_APP_URL: "http://localhost:3000",
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
