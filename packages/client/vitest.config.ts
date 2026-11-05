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
			thresholds: { lines: 79, statements: 79, functions: 79, branches: 71 },
		},
		environment: "node",
		// Tests live in `__tests__/` folders beside the code they test (rules/11 → "Where tests live").
		include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
		// `src/lib/api/config.ts` validates NEXT_PUBLIC_API_URL at import and
		// fails fast when it is missing; vitest does not load `.env`, so give the
		// tests a deterministic fixture value (never a real endpoint).
		env: {
			NEXT_PUBLIC_API_URL: "http://api.test",
		},
		// nuqs's Next.js adapter imports `next/navigation`: run it through Vite so
		// a test can stand in for the App Router (url-state-provider.test.tsx).
		server: { deps: { inline: ["nuqs"] } },
	},
	// No resolve aliases: `@workspace/shared` resolves through its package.json
	// `exports`, whose `development` condition (Vite's default outside
	// production) points at src/ — the same path TypeScript and Next use
	// (docs/technical/tooling/oxlint.md), so tests never depend on a stale dist/ build.
});
