import { config } from "@workspace/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
	...config,
	{
		// ── Env boundary (docs/technical/configuration/frontend.md) ──────────────────────
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
					message: "Read configuration through src/lib/api/config.ts (validated), never process.env directly. See docs/technical/configuration/frontend.md.",
				},
			],
		},
	},
];
