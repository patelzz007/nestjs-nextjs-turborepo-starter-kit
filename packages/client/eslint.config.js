import { config } from "@workspace/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
	...config,
	{
		// ── Env boundary (docs/configuration.md) ──────────────────────
		// src/lib/api/config.ts is this package's only env module: it validates
		// NEXT_PUBLIC_API_URL / NODE_ENV with zod. Everything else imports from it.
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["src/lib/api/config.ts"],
		rules: {
			"no-restricted-properties": [
				"error",
				{
					object: "process",
					property: "env",
					message: "Read configuration through src/lib/api/config.ts (validated), never process.env directly. See docs/configuration.md.",
				},
			],
		},
	},
	{
		files: ["src/lib/api/client-router.ts", "src/lib/api/server-request.ts"],
		rules: {
			"@typescript-eslint/consistent-type-assertions": "off",
			"@typescript-eslint/no-unnecessary-type-assertion": "off",
		},
	},
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
			"@typescript-eslint/consistent-type-assertions": "off",
			"@typescript-eslint/no-unnecessary-type-assertion": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
		},
	},
];
