import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// Existing src/**/*.spec.ts files use bare describe/it/expect globals.
		globals: true,
		// setup-env.ts sets config defaults BEFORE test-file imports evaluate
		// (ESM hoisting would otherwise let the module graph read undefined env).
		setupFiles: ["./test/setup-env.ts"],
		// Scoped to the wired suites: notifications/email + telescope. The legacy
		// specs under src/modules/* were never wired to a runner (jest-style +
		// unresolved Nest DI) and predate this config.
		include: ["src/modules/notifications/**/*.spec.ts", "src/modules/telescope/**/*.spec.ts"],
		// Email/notification specs never touch the network or a real DB — all
		// external calls (Resend, Prisma) are mocked.
		testTimeout: 15_000,
		hookTimeout: 15_000,
	},
});
