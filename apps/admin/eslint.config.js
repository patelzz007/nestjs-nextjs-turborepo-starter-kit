import { nextJsConfig } from "@workspace/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */	export default [
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
		// proxy.test.ts exercises the proxy with structural test doubles for
		// NextRequest/NextResponse. The type-assertion ban is a false positive
		// for test mocks, so it is scoped to the test file only.
		files: ["proxy.test.ts"],
		rules: {
			"@typescript-eslint/consistent-type-assertions": "off",
		},
	},
];
