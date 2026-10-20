import { defineConfig } from "vitest/config";

export default defineConfig({
	esbuild: {
		tsconfigRaw: {
			compilerOptions: {
				experimentalDecorators: true,
			},
		},
	},
	test: {
		environment: "node",
		// Existing src/**/*.spec.ts files use bare describe/it/expect globals.
		globals: true,
		// setup-unit-env.ts installs the hermetic TEST-ONLY env fixture BEFORE
		// test-file imports evaluate (module files read getApiConfig() at load).
		setupFiles: ["./test/setup-unit-env.ts"],
		// Every unit spec under src/, prisma/, scripts/ and test/support/ (all type-checked by
		// tsconfig.check.json) runs: a new spec is picked up by
		// its filename, never by editing a list. End-to-end specs are `*.e2e-spec.ts`
		// (a different suffix, run by vitest.config.e2e.ts) and do not match.
		include: ["src/**/*.spec.ts", "prisma/**/*.spec.ts", "scripts/**/*.spec.ts", "test/support/**/*.spec.ts"],
		// Email/notification specs never touch the network or a real DB — all
		// external calls (Resend, Prisma) are mocked.
		testTimeout: 15_000,
		hookTimeout: 15_000,
		// Exposes `globalThis.gc` so a spec can force a real major GC when that is
		// what it tests (post-gc-heap-probe.spec.ts), instead of waiting for V8 to
		// choose one — which made the outcome depend on machine load.
		execArgv: ["--expose-gc"],
	},
});
