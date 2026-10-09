import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}"],
	},
	// No resolve aliases: `@workspace/shared` resolves through its package.json
	// `exports`, whose `development` condition (Vite's default outside
	// production) points at src/ — the same path TypeScript and Next use.
});
