import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// setup-env.ts sets config defaults BEFORE test-file imports evaluate
		// (ESM hoisting would otherwise let the AppModule graph read undefined env).
		setupFiles: ["./test/setup-env.ts"],
		include: ["test/**/*.e2e-spec.ts"],
		// e2e boots the real Nest app against a live Postgres — allow slow boots.
		testTimeout: 30_000,
		hookTimeout: 30_000,
	},
});
