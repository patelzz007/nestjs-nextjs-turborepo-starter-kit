import { config as baseConfig, TYPESCRIPT_FILES } from "./base.js";
import { composeConfigs } from "./compose.js";
import { apiArchitectureBoundaryConfigs, backendImportBoundaryConfig } from "./import-boundaries.js";
import { NESTJS_PLUGIN } from "./js-plugins.js";
import { nestjsRules } from "./rules/nestjs.js";

/**
 * NestJS naming: the base rules without the private-underscore requirement —
 * DI constructor parameters (`private readonly service`) follow the NestJS
 * convention.
 */
export const NESTJS_NAMING_CONVENTION = [
	{ selector: "typeLike", format: ["PascalCase"] },
	{ selector: "variable", format: ["camelCase", "PascalCase", "UPPER_CASE"] },
	{ selector: "function", format: ["camelCase", "PascalCase"] },
	{ selector: "memberLike", format: ["camelCase"] },
	{ selector: "method", format: ["camelCase"] },
	{ selector: ["objectLiteralProperty"], format: null },
];

/**
 * The oxlint configuration for NestJS applications (apps/api): base, relaxed
 * for Nest's decorator / DI patterns, the @darraghor NestJS rules, and the
 * backend and DDD layer import boundaries (§12.1).
 */
export const nestjsConfig = composeConfigs(baseConfig, {
	jsPlugins: [NESTJS_PLUGIN],
	overrides: [
		{
			files: TYPESCRIPT_FILES,
			rules: {
				// Empty-bodied DTO classes (createZodDto) and base-class constructors.
				"typescript/no-extraneous-class": "off",
				"no-empty-function": "off",
				// Decorated members do not repeat `public`.
				"typescript/explicit-member-accessibility": "off",
				// A method may be async to satisfy an interface without awaiting.
				"require-await": "off",
				"workspace/naming-convention": ["error", ...NESTJS_NAMING_CONVENTION],
				...nestjsRules,
			},
		},
		// A Node backend never imports frontend code; then the context / platform layer rules.
		// Later overrides replace `workspace/restricted-imports`, and each one repeats the universal and backend patterns.
		backendImportBoundaryConfig,
		...apiArchitectureBoundaryConfigs,
	],
});
