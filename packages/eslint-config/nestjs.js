import nestjsPlugin from "@darraghor/eslint-plugin-nestjs-typed";

import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for NestJS applications (apps/api).
 *
 * @type {import("eslint").Linter.Config}
 * */
export const nestjsConfig = [
	...baseConfig,

	// ── Override base's TypeScript rules with relaxed ones for NestJS ──
	// NestJS decorators and DI patterns need flexibility that strict TS rules
	// can conflict with (e.g., unused constructor params used as DI tokens).
	{
		rules: {
			// Allow empty constructor-parameter classes (NestJS DTOs extend createZodDto)
			"@typescript-eslint/no-extraneous-class": "off",

			// Decorator parameters like @Injectable() don't need explicit types
			"@typescript-eslint/explicit-member-accessibility": "off",

			// Allow unused constructor parameters (NestJS DI injects via constructor)
			// Prefix with underscore if intentionally unused
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],

			// Allow empty constructors (common in NestJS base classes)
			"no-empty-function": "off",
			"@typescript-eslint/no-empty-function": "off",

			// allow require-await on methods that implement an interface
			"require-await": "off",

			// NestJS DI constructor params (private readonly service) should NOT
			// require underscore prefix — that's standard NestJS convention.
			"@typescript-eslint/naming-convention": [
				"error",
				// Types, interfaces, enums, type aliases → PascalCase
				{
					selector: "typeLike",
					format: ["PascalCase"],
				},
				// Variables → camelCase, PascalCase (Zod schemas / DTOs), or UPPER_CASE (constants)
				{
					selector: "variable",
					format: ["camelCase", "PascalCase", "UPPER_CASE"],
				},
				{
					selector: "function",
					format: ["camelCase", "PascalCase"],
				},
				// Class members → camelCase
				{
					selector: "memberLike",
					format: ["camelCase"],
				},
				// Class methods, accessors → camelCase
				{
					selector: "method",
					format: ["camelCase"],
				},
				// Allow any format for object literal properties (Prisma query operators like
				// `OR`, `AND`, `NOT`, config objects, etc.)
				{
					selector: ["objectLiteralProperty"],
					format: null,
				},
			],
		},
	},

	// ── NestJS-specific rules ──────────────────────────────────────────
	// flatRecommended is an array of config objects (plugins + rules) — spread them in
	...nestjsPlugin.configs.flatRecommended,
	// Override specific rule severities
	{
		rules: {
			"@darraghor/nestjs-typed/api-property-matches-property-optionality": "warn",
		},
	},
];
