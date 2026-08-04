import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}"],
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
