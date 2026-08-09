import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		include: ["src/**/*.test.{ts,tsx}"],
	},
	resolve: {
		alias: {
			// Mirrors the package's tsconfig `paths` so components can import
			// siblings via `@workspace/ui/components/...` (self-reference).
			"@workspace/ui": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
});
