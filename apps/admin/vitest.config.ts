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
		include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "app/**/*.test.tsx", "stores/**/*.test.ts", "proxy.test.ts", "e2e/**/*.e2e-spec.ts"],
		fileParallelism: false,
	},
	resolve: {
		alias: [
			{ find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
			// Resolve the workspace client from source (mirrors the app's tsconfig
			// `paths`; vite can't read tsconfig paths on its own).
			{ find: "@workspace/client", replacement: fileURLToPath(new URL("../../packages/client/src", import.meta.url)) },
			// Deep `@workspace/shared/<path>` imports (e.g. resource schemas)
			// mirror the tsconfig `paths` entry; the bare package keeps its exports.
			{ find: /^@workspace\/shared\/(.+)$/, replacement: `${fileURLToPath(new URL("../../packages/shared/src", import.meta.url))}/$1` },
		],
	},
});
