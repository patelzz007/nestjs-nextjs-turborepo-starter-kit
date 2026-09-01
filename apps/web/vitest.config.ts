import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["**/*.test.{ts,tsx}"],
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL(".", import.meta.url)),
			// Resolve the workspace client from source (mirrors the app's tsconfig
			// `paths`; vite can't read tsconfig paths on its own).
			"@workspace/client": fileURLToPath(new URL("../../packages/client/src", import.meta.url)),
		},
	},
});
