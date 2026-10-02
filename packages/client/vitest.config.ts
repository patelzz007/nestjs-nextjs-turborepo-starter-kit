import { fileURLToPath } from "node:url";

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
	resolve: {
		alias: {
			// Resolve the shared contract straight from source so the tests never
			// depend on a stale `dist/` build (mirrors the apps' `development`
			// export condition).
			"@workspace/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
		},
	},
});
