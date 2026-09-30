import { nextJsConfig } from "@workspace/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */ export default [
	...nextJsConfig,
	{
		rules: {
			// TanStack Table's `useReactTable()` returns functions that are not safe to
			// memoize by design (the library owns the memoization internally). The
			// React Compiler's `incompatible-library` check is a known false positive
			// here, so we silence it at the config level instead of per-line disables.
			"react-hooks/incompatible-library": "off",
		},
	},
	{
		// The opt-in e2e smoke reads `ADMIN_E2E_BASE_URL` (see e2e/README.md). It is
		// a local-only switch that must not become part of any turbo task hash.
		files: ["e2e/**"],
		rules: {
			"turbo/no-undeclared-env-vars": "off",
		},
	},
];
