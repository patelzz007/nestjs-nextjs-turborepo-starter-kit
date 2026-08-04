import { config } from "@workspace/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
	...config,
	{
		// `renderHook(() => useAuth())` is the canonical testing-library pattern,
		// but the React Hooks rules cannot tell that the anonymous callback is a
		// component render, so they report false positives on hook calls inside
		// it (and on the intentional non-memoized helpers tests use). Scoped to
		// test files only.
		files: ["src/**/*.test.{ts,tsx}"],
		rules: {
			"react-hooks/rules-of-hooks": "off",
			"react-hooks/exhaustive-deps": "off",
		},
	},
];
