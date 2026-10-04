import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}"],
		// `src/lib/api/config.ts` validates NEXT_PUBLIC_API_URL at import and
		// fails fast when it is missing; vitest does not load `.env`, so give the
		// tests a deterministic fixture value (never a real endpoint).
		env: {
			NEXT_PUBLIC_API_URL: "http://api.test",
		},
	},
	// No resolve aliases: `@workspace/shared` resolves through its package.json
	// `exports`, whose `development` condition (Vite's default outside
	// production) points at src/ — the same path TypeScript and Next use
	// (docs/technical/tooling/eslint.md §3.1), so tests never depend on a stale dist/ build.
});
