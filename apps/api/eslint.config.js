import { nestjsConfig } from "@workspace/eslint-config/nestjs";

/** @type {import("eslint").Linter.Config} */
export default [
	// Global ignores — must be first so ESLint skips these files entirely
	{
		ignores: ["**/*.spec.ts", "**/*.test.ts", "**/*.e2e-spec.ts", "test/**"],
	},
	...nestjsConfig,

	// ── Parser options: allow spec files as default project members ──
	// Spec files are excluded from tsconfig.json, but typescript-eslint's
	// projectService tries to resolve them. allowDefaultProject tells the
	// service to include matching files even though they're not in tsconfig.
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						"src/modules/auth/*.spec.ts",
						"scripts/render-email-previews.ts",
						"scripts/test-webhook-signature.ts",
						"scripts/telescope-cli.ts",
						"scripts/gen-telescope-docs.ts",
					],
				},
			},
		},
	},

	// ── Type tracing override for runtime-type patterns ──────────────
	// Prisma's complex generic chains, Zod schema metafields (`.meta()`),
	// and dynamic Express middleware patterns cannot be fully resolved by
	// strictTypeChecked, causing false-positive no-unsafe-* errors.
	{
		files: ["src/prisma/**/*.ts", "src/modules/**/*.ts", "src/common/**/*.ts", "src/main.ts", "scripts/**/*.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-return": "off",
		},
	},

	// ── Improvement 19: banned type keywords in the telescope module ──
	// The project rule forbids `any` / `unknown` / `never` in code. The
	// telescope module is fully clean, so the ban is enforced here with
	// no-restricted-syntax (AST selectors). Roll the same override into
	// other modules as they are cleaned up.
	{
		files: ["src/modules/telescope/**/*.ts", "scripts/telescope-cli.ts", "scripts/gen-telescope-docs.ts"],
		rules: {
			// catch callbacks are deliberately typed `(err: Error)` (repo
			// convention — see ResponseInterceptor); the plugin's preferred
			// `unknown` is itself banned by the project rule below.
			"@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
			"no-restricted-syntax": [
				"error",
				{
					selector: "TSAnyKeyword",
					message: "`any` is banned — define a zod schema and infer the type instead.",
				},
				{
					selector: "TSUnknownKeyword",
					message: "`unknown` is banned — use a zod schema with z.output<T> or a union type.",
				},
				{
					selector: "TSNeverKeyword",
					message: "`never` is banned — model the empty case with a proper schema type.",
				},
			],
		},
	},
];
