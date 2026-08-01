import { nestjsConfig } from "@workspace/eslint-config/nestjs";

/** @type {import("eslint").Linter.Config} */
export default [
	// Global ignores — must be first so ESLint skips these files entirely
	{
		ignores: ["**/*.spec.ts", "**/*.test.ts"],
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
					allowDefaultProject: ["src/modules/auth/*.spec.ts"],
				},
			},
		},
	},

	// ── Type tracing override for runtime-type patterns ──────────────
	// Prisma's complex generic chains, Zod schema metafields (`.meta()`),
	// and dynamic Express middleware patterns cannot be fully resolved by
	// strictTypeChecked, causing false-positive no-unsafe-* errors.
	{
		files: ["src/prisma/**/*.ts", "src/modules/**/*.ts", "src/common/schemas/**/*.ts", "src/common/guards/**/*.ts", "src/common/interceptors/**/*.ts", "src/common/middleware/**/*.ts", "src/app.controller.ts", "src/main.ts", "src/common/dto/**/*.ts", "src/common/services/**/*.ts", "src/common/utils/**/*.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-return": "off",
		},
	},
];
