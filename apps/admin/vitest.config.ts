import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		// Declares the React act environment so `act()` runs silently (React 19
		// requires `globalThis.IS_REACT_ACT_ENVIRONMENT = true` in jsdom tests).
		setupFiles: ["./vitest.setup.ts"],
		include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "stores/**/*.test.ts", "proxy.test.ts"],
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
