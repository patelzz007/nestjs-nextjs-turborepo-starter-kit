import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "proxy.test.ts"],
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
