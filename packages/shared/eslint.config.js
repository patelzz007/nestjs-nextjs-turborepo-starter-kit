import { config as baseConfig } from "@workspace/eslint-config/base";

/**
 * Shared package ESLint configuration.
 *
 * Zod v4 uses extremely complex generic type chains (e.g. `z.iso.datetime()`)
 * that TypeScript's `strictTypeChecked` rules cannot resolve, producing
 * false-positive `no-unsafe-*` errors. Since these are validated at runtime
 * by Zod itself, we relax the unsafe rules for schema files only.
 *
 * The user's non-negotiable rules (no `any`, explicit return types, etc.)
 * remain enforced everywhere.
 *
 * @type {import("eslint").Linter.Config}
 */
const config = [
	...baseConfig,

	// ── Zod v4 schema exception ────────────────────────────────────
	// Zod v4's complex generic chains cause false positives with
	// strictTypeChecked (no-unsafe-call, no-unsafe-member-access, etc.).
	// Since Zod validates types at runtime, these are safe to relax.
	{
		files: ["src/schemas/**/*.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
		},
	},
];

export default config;
